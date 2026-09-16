import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Human review of generated sites.
 *
 * This is the gate the whole product rests on: a page goes live under a real
 * business's name, so someone has to have looked at it. Phase 4 refuses to send
 * outreach for a site that hasn't passed through here.
 */

export type ReviewDecision = "accept" | "reject";

export interface ReviewResult {
  siteId: string;
  slug: string;
  decision: ReviewDecision;
  leadStatus: string;
}

export async function reviewSite(
  siteId: string,
  decision: ReviewDecision,
  note?: string,
): Promise<ReviewResult> {
  const site = await prisma.generatedSite.findUniqueOrThrow({
    where: { id: siteId },
    include: { lead: { select: { id: true, slug: true, status: true } } },
  });

  const now = new Date();

  if (decision === "accept") {
    const [, lead] = await prisma.$transaction([
      prisma.generatedSite.update({
        where: { id: site.id },
        data: { reviewedByHuman: true, reviewedAt: now, reviewNote: null, status: "PREVIEW" },
      }),
      prisma.lead.update({
        where: { id: site.leadId },
        data: { status: "APPROVED", approvedAt: now, reviewReason: null },
      }),
    ]);

    logger.info("review.accepted", { siteId: site.id, slug: site.lead.slug });
    return { siteId: site.id, slug: site.lead.slug, decision, leadStatus: lead.status };
  }

  // Rejected: the site is marked for rework and the lead drops out of the
  // outreach-ready pool. Regenerating creates a new version rather than
  // overwriting what was rejected, so the note stays attached to what caused it.
  const [, lead] = await prisma.$transaction([
    prisma.generatedSite.update({
      where: { id: site.id },
      data: {
        reviewedByHuman: true,
        reviewedAt: now,
        reviewNote: note?.trim() || "Needs work",
        status: "NEEDS_WORK",
      },
    }),
    prisma.lead.update({
      where: { id: site.leadId },
      data: {
        status: "NEEDS_REVIEW",
        reviewReason: `Site needs work: ${note?.trim() || "flagged in review"}`,
      },
    }),
  ]);

  logger.info("review.rejected", { siteId: site.id, slug: site.lead.slug, note });
  return { siteId: site.id, slug: site.lead.slug, decision, leadStatus: lead.status };
}

export interface ReviewCard {
  siteId: string;
  slug: string;
  businessName: string;
  category: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  template: string | null;
  previewUrl: string | null;
  unverifiedClaims: string[];
}

function claimsOf(assets: unknown): string[] {
  if (!assets || typeof assets !== "object") return [];
  const claims = (assets as { unverifiedClaims?: unknown }).unverifiedClaims;
  return Array.isArray(claims) ? claims.filter((c): c is string => typeof c === "string") : [];
}

/** The queue: deployed previews nobody has looked at yet, oldest first. */
export async function pendingReview(limit = 100): Promise<ReviewCard[]> {
  const sites = await prisma.generatedSite.findMany({
    where: { status: "PREVIEW", reviewedByHuman: false },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      lead: {
        select: {
          slug: true,
          primaryEmail: true,
          business: {
            select: { name: true, primaryCategory: true, city: true, phone: true },
          },
        },
      },
    },
  });

  return sites.map((site) => ({
    siteId: site.id,
    slug: site.lead.slug,
    businessName: site.lead.business.name,
    category: site.lead.business.primaryCategory,
    city: site.lead.business.city,
    phone: site.lead.business.phone,
    email: site.lead.primaryEmail,
    template: site.template,
    previewUrl: site.previewUrl,
    unverifiedClaims: claimsOf(site.assets),
  }));
}
