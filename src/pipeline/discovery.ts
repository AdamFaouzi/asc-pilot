import { bestEmail, extractContacts } from "@/core/contacts";
import { uniqueSlug } from "@/core/slug";
import type { PlaceResult } from "@/core/types";
import { checkWebsite } from "@/core/website-check";
import { isNonCommercial } from "@/site/category";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { asJson } from "@/lib/json";
import { logger } from "@/lib/logger";
import { resolveArea } from "@/providers/geocode";
import { getPlacesProvider } from "@/providers/places";

/**
 * Discovery: find businesses in an area, decide which genuinely have no
 * website, and record them as leads with whatever contact detail exists.
 *
 * Two rules shape this:
 *   - Nothing is dropped silently. A business we can't email becomes a
 *     NEEDS_REVIEW lead with a stated reason, not a gap in the numbers.
 *   - Qualification is conservative. An unresolved website check is
 *     NEEDS_REVIEW, never a lead ready for outreach.
 */

export interface DiscoveryOptions {
  area: string;
  category?: string;
  limit?: number;
  /** Re-run the website check on businesses already seen. */
  recheck?: boolean;
}

export interface DiscoverySummary {
  runId: string;
  area: string;
  seen: number;
  created: number;
  updated: number;
  qualified: number;
  needsReview: number;
  disqualified: number;
  withEmail: number;
}

/** Verdicts that mean the business is worth pitching. */
const QUALIFYING = new Set(["NONE", "SOCIAL_ONLY"]);

/**
 * Statuses where outreach has already gone out. Past this point a re-scan must
 * not rewrite the lead: the business has seen a URL and may act on it.
 */
const CONTACTED = ["OUTREACH_SENT", "REPLIED", "CONVERTED", "DECLINED"] as const;

/**
 * Retires a lead whose business turned out to have a website, and archives any
 * site generated for it so it can't be linked from an email later.
 */
async function disqualifyLead(businessId: string, reason: string) {
  const lead = await prisma.lead.findUnique({
    where: { businessId },
    select: { id: true, status: true },
  });

  if (!lead || CONTACTED.includes(lead.status as (typeof CONTACTED)[number])) return;

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: { status: "DISQUALIFIED", reviewReason: reason },
    }),
    prisma.generatedSite.updateMany({
      where: { leadId: lead.id, status: { in: ["DRAFT", "GENERATING", "PREVIEW"] } },
      data: { status: "ARCHIVED" },
    }),
  ]);

  logger.info("discovery.lead_disqualified", { leadId: lead.id, reason });
}

export async function runDiscovery(options: DiscoveryOptions): Promise<DiscoverySummary> {
  const env = getEnv();
  const log = logger.child({ area: options.area, category: options.category ?? "all" });

  const resolved = await resolveArea(options.area);
  const provider = getPlacesProvider();

  const run = await prisma.discoveryRun.create({
    data: {
      provider: provider.key,
      area: resolved.label,
      category: options.category,
      latitude: resolved.center.latitude,
      longitude: resolved.center.longitude,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  log.info("discovery.started", { runId: run.id, resolved: resolved.label });

  const summary: DiscoverySummary = {
    runId: run.id,
    area: resolved.label,
    seen: 0,
    created: 0,
    updated: 0,
    qualified: 0,
    needsReview: 0,
    disqualified: 0,
    withEmail: 0,
  };

  try {
    for await (const place of provider.search({
      area: options.area,
      category: options.category,
      center: resolved.center,
      bbox: resolved.bbox,
      limit: options.limit,
    })) {
      summary.seen += 1;
      const outcome = await ingestPlace(place, run.id, {
        probe: env.WEBSITE_PROBE_ENABLED,
        timeoutMs: env.WEBSITE_PROBE_TIMEOUT_MS,
        contactThreshold: env.CONTACT_CONFIDENCE_THRESHOLD,
        recheck: options.recheck ?? false,
      });

      if (outcome.isNew) summary.created += 1;
      else summary.updated += 1;
      if (outcome.hasEmail) summary.withEmail += 1;

      if (outcome.leadStatus === "NEW") summary.qualified += 1;
      else if (outcome.leadStatus === "NEEDS_REVIEW") summary.needsReview += 1;
      else if (outcome.leadStatus === null) summary.disqualified += 1;

      if (summary.seen % 100 === 0) {
        log.info("discovery.progress", { seen: summary.seen, qualified: summary.qualified });
      }
    }

    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        businessesSeen: summary.seen,
        businessesNew: summary.created,
        businessesQualified: summary.qualified + summary.needsReview,
      },
    });

    log.info("discovery.completed", { ...summary });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message, finishedAt: new Date() },
    });
    log.error("discovery.failed", { runId: run.id, error: message });
    throw error;
  }
}

interface IngestOptions {
  probe: boolean;
  timeoutMs: number;
  contactThreshold: number;
  recheck: boolean;
}

interface IngestOutcome {
  isNew: boolean;
  hasEmail: boolean;
  /** Null when the business was disqualified and no lead exists. */
  leadStatus: "NEW" | "NEEDS_REVIEW" | null;
}

async function ingestPlace(
  place: PlaceResult,
  runId: string,
  options: IngestOptions,
): Promise<IngestOutcome> {
  const existing = await prisma.business.findUnique({
    where: { source_sourceId: { source: place.source, sourceId: place.sourceId } },
    select: { id: true, websiteVerdict: true, websiteCheckedAt: true },
  });

  // Probing costs a network round-trip, so only redo it when asked or unseen.
  const needsCheck = !existing || options.recheck || existing.websiteVerdict === "UNKNOWN";
  const check = needsCheck
    ? await checkWebsite(place, { probe: options.probe, timeoutMs: options.timeoutMs })
    : null;

  const verdict = check?.verdict ?? existing?.websiteVerdict ?? "UNKNOWN";

  const shared = {
    name: place.name,
    categories: place.categories,
    primaryCategory: place.primaryCategory,
    formattedAddress: place.address?.formatted,
    addressLine: place.address?.line,
    city: place.address?.city,
    region: place.address?.region,
    postalCode: place.address?.postalCode,
    countryCode: place.address?.countryCode,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    phone: place.phone,
    websiteUrl: place.websiteUrl,
    discoveryRunId: runId,
    lastSeenAt: new Date(),
  };

  const business = await prisma.business.upsert({
    where: { source_sourceId: { source: place.source, sourceId: place.sourceId } },
    create: {
      source: place.source,
      sourceId: place.sourceId,
      ...shared,
      websiteVerdict: verdict,
      websiteEvidence: asJson(check?.evidence),
      websiteCheckedAt: check ? new Date() : undefined,
      raw: asJson(place.raw),
    },
    update: {
      ...shared,
      ...(check
        ? {
            websiteVerdict: verdict,
            websiteEvidence: asJson(check.evidence),
            websiteCheckedAt: new Date(),
          }
        : {}),
    },
  });

  const contacts = extractContacts(place);
  for (const contact of contacts) {
    await prisma.contact.upsert({
      where: {
        businessId_channel_value: {
          businessId: business.id,
          channel: contact.channel,
          value: contact.value,
        },
      },
      create: {
        businessId: business.id,
        channel: contact.channel,
        value: contact.value,
        source: contact.source,
        confidence: contact.confidence,
        isPrimary: contact.isPrimary,
        isRoleAddress: contact.isRoleAddress,
        isFreeMailbox: contact.isFreeMailbox,
      },
      update: {
        confidence: contact.confidence,
        isPrimary: contact.isPrimary,
        isRoleAddress: contact.isRoleAddress,
        isFreeMailbox: contact.isFreeMailbox,
      },
    });
  }

  const email = bestEmail(contacts);
  const outcome: IngestOutcome = {
    isNew: !existing,
    hasEmail: Boolean(email),
    leadStatus: null,
  };

  // A beach or a town hall passes the no-website filter and can still never buy
  // a subscription. Drop these before they reach the review queue.
  if (isNonCommercial(place.primaryCategory, place.categories)) {
    await disqualifyLead(business.id, "Not a commercial business");
    return outcome;
  }

  if (!QUALIFYING.has(verdict)) {
    if (verdict === "UNKNOWN") {
      await upsertLead(business.id, place, "NEEDS_REVIEW", "Website check unresolved", email?.value);
      outcome.leadStatus = "NEEDS_REVIEW";
      return outcome;
    }

    // A re-check found a website we previously missed. An existing lead must
    // be retired, not merely left alone — otherwise a site already generated
    // for it stays queued and eventually gets pitched to a business that has
    // had a website all along.
    await disqualifyLead(business.id, `Website found on re-check: ${verdict}`);
    return outcome;
  }

  const reason = !email
    ? "No contact email discovered"
    : email.confidence < options.contactThreshold
      ? `Email confidence ${email.confidence.toFixed(2)} below threshold ${options.contactThreshold}`
      : null;

  const status = reason ? "NEEDS_REVIEW" : "NEW";
  await upsertLead(business.id, place, status, reason, email?.value);
  outcome.leadStatus = status;

  return outcome;
}

async function upsertLead(
  businessId: string,
  place: PlaceResult,
  status: "NEW" | "NEEDS_REVIEW",
  reviewReason: string | null,
  primaryEmail: string | undefined,
) {
  const existing = await prisma.lead.findUnique({
    where: { businessId },
    select: { id: true, status: true },
  });

  // Only a lead we have actually contacted is off-limits to re-qualification.
  // Everything earlier than that — including a generated site nobody has seen —
  // is still discovery's to change, because the alternative is pitching a
  // business whose data has since contradicted the premise.
  const settled = existing && CONTACTED.includes(existing.status as (typeof CONTACTED)[number]);
  if (settled) {
    await prisma.lead.update({ where: { businessId }, data: { primaryEmail } });
    return;
  }

  if (existing) {
    await prisma.lead.update({
      where: { businessId },
      data: { status, reviewReason, primaryEmail, qualifiedAt: new Date() },
    });
    return;
  }

  const slug = await uniqueSlug(
    place.name,
    async (candidate) => (await prisma.lead.count({ where: { slug: candidate } })) > 0,
    place.address?.city,
  );

  await prisma.lead.create({
    data: { businessId, slug, status, reviewReason, primaryEmail, qualifiedAt: new Date() },
  });
}
