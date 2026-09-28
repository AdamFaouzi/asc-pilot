"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SiteEntry {
  slug: string;
  businessName: string;
  category: string | null;
  city: string | null;
  template: string | null;
  status: string;
  version: number;
  url: string | null;
  reviewed: boolean;
  edited: boolean;
  leadStatus: string;
  claims: number;
}

/**
 * Browse every generated site.
 *
 * Distinct from /review, which is a decision queue of unreviewed sites only.
 * This is for looking: find a business, see its page, step to the next one.
 * Nothing here changes state.
 *
 * Filtering is client-side because the whole list is small and a keystroke that
 * waits on a round-trip doesn't feel like search.
 */

const STATUS_DOT: Record<string, string> = {
  LIVE: "bg-signal",
  PREVIEW: "bg-ink-400",
  NEEDS_WORK: "bg-caution",
  ARCHIVED: "bg-ink-800",
  FAILED: "bg-alarm",
};

/**
 * The states worth looking at as a group. "Approved" is the one that answers a
 * real question — which sites can actually be sold right now — because
 * checkout refuses anything a human has not reviewed.
 */
const VIEWS = [
  { key: "all", label: "All", test: () => true },
  {
    key: "approved",
    label: "Approved",
    test: (e: SiteEntry) => e.reviewed && e.status === "PREVIEW",
  },
  { key: "live", label: "Live", test: (e: SiteEntry) => e.status === "LIVE" },
  {
    key: "unreviewed",
    label: "Unreviewed",
    test: (e: SiteEntry) => !e.reviewed && e.status === "PREVIEW",
  },
  { key: "needs_work", label: "Needs work", test: (e: SiteEntry) => e.status === "NEEDS_WORK" },
] as const;

type ViewKey = (typeof VIEWS)[number]["key"];

function matches(entry: SiteEntry, query: string): boolean {
  if (!query) return true;
  const haystack = [
    entry.businessName,
    entry.slug,
    entry.category,
    entry.city,
    entry.template,
    entry.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Every term must appear somewhere, so "paphos bar" narrows rather than widens.
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}

export function SiteBrowser({ sites }: { sites: SiteEntry[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [index, setIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const test = VIEWS.find((v) => v.key === view)!.test;
  const visible = useMemo(
    () => sites.filter((site) => test(site) && matches(site, query)),
    [sites, query, test],
  );

  // Shown on the chips, so the counts are visible without clicking through.
  const counts = useMemo(
    () => Object.fromEntries(VIEWS.map((v) => [v.key, sites.filter(v.test).length])) as Record<ViewKey, number>,
    [sites],
  );
  const current = visible[Math.min(index, visible.length - 1)];

  // A narrowing search shouldn't leave the selection pointing off the end.
  useEffect(() => setIndex(0), [query, view]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (event.key === "Escape" && typing) {
        searchRef.current?.blur();
        return;
      }
      // Arrows step the list even while the search box has focus — searching
      // then moving through the hits is the whole point. "Down"/"Up" are the
      // legacy key names some environments still emit.
      const down = event.key === "ArrowDown" || event.key === "Down";
      const up = event.key === "ArrowUp" || event.key === "Up";
      if (typing && !down && !up) return;

      if (down || event.key === "j") {
        event.preventDefault();
        setIndex((previous) => Math.min(previous + 1, visible.length - 1));
      } else if (up || event.key === "k") {
        event.preventDefault();
        setIndex((previous) => Math.max(previous - 1, 0));
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible.length]);

  // Keep the selected row in view when moving by keyboard.
  useEffect(() => {
    listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-4 border-b border-ink-800 px-6 py-3">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-ink-400 hover:text-ink-200">
          ASC-Pilot
        </Link>
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, category, town…  (press /)"
          className="min-w-56 flex-1 rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-ink-400"
        />
        <span className="font-mono text-xs text-ink-700">
          {visible.length} of {sites.length}
        </span>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-ink-800 px-6 py-2">
        {VIEWS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setView(entry.key)}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              view === entry.key ? "bg-ink-800 text-ink-200" : "text-ink-400 hover:text-ink-200"
            }`}
          >
            {entry.label}
            <span className="ml-1.5 font-mono text-ink-700">{counts[entry.key]}</span>
          </button>
        ))}
        <span className="ml-auto flex gap-4">
          <Link href="/logos" className="text-xs text-ink-400 hover:text-ink-200">
            Logos →
          </Link>
          <Link href="/review" className="text-xs text-signal hover:opacity-80">
            Review queue →
          </Link>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <ul
          ref={listRef}
          className="w-72 shrink-0 overflow-y-auto border-r border-ink-800"
        >
          {visible.length === 0 && (
            <li className="px-4 py-6 text-sm text-ink-700">
              {query ? `No site matches “${query}”.` : "Nothing in this view yet."}
            </li>
          )}
          {visible.map((site, position) => {
            const selected = site.slug === current?.slug;
            return (
              <li key={site.slug}>
                <button
                  type="button"
                  data-selected={selected}
                  onClick={() => setIndex(position)}
                  className={`flex w-full items-start gap-3 border-b border-ink-800/60 px-4 py-3 text-left transition-colors ${
                    selected ? "bg-ink-800" : "hover:bg-ink-900"
                  }`}
                >
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${STATUS_DOT[site.status] ?? "bg-ink-700"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{site.businessName}</span>
                    <span className="block truncate font-mono text-xs text-ink-700">
                      {[site.category, site.city].filter(Boolean).join(" · ") || site.slug}
                    </span>
                  </span>
                  {site.claims > 0 && (
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-caution">⚠{site.claims}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex min-w-0 flex-1 flex-col">
          {current ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ink-800 px-6 py-2">
                <span className="truncate text-sm font-medium">{current.businessName}</span>
                <span className="font-mono text-xs text-ink-700">
                  v{current.version} · {current.template} · {current.status}
                </span>
                {current.reviewed && <span className="text-xs text-signal">reviewed</span>}
                {current.edited && <span className="text-xs text-ink-400">edited</span>}
                <span className="ml-auto flex items-center gap-4 text-xs">
                  <span className="font-mono text-ink-700">
                    {index + 1}/{visible.length} · ↑↓
                  </span>
                  <Link href={`/leads/${current.slug}`} className="text-ink-400 hover:text-ink-200">
                    Lead →
                  </Link>
                  {current.url && (
                    <a
                      href={current.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-ink-400 hover:text-ink-200"
                    >
                      Open ↗
                    </a>
                  )}
                </span>
              </div>

              {current.url ? (
                <iframe
                  key={current.slug}
                  src={current.url}
                  title={`Preview of ${current.businessName}`}
                  className="min-h-0 flex-1 border-0 bg-white"
                />
              ) : (
                <p className="p-6 text-sm text-ink-400">This site has no deployed URL.</p>
              )}
            </>
          ) : (
            <p className="p-6 text-sm text-ink-400">Nothing selected.</p>
          )}
        </div>
      </div>
    </div>
  );
}
