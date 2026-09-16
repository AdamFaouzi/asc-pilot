import Link from "next/link";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The review queue. Phase 2 deliberately routes anything doubtful here rather
 * than dropping it, so this page is where those decisions actually surface.
 * Phase 6 turns it into a full ops view with editing and manual actions.
 */

const STATUS_STYLES: Record<string, string> = {
  NEW: "text-signal",
  NEEDS_REVIEW: "text-caution",
  DISQUALIFIED: "text-ink-700",
};

const FILTERS = [
  { key: "NEW", label: "Ready" },
  { key: "SITE_READY", label: "Site built" },
  { key: "NEEDS_REVIEW", label: "Needs review" },
  { key: "all", label: "All" },
] as const;

/**
 * Claims the generator could not source from the business's data. These are the
 * reason a site must not be sent unreviewed, so they belong on the row rather
 * than buried in the database.
 */
function unverifiedClaims(assets: unknown): string[] {
  if (!assets || typeof assets !== "object") return [];
  const claims = (assets as { unverifiedClaims?: unknown }).unverifiedClaims;
  return Array.isArray(claims) ? claims.filter((claim): claim is string => typeof claim === "string") : [];
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = status ?? "NEW";

  const leads = await prisma.lead.findMany({
    where: active === "all" ? {} : { status: active as never },
    include: {
      business: {
        select: {
          name: true,
          primaryCategory: true,
          city: true,
          phone: true,
          websiteVerdict: true,
        },
      },
      sites: {
        where: { status: { in: ["PREVIEW", "LIVE"] } },
        orderBy: { version: "desc" },
        take: 1,
        select: { previewUrl: true, template: true, assets: true, reviewedByHuman: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const counts = await prisma.lead.groupBy({ by: ["status"], _count: { _all: true } });
  const countFor = (key: string) =>
    key === "all"
      ? counts.reduce((total, row) => total + row._count._all, 0)
      : (counts.find((row) => row.status === key)?._count._all ?? 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-10">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400 hover:text-ink-200">
          ASC-Pilot
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">Leads</h1>
          <span className="flex gap-4 text-xs">
            <Link href="/sites" className="text-ink-400 hover:text-ink-200">
              Browse sites →
            </Link>
            <Link href="/review" className="text-signal hover:opacity-80">
              Review queue →
            </Link>
          </span>
        </div>
      </header>

      <nav className="mb-8 flex gap-1">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={`/leads?status=${filter.key}`}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              active === filter.key ? "bg-ink-800 text-ink-50" : "text-ink-400 hover:text-ink-200"
            }`}
          >
            {filter.label}
            <span className="ml-2 font-mono text-xs text-ink-700">{countFor(filter.key)}</span>
          </Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <p className="text-sm text-ink-400">
          Nothing here yet. Run{" "}
          <code className="font-mono text-ink-200">npm run discover -- --area limassol</code>.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-800 text-left text-xs uppercase tracking-wider text-ink-700">
                <th className="py-2 pr-4 font-medium">Business</th>
                <th className="py-2 pr-4 font-medium">Category</th>
                <th className="py-2 pr-4 font-medium">City</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Site</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-ink-800/60 align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/leads/${lead.slug}`} className="block hover:text-signal">
                      {lead.business.name}
                    </Link>
                    <span className="block font-mono text-xs text-ink-700">{lead.slug}</span>
                  </td>
                  <td className="py-3 pr-4 text-ink-400">{lead.business.primaryCategory ?? "—"}</td>
                  <td className="py-3 pr-4 text-ink-400">{lead.business.city ?? "—"}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-ink-400">
                    {lead.primaryEmail ?? <span className="text-ink-700">none</span>}
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {lead.sites[0]?.previewUrl ? (
                      <>
                        <a
                          href={lead.sites[0].previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-ink-200 underline decoration-ink-700 underline-offset-2 hover:decoration-ink-200"
                        >
                          preview
                        </a>
                        <span className="ml-2 font-mono text-ink-700">{lead.sites[0].template}</span>
                        {!lead.sites[0].reviewedByHuman && (
                          <span className="mt-1 block text-ink-700">unreviewed</span>
                        )}
                      </>
                    ) : (
                      <span className="font-mono text-ink-700">{lead.business.websiteVerdict}</span>
                    )}
                  </td>
                  <td className="py-3">
                    <span className={STATUS_STYLES[lead.status] ?? "text-ink-400"}>{lead.status}</span>
                    {lead.reviewReason && (
                      <span className="mt-1 block max-w-xs text-xs text-ink-700">{lead.reviewReason}</span>
                    )}
                    {unverifiedClaims(lead.sites[0]?.assets).map((claim) => (
                      <span key={claim} className="mt-1 block max-w-sm text-xs text-caution">
                        ⚠ {claim}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
