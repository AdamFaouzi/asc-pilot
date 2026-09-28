"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { ReviewCard } from "@/pipeline/review";

/**
 * Swipe through generated sites and accept or send back.
 *
 * The whole point is speed: the preview is right there, the decision is one
 * key, and the queue advances. Rejection takes a note because "needs work" with
 * no reason is useless a week later when you come back to fix it.
 */

type Outcome = "accept" | "reject";
type Order = "queue" | "near";

/** Kilometres between two points, good enough for ordering a review queue. */
function distanceKm(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): number {
  const R = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLon = ((to.lon - from.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Turns "coffee_shop" into "coffee shop", which is what a human reads. */
function readable(category: string): string {
  return category.replace(/_/g, " ");
}

const QUICK_NOTES = [
  "Wrong template for this business",
  "Copy is inaccurate",
  "Unverified claim needs removing",
  "Name or address wrong",
];

export function ReviewDeck({ cards }: { cards: ReviewCard[] }) {
  const [done, setDone] = useState<Array<{ siteId: string; slug: string; decision: Outcome }>>([]);
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [order, setOrder] = useState<Order>("queue");
  const [origin, setOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const categories = useMemo(
    () =>
      Array.from(new Set(cards.map((c) => c.category).filter((c): c is string => Boolean(c)))).sort(),
    [cards],
  );

  /*
   * A decided card leaves the queue rather than the queue advancing past it.
   * With filters in play an index would point at a different business every
   * time the filter changed, and the reviewer would lose their place.
   */
  const decided = useMemo(() => new Set(done.map((entry) => entry.siteId)), [done]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matching = cards.filter((c) => {
      if (decided.has(c.siteId)) return false;
      if (category && c.category !== category) return false;
      if (!needle) return true;
      return [c.businessName, c.city, c.category]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });

    if (order !== "near" || !origin) return matching;

    // Businesses with no coordinates sort last rather than disappearing.
    return [...matching].sort((a, b) => {
      const da = a.latitude != null && a.longitude != null
        ? distanceKm(origin, { lat: a.latitude, lon: a.longitude })
        : Infinity;
      const db = b.latitude != null && b.longitude != null
        ? distanceKm(origin, { lat: b.latitude, lon: b.longitude })
        : Infinity;
      return da - db;
    });
  }, [cards, decided, query, category, order, origin]);

  const card = visible[0];

  const away =
    card && origin && card.latitude != null && card.longitude != null
      ? distanceKm(origin, { lat: card.latitude, lon: card.longitude })
      : null;

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("This browser cannot share a location.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({ lat: position.coords.latitude, lon: position.coords.longitude });
        setOrder("near");
        setLocating(false);
      },
      () => {
        setLocationError("Location refused. Sorting by queue order instead.");
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }, []);

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

        setDone((previous) => [...previous, { siteId: card.siteId, slug: card.slug, decision }]);
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

  /*
   * Rendered above the deck and above the empty states alike. A search that
   * narrows to nothing must not take the search box away with it, or the only
   * way back is to start the query again.
   */
  const filterBar = (
  <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-800 px-6 py-2">
    <input
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="Search name, town, category"
      className="min-w-48 flex-1 rounded-md border border-ink-800 bg-ink-900 px-2 py-1.5 text-xs outline-none placeholder:text-ink-700 focus:border-ink-700"
    />

    <select
      value={category}
      onChange={(event) => setCategory(event.target.value)}
      className="rounded-md border border-ink-800 bg-ink-900 px-2 py-1.5 text-xs outline-none focus:border-ink-700"
    >
      <option value="">Every category</option>
      {categories.map((value) => (
        <option key={value} value={value}>
          {readable(value)}
        </option>
      ))}
    </select>

    {origin ? (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOrder("queue")}
          className={`rounded-md px-2 py-1.5 text-xs ${order === "queue" ? "bg-ink-800 text-ink-200" : "text-ink-400 hover:text-ink-200"}`}
        >
          Queue order
        </button>
        <button
          type="button"
          onClick={() => setOrder("near")}
          className={`rounded-md px-2 py-1.5 text-xs ${order === "near" ? "bg-ink-800 text-ink-200" : "text-ink-400 hover:text-ink-200"}`}
        >
          Nearest first
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="rounded-md border border-ink-800 px-2 py-1.5 text-xs text-ink-400 hover:text-ink-200 disabled:opacity-50"
      >
        {locating ? "Locating…" : "Sort by nearest"}
      </button>
    )}

    {locationError && <span className="text-xs text-caution">{locationError}</span>}
  </div>
  );

  const filtering = Boolean(query.trim() || category);

  if (!card && filtering) {
    return (
      <div className="flex h-screen flex-col">
        {filterBar}
        <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Nothing matches</h1>
        <p className="mt-3 text-sm text-ink-400">
          No site left to review for{" "}
          {[query.trim() && `"${query.trim()}"`, category && readable(category)]
            .filter(Boolean)
            .join(" in ")}
          .
        </p>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setCategory("");
          }}
          className="mt-8 rounded-md bg-ink-800 px-3 py-2 text-sm hover:bg-ink-700"
        >
            Clear the filter
          </button>
        </div>
      </div>
    );
  }

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
        <span className="shrink-0 text-right font-mono text-xs text-ink-400">
          {visible.length} left
          {away != null && <span className="ml-2 text-signal">{away.toFixed(1)} km</span>}
        </span>
      </header>

      {filterBar}

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
        {card.slug ? (
          <iframe
            key={card.siteId}
            src={`/s/preview/${card.slug}`}
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
              href={card.slug ? `/s/preview/${card.slug}` : "#"}
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
