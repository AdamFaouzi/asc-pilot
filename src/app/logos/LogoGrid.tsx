"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export interface LogoCard {
  slug: string;
  siteId: string;
  businessName: string;
  category: string | null;
  logoUrl: string | null;
  facebookId: string | null;
}

/**
 * Accept or reject each site's logo in one pass.
 *
 * Hashing can spot Facebook's default avatar, but nothing in code can tell a
 * business's logo from a photo of the owner by a pool — and a snapshot dropped
 * in as a logo looks worse than the generated emblem. So this is a contact
 * sheet: every image at a glance, one click to drop the ones that aren't logos.
 */
export function LogoGrid({ cards }: { cards: LogoCard[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, "kept" | "dropped">>({});
  const [error, setError] = useState<string | null>(null);

  async function decide(card: LogoCard, keep: boolean) {
    setBusy(card.slug);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${card.slug}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          siteId: card.siteId,
          // Empty string clears the logo and restores the generated emblem.
          patch: { logoUrl: keep ? card.logoUrl : "" },
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Failed (${response.status})`);

      setDone((previous) => ({ ...previous, [card.slug]: keep ? "kept" : "dropped" }));
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

  const withLogo = cards.filter((card) => card.logoUrl);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Logos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-400">
          Each of these is the business&rsquo;s Facebook photo. Keep the ones that are actually a
          logo; drop the snapshots and they fall back to the generated emblem. {withLogo.length} of{" "}
          {cards.length} sites currently use one.
        </p>
        {error && <p className="mt-3 text-sm text-alarm">{error}</p>}
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card) => {
          const outcome = done[card.slug];
          return (
            <div
              key={card.slug}
              className={`rounded-lg border p-3 transition-colors ${
                outcome === "dropped" ? "border-ink-800 opacity-40" : "border-ink-800"
              }`}
            >
              <div className="flex h-28 items-center justify-center rounded bg-white">
                {card.logoUrl && outcome !== "dropped" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={card.logoUrl} alt="" className="max-h-24 max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-ink-700">generated emblem</span>
                )}
              </div>

              <p className="mt-2 truncate text-sm" title={card.businessName}>
                {card.businessName}
              </p>
              <p className="truncate font-mono text-xs text-ink-700">{card.category ?? "—"}</p>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy === card.slug || outcome === "dropped" || !card.logoUrl}
                  onClick={() => void decide(card, false)}
                  className="flex-1 rounded border border-ink-800 px-2 py-1.5 text-xs hover:border-alarm hover:text-alarm disabled:opacity-30"
                >
                  Not a logo
                </button>
                <a
                  href={`/s/preview/${card.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-ink-800 px-2 py-1.5 text-xs text-ink-400 hover:border-ink-400 hover:text-ink-200"
                >
                  View
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
