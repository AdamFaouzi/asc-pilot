import type { Localized, SiteContent } from "@/core/types";
import { prisma } from "@/lib/db";
import { asJson } from "@/lib/json";
import { logger } from "@/lib/logger";
import { getPlan } from "@/providers/billing";
import { getHostingProvider } from "@/providers/hosting";
import { renderSite } from "@/site/render";
import { pickTemplate, templateByKey } from "@/site/templates";
import { variationFor } from "@/site/variation";

/**
 * Manual interventions.
 *
 * Every automated stage in this pipeline makes a judgement that will sometimes
 * be wrong — a lead that's a duplicate, a template that doesn't suit, copy
 * that's slightly off. These are the escape hatches, and they are deliberately
 * explicit: an operator overriding the machine should leave a record saying so.
 */

const ATTRIBUTION = "Data © Overture Maps Foundation, CDLA-Permissive 2.0.";

/** Statuses where outreach has gone out — actions here need more care. */
const CONTACTED = ["OUTREACH_SENT", "REPLIED", "CONVERTED"];

export async function disqualifyLead(slug: string, reason: string) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { slug }, select: { id: true, status: true } });

  if (lead.status === "CONVERTED") {
    throw new Error("This lead is a paying customer — cancel the subscription in Stripe instead");
  }

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: { status: "DISQUALIFIED", reviewReason: reason },
    }),
    // Take any preview offline: a disqualified lead's page should not stay
    // reachable at a URL that may already have been sent.
    prisma.generatedSite.updateMany({
      where: { leadId: lead.id, status: { in: ["PREVIEW", "DRAFT", "NEEDS_WORK"] } },
      data: { status: "ARCHIVED" },
    }),
  ]);

  logger.info("ops.lead_disqualified", { slug, reason });
}

export async function restoreLead(slug: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { slug },
    include: { sites: { orderBy: { version: "desc" }, take: 1 } },
  });

  const site = lead.sites[0];
  // Return it to whatever stage its evidence supports, not blindly to NEW.
  const status = !site ? "NEW" : site.reviewedByHuman ? "APPROVED" : "SITE_READY";

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: { status, reviewReason: null },
    }),
    ...(site
      ? [prisma.generatedSite.update({ where: { id: site.id }, data: { status: "PREVIEW" } })]
      : []),
  ]);

  logger.info("ops.lead_restored", { slug, status });
  return status;
}

/**
 * Re-deploys a site after its content has been edited. The version is not
 * bumped: this is the same site with corrected words, and bumping would orphan
 * the review that has already happened on it.
 */
export async function updateSiteContent(
  siteId: string,
  patch: Partial<Pick<SiteContent, "tagline" | "about" | "statement">> & {
    heroHeading?: Localized;
    heroSubheading?: Localized;
    /** Empty string clears it and restores the generated emblem. */
    logoUrl?: string;
    /** Photo URLs. An empty array clears the gallery. */
    gallery?: string[];
  },
  options: { preserveReview?: boolean } = {},
) {
  const site = await prisma.generatedSite.findUniqueOrThrow({
    where: { id: siteId },
    include: { lead: { select: { slug: true, status: true, business: { select: { primaryCategory: true } } } } },
  });

  if (site.status === "LIVE") {
    throw new Error("This site is live — edits to a paying customer's site need a fresh version");
  }

  const current = site.content as SiteContent | null;
  if (!current) throw new Error("This site has no stored content to edit");

  const content: SiteContent = {
    ...current,
    // A real logo always beats the generated emblem, so this simply wins when
    // set. Blanking the field puts the emblem back.
    logoUrl: patch.logoUrl === undefined ? current.logoUrl : patch.logoUrl || undefined,
    gallery:
      patch.gallery === undefined
        ? current.gallery
        : patch.gallery.map((url, index) => ({ reference: String(index), url })),
    tagline: patch.tagline ?? current.tagline,
    about: patch.about ?? current.about,
    statement: patch.statement ?? current.statement,
    hero: {
      ...current.hero,
      heading: patch.heroHeading ?? current.hero.heading,
      subheading: patch.heroSubheading ?? current.hero.subheading,
    },
  };

  const template =
    templateByKey(site.template ?? undefined) ?? pickTemplate(undefined, site.lead.slug);
  const target = { slug: site.lead.slug, environment: "preview" as const };
  const hosting = getHostingProvider();
  const plan = await getPlan();

  const html = renderSite({
    content,
    template,
    category: site.lead.business.primaryCategory ?? undefined,
    variation: variationFor(site.lead.slug, template),
    slug: site.lead.slug,
    priceLabel: { el: plan.displayPriceEl, en: plan.displayPrice },
    url: hosting.urlFor(target),
    preview: true,
    attribution: ATTRIBUTION,
  });

  const deployment = await hosting.deploy(target, { "index.html": html });

  await prisma.generatedSite.update({
    where: { id: site.id },
    data: {
      content: asJson(content),
      html,
      previewUrl: deployment.url,
      deployedAt: new Date(),
      // An edit to the business's own content invalidates the review; a
      // re-render that only changes our chrome (the price banner) does not.
      ...(options.preserveReview
        ? {}
        : { editedByHuman: true, reviewedByHuman: false, reviewedAt: null }),
    },
  });

  if (!options.preserveReview && site.lead.status === "APPROVED") {
    await prisma.lead.update({
      where: { slug: site.lead.slug },
      data: { status: "SITE_READY" },
    });
  }

  logger.info("ops.site_edited", { slug: site.lead.slug, siteId: site.id });
  return deployment.url;
}

/**
 * Clears a failed send so the lead can be picked up again. Only FAILED messages
 * qualify — a BLOCKED one was stopped by a rule, and retrying it would mean
 * ignoring the rule.
 */
export async function retryOutreach(messageId: string) {
  const message = await prisma.outreachMessage.findUniqueOrThrow({
    where: { id: messageId },
    include: { lead: { select: { slug: true, status: true, business: { select: { primaryCategory: true } } } } },
  });

  if (message.status !== "FAILED") {
    throw new Error(`Only FAILED messages can be retried — this one is ${message.status}`);
  }

  await prisma.$transaction([
    prisma.outreachMessage.delete({ where: { id: message.id } }),
    prisma.lead.update({ where: { id: message.leadId }, data: { status: "APPROVED" } }),
  ]);

  logger.info("ops.outreach_retry", { slug: message.lead.slug, messageId });
}

export async function addSuppression(email: string, note?: string) {
  const address = email.trim().toLowerCase();

  await prisma.suppression.upsert({
    where: { email: address },
    create: { email: address, reason: "MANUAL", note, source: "dashboard" },
    update: { note },
  });

  await prisma.lead.updateMany({
    where: { primaryEmail: address, status: { notIn: ["CONVERTED"] } },
    data: { status: "DECLINED", reviewReason: note ?? "Manually suppressed" },
  });

  logger.info("ops.suppressed", { email: address, note });
}

/** Everything about one lead, for the drill-down view. */
export async function leadDetail(slug: string) {
  return prisma.lead.findUnique({
    where: { slug },
    include: {
      business: { include: { contacts: { orderBy: { confidence: "desc" } }, discoveryRun: true } },
      sites: { orderBy: { version: "desc" } },
      outreach: { orderBy: { createdAt: "desc" }, include: { events: { orderBy: { occurredAt: "desc" } } } },
      subscription: true,
    },
  });
}

export { CONTACTED };
