import { unsubscribeUrl } from "@/core/unsubscribe";
import { prisma } from "@/lib/db";
import { getEnv, requireEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { composeOutreach, TEMPLATE_ID } from "@/outreach/compose";
import { getPlan } from "@/providers/billing";
import { getEmailProvider } from "@/providers/email";

/**
 * Outreach sending.
 *
 * Every gate below is a separate, named check rather than one boolean, because
 * "why didn't this send?" is the question you actually ask, and "blocked" is
 * not an answer. A blocked lead gets an OutreachMessage row in BLOCKED state
 * with the reason recorded — nothing is dropped silently, and the log is the
 * audit trail if anyone ever asks how a business came to be contacted.
 *
 * Ordering matters: the cheap, absolute blocks (suppression, consent, review)
 * are evaluated before the rate limits, so a suppressed address is never merely
 * "deferred" and never retried.
 */

export type BlockReason =
  | "outreach_disabled"
  | "no_email"
  | "suppressed"
  | "already_contacted"
  | "site_not_ready"
  | "site_not_reviewed"
  | "lead_not_approved"
  | "daily_limit_reached"
  | "too_soon";

export interface Blocked {
  reason: BlockReason;
  detail: string;
  /** False for permanent blocks — retrying will never help. */
  retryable: boolean;
}

export interface SendCandidate {
  leadId: string;
  slug: string;
  businessName: string;
  email: string;
  siteId: string;
  previewUrl: string;
}

export interface OutreachSummary {
  considered: number;
  sent: number;
  blocked: number;
  failed: number;
  dryRun: boolean;
  blocks: Record<string, number>;
  results: Array<{ slug: string; email: string; outcome: string; detail?: string }>;
}

/**
 * Everything standing between a lead and an email. Returns null when the lead
 * is genuinely sendable.
 */
export async function preflight(leadId: string, now = new Date()): Promise<Blocked | null> {
  const env = getEnv();

  if (!env.OUTREACH_ENABLED) {
    return {
      reason: "outreach_disabled",
      detail: "OUTREACH_ENABLED is false — nothing can leave the system",
      retryable: true,
    };
  }

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      business: { select: { name: true } },
      sites: { orderBy: { version: "desc" }, take: 1 },
      outreach: { where: { status: { notIn: ["BLOCKED", "FAILED"] } }, take: 1 },
    },
  });

  // A human must have approved the lead and looked at the exact page we link.
  if (lead.status !== "APPROVED") {
    return {
      reason: "lead_not_approved",
      detail: `Lead status is ${lead.status}, not APPROVED`,
      retryable: true,
    };
  }

  const site = lead.sites[0];
  if (!site || site.status !== "PREVIEW" || !site.previewUrl) {
    return { reason: "site_not_ready", detail: "No deployed preview site", retryable: true };
  }

  if (!site.reviewedByHuman) {
    return {
      reason: "site_not_reviewed",
      detail: "Site has not been reviewed — see /review",
      retryable: true,
    };
  }

  if (lead.outreach.length > 0) {
    return {
      reason: "already_contacted",
      detail: "This lead has already been contacted",
      retryable: false,
    };
  }

  const email = lead.primaryEmail?.trim().toLowerCase();
  if (!email) {
    return { reason: "no_email", detail: "No contact email on the lead", retryable: false };
  }

  const suppressed = await prisma.suppression.findUnique({ where: { email } });
  if (suppressed) {
    return {
      reason: "suppressed",
      detail: `Address opted out (${suppressed.reason})`,
      retryable: false,
    };
  }

  // Rate limits last: they're the only blocks that clear on their own.
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sentToday = await prisma.outreachMessage.count({
    where: { sentAt: { gte: dayAgo } },
  });
  if (sentToday >= env.OUTREACH_DAILY_LIMIT) {
    return {
      reason: "daily_limit_reached",
      detail: `${sentToday} sent in the last 24h, limit is ${env.OUTREACH_DAILY_LIMIT}`,
      retryable: true,
    };
  }

  const last = await prisma.outreachMessage.findFirst({
    where: { sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  if (last?.sentAt) {
    const elapsed = (now.getTime() - last.sentAt.getTime()) / 1000;
    if (elapsed < env.OUTREACH_MIN_INTERVAL_SECONDS) {
      return {
        reason: "too_soon",
        detail: `${Math.round(elapsed)}s since last send, minimum is ${env.OUTREACH_MIN_INTERVAL_SECONDS}s`,
        retryable: true,
      };
    }
  }

  return null;
}

export interface SendOptions {
  /** Compose and log, but never hand anything to the provider. */
  dryRun?: boolean;
  limit?: number;
  /** Send for one lead by slug. */
  slug?: string;
}

export async function runOutreach(options: SendOptions = {}): Promise<OutreachSummary> {
  const env = getEnv();
  const dryRun = options.dryRun ?? true;

  const leads = await prisma.lead.findMany({
    where: options.slug ? { slug: options.slug } : { status: "APPROVED" },
    select: { id: true, slug: true },
    take: options.slug ? 1 : (options.limit ?? 5),
    orderBy: { approvedAt: "asc" },
  });

  const summary: OutreachSummary = {
    considered: leads.length,
    sent: 0,
    blocked: 0,
    failed: 0,
    dryRun,
    blocks: {},
    results: [],
  };

  for (const lead of leads) {
    const blocked = await preflight(lead.id);

    if (blocked) {
      summary.blocked += 1;
      summary.blocks[blocked.reason] = (summary.blocks[blocked.reason] ?? 0) + 1;
      summary.results.push({
        slug: lead.slug,
        email: "",
        outcome: `blocked:${blocked.reason}`,
        detail: blocked.detail,
      });

      // Permanent blocks are recorded; transient ones aren't worth a row each
      // time a scheduled run trips the rate limit.
      if (!blocked.retryable) await recordBlocked(lead.id, blocked);
      continue;
    }

    try {
      const result = await sendToLead(lead.id, dryRun);
      summary.sent += 1;
      summary.results.push({
        slug: lead.slug,
        email: result.email,
        outcome: dryRun ? "dry-run" : "sent",
      });
    } catch (error) {
      summary.failed += 1;
      summary.results.push({
        slug: lead.slug,
        email: "",
        outcome: "failed",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("outreach.run", {
    dryRun,
    considered: summary.considered,
    sent: summary.sent,
    blocked: summary.blocked,
    failed: summary.failed,
    provider: env.EMAIL_PROVIDER,
  });

  return summary;
}

async function recordBlocked(leadId: string, blocked: Blocked) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { primaryEmail: true, sites: { orderBy: { version: "desc" }, take: 1 } },
  });

  await prisma.outreachMessage.create({
    data: {
      leadId,
      siteId: lead.sites[0]?.id,
      toAddress: lead.primaryEmail ?? "(none)",
      status: "BLOCKED",
      blockedReason: `${blocked.reason}: ${blocked.detail}`,
      template: TEMPLATE_ID,
    },
  });
}

/**
 * Sends one message. The log row is written before the provider is called, so a
 * send that crashes mid-flight still leaves a trace — the alternative is an
 * email that went out with no record of it.
 */
async function sendToLead(leadId: string, dryRun: boolean) {
  const env = getEnv();

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      business: { select: { name: true } },
      sites: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  const site = lead.sites[0]!;
  const email = lead.primaryEmail!.trim().toLowerCase();

  const secret = requireEnv("UNSUBSCRIBE_SECRET", "outreach unsubscribe links");
  const fromAddress = requireEnv("OUTREACH_FROM_EMAIL", "sending outreach");
  const postalAddress = requireEnv("OUTREACH_POSTAL_ADDRESS", "commercial email under EU rules");

  const unsubscribe = unsubscribeUrl(email, env.APP_URL, secret);
  const plan = await getPlan();

  const message = composeOutreach({
    businessName: lead.business.name,
    previewUrl: site.previewUrl!,
    toAddress: email,
    fromAddress,
    fromName: env.OUTREACH_FROM_NAME,
    replyTo: env.OUTREACH_REPLY_TO,
    postalAddress,
    phone: env.OUTREACH_PHONE,
    unsubscribeUrl: unsubscribe,
    priceLabel: plan.displayPrice,
    priceLabelEl: plan.displayPriceEl,
  });

  const row = await prisma.outreachMessage.create({
    data: {
      leadId,
      siteId: site.id,
      toAddress: email,
      fromAddress: message.from,
      subject: message.subject,
      bodyText: message.text,
      bodyHtml: message.html,
      template: TEMPLATE_ID,
      provider: env.EMAIL_PROVIDER,
      unsubscribeToken: unsubscribe.split("t=")[1] ?? null,
      status: dryRun ? "QUEUED" : "SENDING",
    },
  });

  if (dryRun) {
    logger.info("outreach.dry_run", { slug: lead.slug, to: email, subject: message.subject });
    return { email, messageId: row.id };
  }

  try {
    const result = await getEmailProvider().send(message);

    await prisma.$transaction([
      prisma.outreachMessage.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: result.acceptedAt,
          providerMessageId: result.providerMessageId,
        },
      }),
      prisma.lead.update({ where: { id: leadId }, data: { status: "OUTREACH_SENT" } }),
    ]);

    logger.info("outreach.sent", { slug: lead.slug, to: email, provider: result.provider });
    return { email, messageId: row.id };
  } catch (error) {
    await prisma.outreachMessage.update({
      where: { id: row.id },
      data: { status: "FAILED", error: error instanceof Error ? error.message : String(error) },
    });
    throw error;
  }
}
