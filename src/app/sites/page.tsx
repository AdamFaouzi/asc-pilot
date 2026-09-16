import { prisma } from "@/lib/db";

import { SiteBrowser, type SiteEntry } from "./SiteBrowser";

export const dynamic = "force-dynamic";

function claimCount(assets: unknown): number {
  if (!assets || typeof assets !== "object") return 0;
  const claims = (assets as { unverifiedClaims?: unknown }).unverifiedClaims;
  return Array.isArray(claims) ? claims.length : 0;
}

/** Browse and search every generated site. */
export default async function SitesPage() {
  const sites = await prisma.generatedSite.findMany({
    where: { status: { in: ["PREVIEW", "LIVE", "NEEDS_WORK"] } },
    orderBy: [{ createdAt: "desc" }],
    include: {
      lead: {
        select: {
          slug: true,
          status: true,
          business: { select: { name: true, primaryCategory: true, city: true } },
        },
      },
    },
  });

  // One row per lead: the newest version is the one worth looking at.
  const newest = new Map<string, (typeof sites)[number]>();
  for (const site of sites) {
    const existing = newest.get(site.leadId);
    if (!existing || site.version > existing.version) newest.set(site.leadId, site);
  }

  const entries: SiteEntry[] = [...newest.values()]
    .map((site) => ({
      slug: site.lead.slug,
      businessName: site.lead.business.name,
      category: site.lead.business.primaryCategory,
      city: site.lead.business.city,
      template: site.template,
      status: site.status,
      version: site.version,
      url: site.liveUrl ?? site.previewUrl,
      reviewed: site.reviewedByHuman,
      edited: site.editedByHuman,
      leadStatus: site.lead.status,
      claims: claimCount(site.assets),
    }))
    .sort((a, b) => a.businessName.localeCompare(b.businessName));

  return <SiteBrowser sites={entries} />;
}
