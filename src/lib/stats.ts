import { prisma } from "./db";

export type StatusCounts = Record<string, number>;

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** Share of the stage before it, so drop-off is visible. */
  conversionFromPrevious: number | null;
}

export interface PipelineStats {
  funnel: FunnelStage[];
  recentRuns: Array<{ area: string; category: string | null; seen: number; qualified: number; at: Date }>;
  businesses: number;
  qualified: number;
  leadsByStatus: StatusCounts;
  sitesByStatus: StatusCounts;
  sitesTotal: number;
  outreachSent: number;
  outreachQueued: number;
  replies: number;
  conversions: number;
  activeSubscriptions: number;
  mrrCents: number;
  suppressions: number;
}

/** Turns a Prisma `groupBy` result into a plain status → count map. */
function tally(rows: Array<{ status: string; _count: { _all: number } }>): StatusCounts {
  const counts: StatusCounts = {};
  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}

export function countOf(counts: StatusCounts, status: string): number {
  return counts[status] ?? 0;
}

function sum(counts: StatusCounts, statuses: readonly string[]): number {
  return statuses.reduce((total, status) => total + countOf(counts, status), 0);
}

/** Statuses that mean a message actually left the building. */
const SENT_STATUSES = [
  "SENDING",
  "SENT",
  "DELIVERED",
  "OPENED",
  "CLICKED",
  "REPLIED",
  "BOUNCED",
  "COMPLAINED",
] as const;

export async function getPipelineStats(): Promise<PipelineStats> {
  const [businesses, qualified, leadRows, siteRows, outreachRows, subscriptionRows, suppressions] =
    await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { websiteVerdict: { in: ["NONE", "SOCIAL_ONLY"] } } }),
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.generatedSite.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.outreachMessage.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.suppression.count(),
    ]);

  const leadsByStatus = tally(leadRows);
  const sitesByStatus = tally(siteRows);
  const outreachByStatus = tally(outreachRows);
  const subsByStatus = tally(subscriptionRows);

  const activeSubscriptions = sum(subsByStatus, ["ACTIVE", "TRIALING"]);

  const recentRuns = await prisma.discoveryRun.findMany({
    where: { status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    take: 5,
    select: { area: true, category: true, businessesSeen: true, businessesQualified: true, finishedAt: true, createdAt: true },
  });

  /*
   * The funnel counts leads that have *reached at least* each stage, not leads
   * currently sitting in it. A lead that converted has also been contacted, and
   * a funnel that forgets that shows conversion rates above 100%.
   */
  const reached = (statuses: readonly string[]) => sum(leadsByStatus, statuses);

  const contactedOnwards = ["OUTREACH_SENT", "REPLIED", "CONVERTED", "DECLINED"] as const;
  const builtOnwards = ["SITE_READY", "APPROVED", ...contactedOnwards] as const;

  const stageCounts: Array<[string, string, number]> = [
    ["discovered", "Businesses found", businesses],
    ["qualified", "No website", qualified],
    ["built", "Site built", reached(builtOnwards)],
    ["approved", "Approved", reached(["APPROVED", ...contactedOnwards])],
    ["contacted", "Contacted", reached(contactedOnwards)],
    ["replied", "Replied", reached(["REPLIED", "CONVERTED"])],
    /*
     * The one stage that is current state rather than "reached at least".
     * `takeDown` archives a cancelled site but leaves the lead CONVERTED —
     * that status records what happened, not who is paying now. Counting it
     * here would keep a churned business in the Paying row forever while MRR
     * correctly dropped to zero, so this reads the same source MRR does.
     * It cannot exceed the row above it: a subscription implies a conversion.
     */
    ["converted", "Paying", activeSubscriptions],
  ];

  const funnel: FunnelStage[] = stageCounts.map(([key, label, count], index) => {
    const previous = index === 0 ? null : stageCounts[index - 1]![2];
    return {
      key,
      label,
      count,
      conversionFromPrevious: previous && previous > 0 ? count / previous : null,
    };
  });

  // MRR is the sum of what each subscription actually charges, never
  // `subscribers × today's price` — those diverge the moment the price changes,
  // and existing subscribers keep the price they signed up at.
  const revenue = await prisma.subscription.aggregate({
    where: { status: { in: ["ACTIVE", "TRIALING"] } },
    _sum: { amountCents: true },
  });

  return {
    funnel,
    recentRuns: recentRuns.map((run) => ({
      area: run.area,
      category: run.category,
      seen: run.businessesSeen,
      qualified: run.businessesQualified,
      at: run.finishedAt ?? run.createdAt,
    })),
    businesses,
    qualified,
    leadsByStatus,
    sitesByStatus,
    sitesTotal: Object.values(sitesByStatus).reduce((a, b) => a + b, 0),
    outreachSent: sum(outreachByStatus, SENT_STATUSES),
    outreachQueued: countOf(outreachByStatus, "QUEUED"),
    replies: countOf(outreachByStatus, "REPLIED"),
    /** Leads that ever converted, churn included. History, not revenue. */
    conversions: countOf(leadsByStatus, "CONVERTED"),
    /** Businesses paying right now. The number MRR is derived from. */
    activeSubscriptions,
    mrrCents: revenue._sum.amountCents ?? 0,
    suppressions,
  };
}
