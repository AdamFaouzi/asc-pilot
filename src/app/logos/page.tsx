import { prisma } from "@/lib/db";

import { LogoGrid, type LogoCard } from "./LogoGrid";

export const dynamic = "force-dynamic";

/** Contact sheet of every site's logo, for accepting or rejecting in one pass. */
export default async function LogosPage() {
  const sites = await prisma.generatedSite.findMany({
    where: { status: { in: ["PREVIEW", "NEEDS_WORK"] } },
    orderBy: { createdAt: "desc" },
    include: {
      lead: {
        select: {
          slug: true,
          business: {
            select: {
              name: true,
              primaryCategory: true,
              contacts: { where: { channel: "FACEBOOK" }, take: 1 },
            },
          },
        },
      },
    },
  });

  const newest = new Map<string, (typeof sites)[number]>();
  for (const site of sites) {
    const existing = newest.get(site.leadId);
    if (!existing || site.version > existing.version) newest.set(site.leadId, site);
  }

  const cards: LogoCard[] = [...newest.values()]
    .map((site) => {
      const content = site.content as { logoUrl?: string } | null;
      return {
        slug: site.lead.slug,
        siteId: site.id,
        businessName: site.lead.business.name,
        category: site.lead.business.primaryCategory,
        logoUrl: content?.logoUrl ?? null,
        facebookId: site.lead.business.contacts[0]?.value.match(/(\d{6,})/)?.[1] ?? null,
      };
    })
    // Sites that already have a logo need a decision; show them first.
    .sort((a, b) => Number(Boolean(b.logoUrl)) - Number(Boolean(a.logoUrl)));

  return <LogoGrid cards={cards} />;
}
