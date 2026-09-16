"use client";

import { useCallback, useEffect, useState } from "react";

import type { ReviewCard } from "@/pipeline/review";

/**
 * Swipe through generated sites and accept or send back.
 *
 * The whole point is speed: the preview is right there, the decision is one
 * key, and the queue advances. Rejection takes a note because "needs work" with
 * no reason is useless a week later when you come back to fix it.
 */

type Outcome = "accept" | "reject";

const QUICK_NOTES = [
  "Wrong template for this business",
  "Copy is inaccurate",
  "Unverified claim needs removing",
  "Name or address wrong",
];

export function ReviewDeck({ cards }: { cards: ReviewCard[] }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Array<{ slug: string; decision: Outcome }>>([]);
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const card = cards[index];

  const submit = useCallback(
    async (decision: Outcome, reason?: string) => {
      if (!card || busy) return;
      setBusy(true);
      setError(null);

      try {
        const response = await fetch("/api/review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ siteId: card.siteId, decision, note: reason }),
        });

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? `Request failed (${response.status})`);
        }

        setDone((previous) => [...previous, { slug: card.slug, decision }]);
        setIndex((previous) => previous + 1);
        setNote("");
        setNoting(false);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setBusy(false);
      }
    },
    [card, busy],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      // Don't hijack typing in the note field.
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        if (event.key === "Escape") setNoting(false);
        return;
      }
      if (noting) return;

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        void submit("accept");
      } else if (event.key === "ArrowLeft" || event.key.toLowerCase() === "x") {
        event.preventDefault();
        setNoting(true);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, noting]);

  if (!card) {
    const accepted = done.filter((entry) => entry.decision === "accept").length;
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Queue clear</h1>
        <p className="mt-3 text-sm text-ink-400">
          {done.length === 0
            ? "Nothing is waiting for review. Generate some sites first."
            : `${accepted} accepted, ${done.length - accepted} sent back for work.`}
        </p>
        <div className="mt-8 flex justify-center gap-3 text-sm">
          <a href="/leads?status=APPROVED" className="rounded-md bg-ink-800 px-3 py-2 hover:bg-ink-700">
            Approved leads
          </a>
          <a href="/leads?status=NEEDS_REVIEW" className="rounded-md px-3 py-2 text-ink-400 hover:text-ink-200">
            Needs work
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center gap-4 border-b border-ink-800 px-6 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">{card.businessName}</h1>
          <p className="truncate font-mono text-xs text-ink-700">
            {[card.category, card.city, card.template].filter(Boolean).join(" · ")}
            {card.email ? ` · ${card.email}` : " · no email"}
          </p>
        </div>
        <span className="shrink-0 font-mono text-xs text-ink-400">
          {index + 1} / {cards.length}
        </span>
      </header>

      {card.unverifiedClaims.length > 0 && (
        <div className="shrink-0 border-b border-caution/30 bg-caution/5 px-6 py-2">
          {card.unverifiedClaims.map((claim) => (
            <p key={claim} className="text-xs text-caution">
              ⚠ {claim}
            </p>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 bg-ink-900">
        {card.previewUrl ? (
          <iframe
            key={card.siteId}
            src={card.previewUrl}
            title={`Preview of ${card.businessName}`}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <p className="p-6 text-sm text-ink-400">No preview URL on this site.</p>
        )}
      </div>

      <footer className="shrink-0 border-t border-ink-800 px-6 py-3">
        {error && <p className="mb-2 text-xs text-alarm">{error}</p>}

        {noting ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit("reject", note);
              }}
              placeholder="What needs fixing?"
              className="min-w-56 flex-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-caution"
            />
            {QUICK_NOTES.map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => void submit("reject", quick)}
                className="rounded-md border border-ink-800 px-2 py-1.5 text-xs text-ink-400 hover:border-caution hover:text-caution"
              >
                {quick}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setNoting(false)}
              className="px-2 py-1.5 text-xs text-ink-700 hover:text-ink-400"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setNoting(true)}
              className="rounded-md border border-ink-800 px-3 py-2 text-sm font-medium text-ink-200 hover:border-caution hover:text-caution disabled:opacity-40"
            >
              Needs work
              <span className="ml-2 font-mono text-xs text-ink-700">←</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit("accept")}
              className="rounded-md bg-signal px-3 py-2 text-sm font-medium text-ink-950 hover:opacity-90 disabled:opacity-40"
            >
              Accept
              <span className="ml-2 font-mono text-xs opacity-70">→</span>
            </button>
            <a
              href={card.previewUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-ink-400 hover:text-ink-200"
            >
              Open in new tab ↗
            </a>
          </div>
        )}
      </footer>
    </div>
  );
}
