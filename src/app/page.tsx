import Link from "next/link";

import { getPlan } from "@/providers/billing";
import { getEnv, integrationStatus } from "@/lib/env";
import { getPipelineStats, type PipelineStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Phase 1 operator view: is the pipeline wired up, and what is in it?
 * Phase 6 grows this into the full ops dashboard (per-lead drill-down, manual
 * intervention); for now it exists to prove config and database are live.
 */

export default async function Home() {
  const env = getEnv();
  const integrations = integrationStatus();
  const plan = await getPlan();

  let stats: PipelineStats | null = null;
  let dbError: string | null = null;

  try {
    stats = await getPipelineStats();
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400">ASC-Pilot</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Businesses without a website, each with a site built for them and an offer to make it live at{" "}
          {plan.displayPrice}.
        </p>
      </header>

      {dbError ? (
        <section className="mb-12 rounded-lg border border-alarm/30 bg-alarm/5 p-5">
          <h2 className="text-sm font-medium text-alarm">Database unreachable</h2>
          <p className="mt-2 text-sm text-ink-400">
            Start Postgres with <code className="font-mono text-ink-200">npm run db:up</code>, then apply the
            schema with <code className="font-mono text-ink-200">npm run db:migrate</code>.
          </p>
          <p className="mt-3 font-mono text-xs text-ink-700">{dbError}</p>
        </section>
      ) : (
        stats && <PipelineSummary stats={stats} />
      )}

      <section className="mt-12">
        <h2 className="text-sm font-medium text-ink-200">Setup</h2>
        <ul className="mt-4 divide-y divide-ink-800 border-y border-ink-800">
          {integrations.map((integration) => (
            <li key={integration.key} className="flex items-center gap-4 py-3">
              <span
                className={`size-1.5 rounded-full ${integration.configured ? "bg-signal" : "bg-ink-700"}`}
                aria-hidden
              />
              <span className="flex-1 text-sm">{integration.label}</span>
              <span className="font-mono text-xs text-ink-700">Phase {integration.phase}</span>
              <span className={`w-24 text-right text-xs ${integration.configured ? "text-signal" : "text-ink-400"}`}>
                {integration.configured ? "configured" : "not set"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-lg border border-ink-800 p-5">
        <div className="flex items-center gap-3">
          <span
            className={`size-1.5 rounded-full ${env.OUTREACH_ENABLED ? "bg-caution" : "bg-ink-700"}`}
            aria-hidden
          />
          <h2 className="text-sm font-medium">
            Outreach is {env.OUTREACH_ENABLED ? "enabled" : "disabled"}
          </h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          {env.OUTREACH_ENABLED
            ? `Sending is live: max ${env.OUTREACH_DAILY_LIMIT}/day, at least ${env.OUTREACH_MIN_INTERVAL_SECONDS}s apart.`
            : "No message can leave the system. Keep it off until the GDPR/ePrivacy review in docs/COMPLIANCE.md is signed off."}
        </p>
      </section>
    </main>
  );
}

function PipelineSummary({ stats }: { stats: PipelineStats }) {
  const widest = Math.max(...stats.funnel.map((stage) => stage.count), 1);

  return (
    <>
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-800 bg-ink-800 sm:grid-cols-4">
        <Metric label="Businesses found" value={stats.businesses} />
        <Metric label="Sites built" value={stats.sitesTotal} />
        <Metric label="Contacted" value={stats.outreachSent} />
        <Metric label="MRR" value={`€${(stats.mrrCents / 100).toFixed(0)}`} />
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink-200">Pipeline</h2>
          <span className="flex gap-4 text-xs">
            <Link href="/sites" className="text-ink-400 hover:text-ink-200">
              Browse sites →
            </Link>
            <Link href="/logos" className="text-ink-400 hover:text-ink-200">
              Logos →
            </Link>
            <Link href="/review" className="text-signal hover:opacity-80">
              Review sites →
            </Link>
            <Link href="/leads" className="text-ink-400 hover:text-ink-200">
              All leads →
            </Link>
          </span>
        </div>

        <ul className="mt-4 space-y-2">
          {stats.funnel.map((stage) => (
            <li key={stage.key} className="flex items-center gap-4">
              <span className="w-36 shrink-0 text-sm text-ink-400">{stage.label}</span>
              <span className="relative h-6 flex-1 overflow-hidden rounded bg-ink-900">
                <span
                  className="absolute inset-y-0 left-0 rounded bg-ink-700"
                  style={{ width: `${Math.max((stage.count / widest) * 100, stage.count > 0 ? 1.5 : 0)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">{stage.count}</span>
              <span className="w-14 shrink-0 text-right font-mono text-xs text-ink-700">
                {stage.conversionFromPrevious === null
                  ? ""
                  : `${(stage.conversionFromPrevious * 100).toFixed(0)}%`}
              </span>
            </li>
          ))}
        </ul>

        {stats.outreachQueued > 0 && (
          <p className="mt-4 text-xs text-ink-700">{stats.outreachQueued} message(s) queued.</p>
        )}
        {stats.suppressions > 0 && (
          <p className="mt-1 text-xs text-ink-700">{stats.suppressions} address(es) opted out.</p>
        )}
      </section>

      {stats.recentRuns.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium text-ink-200">Recent scans</h2>
          <ul className="mt-4 space-y-2">
            {stats.recentRuns.map((run, index) => (
              <li
                key={`${run.area}-${index}`}
                className="flex items-baseline gap-4 border-b border-ink-800 pb-2 text-sm"
              >
                <span className="flex-1">{run.area}</span>
                <span className="text-ink-400">{run.category ?? "all categories"}</span>
                <span className="font-mono text-xs text-ink-700">
                  {run.qualified}/{run.seen} qualified
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-ink-950 p-5">
      <p className="text-xs text-ink-400">{label}</p>
      <p className="mt-2 font-mono text-2xl tabular-nums">{value}</p>
    </div>
  );
}
