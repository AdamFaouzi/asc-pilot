import type Stripe from "stripe";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getHostingProvider } from "@/providers/hosting";
import { getPlan, stripeClient, stripeConfig } from "@/providers/billing";
import type { SiteContent } from "@/core/types";
import { renderSite } from "@/site/render";
import { pickTemplate, templateByKey } from "@/site/templates";
import { variationFor } from "@/site/variation";

/**
 * Checkout and subscription lifecycle.
 *
 * The promise made in the outreach email is "the page you are looking at goes
 * live" — so promotion serves the exact build they saw, rather than
 * regenerating. Regenerating would risk delivering something different from
 * what they agreed to buy.
 */

/** Maps Stripe's subscription statuses onto ours. */
const STATUS: Record<string, "INCOMPLETE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID"> = {
  incomplete: "INCOMPLETE",
  incomplete_expired: "CANCELED",
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "UNPAID",
  paused: "PAST_DUE",
};

export async function createCheckoutSession(slug: string): Promise<{ url: string }> {
  const env = getEnv();
  const config = stripeConfig();

  const lead = await prisma.lead.findUnique({
    where: { slug },
    include: {
      business: { select: { name: true } },
      // Only a reviewed site can be bought. Paying is the second path to
      // live, alongside outreach, and it strips the noindex — so it needs the
      // same human check. Without this a guessed slug could put an unreviewed
      // page, unverifiedClaims and all, online under a real business's name.
      sites: {
        where: { status: "PREVIEW", reviewedByHuman: true },
        orderBy: { version: "desc" },
        take: 1,
      },
      subscription: true,
    },
  });

  if (!lead) throw new Error(`No lead for slug "${slug}"`);
  /*
   * A lead ruled out after its site was approved stays approved, because
   * approval describes the page and disqualification describes the business.
   * Selling to one anyway is the case this guards: the website re-check
   * disqualified a business whose site a human had already accepted.
   */
  if (lead.status === "DISQUALIFIED" || lead.status === "DECLINED") {
    throw new Error("This business is no longer a candidate");
  }
  if (lead.subscription?.status === "ACTIVE") {
    throw new Error("This site already has an active subscription");
  }

  const site = lead.sites[0];
  // Reaches the visitor: the button renders this in its error line.
  if (!site) throw new Error("This site has not been approved yet");

  const appUrl = env.APP_URL.replace(/\/$/, "");

  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: config.priceId, quantity: 1 }],
    // The slug is how the webhook finds its way back to the lead. Metadata
    // rather than a URL parameter, because the webhook is server-to-server.
    metadata: { slug, leadId: lead.id, siteId: site.id },
    subscription_data: { metadata: { slug, leadId: lead.id } },
    customer_email: lead.primaryEmail ?? undefined,
    success_url: `${appUrl}/s/preview/${slug}?paid=1`,
    cancel_url: `${appUrl}/s/preview/${slug}`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  logger.info("billing.checkout_created", { slug, sessionId: session.id });
  return { url: session.url };
}

/**
 * Promotes the reviewed preview to the live environment and records the
 * subscription. Idempotent: Stripe retries webhooks, so this must be safe to
 * run twice.
 */
export async function activateSubscription(subscription: Stripe.Subscription): Promise<void> {
  const slug = subscription.metadata?.slug;
  if (!slug) {
    logger.warn("billing.subscription_without_slug", { subscriptionId: subscription.id });
    return;
  }

  const lead = await prisma.lead.findUnique({
    where: { slug },
    include: { sites: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!lead) {
    logger.warn("billing.subscription_unknown_lead", { slug, subscriptionId: subscription.id });
    return;
  }

  const item = subscription.items.data[0];
  const price = item?.price;
  const status = STATUS[subscription.status] ?? "INCOMPLETE";

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  // What this subscription actually charges — not today's list price.
  const amountCents = price?.unit_amount ?? 0;
  const currency = price?.currency ?? "eur";
  const interval = price?.recurring?.interval ?? "month";

  const periodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : undefined;

  await prisma.subscription.upsert({
    where: { leadId: lead.id },
    create: {
      leadId: lead.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id,
      status,
      amountCents,
      currency,
      interval,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      startedAt: new Date(subscription.start_date * 1000),
    },
    update: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: price?.id,
      status,
      amountCents,
      currency,
      interval,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
    },
  });

  if (status === "ACTIVE" || status === "TRIALING") {
    await promoteToLive(lead.id);
  } else if (status === "CANCELED" || status === "UNPAID") {
    await takeDown(lead.id, status);
  }

  logger.info("billing.subscription_synced", { slug, status, amountCents, currency });
}

/**
 * Serves the reviewed preview build from the live environment.
 *
 * Exported because promotion is no longer only a consequence of paying: a
 * customer who asks for their opening hours to change gets a new version,
 * reviewed like any other, and this is what publishes it over the old one.
 */
export async function promoteToLive(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      business: { select: { primaryCategory: true } },
      sites: { where: { status: { in: ["PREVIEW", "LIVE"] } }, orderBy: { version: "desc" }, take: 1 },
    },
  });

  const site = lead.sites[0];
  if (!site) {
    logger.warn("billing.no_site_to_promote", { leadId });
    return;
  }
  if (site.status === "LIVE") return; // Already promoted; webhook retry.

  const hosting = getHostingProvider();
  const target = {
    slug: lead.slug,
    environment: "live" as const,
    customDomain: site.customDomain ?? undefined,
  };

  /*
   * Re-rendered rather than copied, from the same content, template, and
   * variation — so the customer's page is identical to the one they reviewed,
   * minus two things that were never theirs:
   *   - the "Make it live" banner, which would otherwise sell them a site they
   *     have already bought,
   *   - the `noindex` tag, which would keep the site they are paying for out of
   *     search results.
   * Both are our own preview chrome. Everything the business sees as their
   * page is byte-identical.
   */
  const content = site.content as SiteContent | null;
  if (!content) {
    logger.warn("billing.no_content_to_render", { leadId, siteId: site.id });
    return;
  }

  const template =
    templateByKey(site.template ?? undefined) ?? pickTemplate(undefined, lead.slug);
  const plan = await getPlan();

  const html = renderSite({
    content,
    template,
    category: lead.business.primaryCategory ?? undefined,
    variation: variationFor(lead.slug, template),
    url: hosting.urlFor(target),
    preview: false,
    priceLabel: { el: plan.displayPriceEl, en: plan.displayPrice },
    attribution: "Data © Overture Maps Foundation, CDLA-Permissive 2.0.",
  });

  const deployment = await hosting.deploy(target, { "index.html": html });

  await prisma.$transaction([
    // Whatever was live is now the previous version, not a second live one.
    prisma.generatedSite.updateMany({
      where: { leadId, status: "LIVE", id: { not: site.id } },
      data: { status: "ARCHIVED", liveUrl: null },
    }),
    prisma.generatedSite.update({
      where: { id: site.id },
      data: { status: "LIVE", liveUrl: deployment.url, html, deployedAt: new Date() },
    }),
    prisma.lead.update({
      where: { id: leadId },
      data: { status: "CONVERTED", convertedAt: new Date() },
    }),
  ]);

  logger.info("billing.site_live", { slug: lead.slug, url: deployment.url });
}

/** Subscription ended — the live site stops being served. */
async function takeDown(leadId: string, reason: string): Promise<void> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { sites: { where: { status: "LIVE" }, take: 1 } },
  });

  const site = lead.sites[0];
  if (!site) return;

  const hosting = getHostingProvider();
  if (site.deploymentId) {
    await hosting.remove(`live/${lead.slug}`).catch((error: unknown) => {
      logger.warn("billing.takedown_failed", {
        slug: lead.slug,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  await prisma.generatedSite.update({
    where: { id: site.id },
    data: { status: "ARCHIVED", liveUrl: null },
  });

  logger.info("billing.site_taken_down", { slug: lead.slug, reason });
}

/** True when this provider event has already been handled. Stripe retries. */
export async function alreadyProcessed(eventId: string): Promise<boolean> {
  const existing = await prisma.processedWebhookEvent.findUnique({
    where: { provider_eventId: { provider: "stripe", eventId } },
  });
  return Boolean(existing);
}

export async function markProcessed(eventId: string, type: string): Promise<void> {
  await prisma.processedWebhookEvent.create({
    data: { provider: "stripe", eventId, type },
  });
}
