import Link from "next/link";
import { notFound } from "next/navigation";

import type { Localized, SiteContent } from "@/core/types";
import { ownerUrl } from "@/core/owner-token";
import { getEnv } from "@/lib/env";
import { leadDetail } from "@/pipeline/ops";

import { LeadActions } from "./LeadActions";
import { SiteEditor } from "./SiteEditor";

export const dynamic = "force-dynamic";

/**
 * Everything known about one lead, in the order you'd ask about it: who they
 * are, why they qualified, what was built, what was sent, what they pay.
 */

const STATUS_TONE: Record<string, string> = {
  NEW: "text-signal",
  APPROVED: "text-signal",
  CONVERTED: "text-signal",
  SITE_READY: "text-ink-50",
  NEEDS_REVIEW: "text-caution",
  OUTREACH_SENT: "text-ink-50",
  REPLIED: "text-signal",
  DISQUALIFIED: "text-ink-700",
  DECLINED: "text-ink-700",
};

function fmt(date: Date | null | undefined) {
  return date ? new Date(date).toISOString().slice(0, 16).replace("T", " ") : "—";
}

function claimsOf(assets: unknown): string[] {
  if (!assets || typeof assets !== "object") return [];
  const claims = (assets as { unverifiedClaims?: unknown }).unverifiedClaims;
  return Array.isArray(claims) ? claims.filter((c): c is string => typeof c === "string") : [];
}

export default async function LeadPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lead = await leadDetail(slug);
  if (!lead) notFound();

  const site = lead.sites[0];
  const content = site?.content as SiteContent | null;
  const evidence = lead.business.websiteEvidence as { reasons?: string[] } | null;
  const failed = lead.outreach.find((message) => message.status === "FAILED");

  // The link the business owner uses to add their own photos and hours.
  const secret = getEnv().UNSUBSCRIBE_SECRET;
  const ownerLink = secret ? ownerUrl(lead.slug, getEnv().APP_URL, secret) : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/leads" className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400 hover:text-ink-200">
        ← Leads
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{lead.business.name}</h1>
          <p className="mt-1 font-mono text-xs text-ink-700">
            {[lead.business.primaryCategory, lead.business.city, lead.slug].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={`font-mono text-sm ${STATUS_TONE[lead.status] ?? "text-ink-400"}`}>
          {lead.status}
        </span>
      </header>

      {lead.reviewReason && (
        <p className="mt-4 rounded-md border border-caution/30 bg-caution/5 px-4 py-2 text-sm text-caution">
          {lead.reviewReason}
        </p>
      )}

      <section className="mt-8">
        <h2 className="section-heading">Actions</h2>
        <LeadActions
          slug={lead.slug}
          status={lead.status}
          siteId={site?.id}
          siteReviewed={site?.reviewedByHuman}
          email={lead.primaryEmail}
          failedMessageId={failed?.id}
        />
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="section-heading">Business</h2>
          <Facts
            rows={[
              ["Address", lead.business.formattedAddress],
              ["Phone", lead.business.phone],
              ["Source", `${lead.business.source} · ${lead.business.sourceId.slice(0, 24)}`],
              ["Website verdict", lead.business.websiteVerdict],
              ["Checked", fmt(lead.business.websiteCheckedAt)],
              ["Found in run", lead.business.discoveryRun?.area ?? "—"],
            ]}
          />
          {evidence?.reasons && (
            <ul className="mt-3 space-y-1">
              {evidence.reasons.map((reason) => (
                <li key={reason} className="text-xs leading-relaxed text-ink-700">
                  · {reason}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="section-heading">Contacts</h2>
          {lead.business.contacts.length === 0 ? (
            <p className="text-sm text-ink-700">None discovered.</p>
          ) : (
            <ul className="space-y-2">
              {lead.business.contacts.map((contact) => (
                <li key={contact.id} className="flex items-baseline gap-3 border-b border-ink-800 pb-2">
                  <span className="w-20 shrink-0 font-mono text-xs text-ink-700">{contact.channel}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{contact.value}</span>
                  <span className="font-mono text-xs text-ink-400">{contact.confidence.toFixed(2)}</span>
                  {contact.isFreeMailbox && (
                    <span className="font-mono text-xs text-caution" title="Mailbox provider — more likely a natural person under GDPR">
                      free
                    </span>
                  )}
                  {contact.isRoleAddress && (
                    <span className="font-mono text-xs text-signal" title="Role address">
                      role
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {ownerLink && (
        <section className="mt-10">
          <h2 className="section-heading">Owner link</h2>
          <p className="mb-2 text-xs text-ink-700">
            Send this once they say yes — they add their own photos and opening hours, no account needed.
          </p>
          <code className="block overflow-x-auto rounded-md border border-ink-800 bg-ink-900 px-3 py-2 font-mono text-xs text-ink-400">
            {ownerLink}
          </code>
        </section>
      )}

      <section className="mt-10">
        <h2 className="section-heading">Sites</h2>
        {lead.sites.length === 0 ? (
          <p className="text-sm text-ink-700">Nothing generated yet.</p>
        ) : (
          <ul className="space-y-3">
            {lead.sites.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-ink-800 p-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-xs text-ink-700">v{entry.version}</span>
                  <span className="text-sm">{entry.status}</span>
                  <span className="font-mono text-xs text-ink-700">{entry.template}</span>
                  {entry.reviewedByHuman && <span className="text-xs text-signal">reviewed</span>}
                  {entry.editedByHuman && <span className="text-xs text-ink-400">edited</span>}
                  <span className="ml-auto font-mono text-xs text-ink-700">{fmt(entry.generatedAt)}</span>
                </div>
                {entry.previewUrl && (
                  <a
                    href={entry.liveUrl ?? entry.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs text-ink-400 underline decoration-ink-700 underline-offset-2 hover:text-ink-200"
                  >
                    {entry.liveUrl ?? entry.previewUrl}
                  </a>
                )}
                {entry.reviewNote && <p className="mt-2 text-xs text-caution">Sent back: {entry.reviewNote}</p>}
                {claimsOf(entry.assets).map((claim) => (
                  <p key={claim} className="mt-1 text-xs text-caution">⚠ {claim}</p>
                ))}
              </li>
            ))}
          </ul>
        )}

        {site && content && (
          <div className="mt-4">
            <SiteEditor
              slug={lead.slug}
              siteId={site.id}
              disabled={site.status === "LIVE"}
              facebookId={
                lead.business.contacts
                  .find((contact) => contact.channel === "FACEBOOK")
                  ?.value.match(/(\d{6,})/)?.[1]
              }
              initial={{
                logoUrl: content.logoUrl,
                gallery: (content.gallery ?? [])
                  .map((photo) => photo.url)
                  .filter((url): url is string => Boolean(url)),
                tagline: content.tagline as Localized | undefined,
                heroHeading: content.hero?.heading as Localized | undefined,
                heroSubheading: content.hero?.subheading as Localized | undefined,
                statement: content.statement as Localized | undefined,
                about: content.about as Localized | undefined,
              }}
            />
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="section-heading">Outreach</h2>
        {lead.outreach.length === 0 ? (
          <p className="text-sm text-ink-700">Nothing sent or queued.</p>
        ) : (
          <ul className="space-y-3">
            {lead.outreach.map((message) => (
              <li key={message.id} className="rounded-lg border border-ink-800 p-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="text-sm">{message.status}</span>
                  <span className="font-mono text-xs text-ink-400">{message.toAddress}</span>
                  <span className="ml-auto font-mono text-xs text-ink-700">{fmt(message.sentAt ?? message.queuedAt)}</span>
                </div>
                {message.subject && <p className="mt-1 text-xs text-ink-400">{message.subject}</p>}
                {message.blockedReason && <p className="mt-1 text-xs text-caution">{message.blockedReason}</p>}
                {message.error && <p className="mt-1 text-xs text-alarm">{message.error}</p>}
                {message.events.length > 0 && (
                  <p className="mt-2 font-mono text-xs text-ink-700">
                    {message.events.map((event) => event.type).join(" → ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {lead.subscription && (
        <section className="mt-10">
          <h2 className="section-heading">Subscription</h2>
          <Facts
            rows={[
              ["Status", lead.subscription.status],
              [
                "Amount",
                `${(lead.subscription.amountCents / 100).toFixed(2)} ${lead.subscription.currency.toUpperCase()}/${lead.subscription.interval}`,
              ],
              ["Stripe customer", lead.subscription.stripeCustomerId],
              ["Renews", fmt(lead.subscription.currentPeriodEnd)],
            ]}
          />
        </section>
      )}
    </main>
  );
}

function Facts({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-4 border-b border-ink-800 pb-2">
          <dt className="w-32 shrink-0 text-xs text-ink-700">{label}</dt>
          <dd className="min-w-0 flex-1 break-words text-sm">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
