"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { Localized } from "@/core/types";

/**
 * Edits the copy on a generated site.
 *
 * Only text fields are editable — layout, palette, and structure stay with the
 * templates, so an edit can't produce a broken page. Saving re-renders and
 * redeploys, and deliberately clears the review flag: the page changed, so the
 * previous approval no longer describes what's there.
 *
 * On a live site the save creates a new version rather than altering the page
 * a customer is paying for. It goes through review like anything else, then
 * Publish puts it over the live one.
 */

interface Fields {
  tagline?: Localized;
  heroHeading?: Localized;
  heroSubheading?: Localized;
  statement?: Localized;
  about?: Localized;
}

const LABELS: Array<{ key: keyof Fields; label: string; hint: string; long?: boolean }> = [
  { key: "tagline", label: "Tagline", hint: "Small text above the name" },
  { key: "heroHeading", label: "Heading", hint: "Usually the business name" },
  { key: "heroSubheading", label: "Subheading", hint: "One sentence under the name" },
  { key: "statement", label: "Statement", hint: "The large-type line further down", long: true },
  { key: "about", label: "About", hint: "Two or three sentences", long: true },
];

export function SiteEditor({
  slug,
  siteId,
  initial,
  live,
  facebookId,
}: {
  slug: string;
  siteId: string;
  initial: Fields & { logoUrl?: string; gallery?: string[] };
  /** The page a customer is paying for, so a save becomes a new version. */
  live?: boolean;
  /** Numeric Facebook page id, when the business has one listed. */
  facebookId?: string;
}) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(initial);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [gallery, setGallery] = useState<string[]>(initial.gallery ?? []);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function set(key: keyof Fields, locale: "el" | "en", value: string) {
    setFields((previous) => ({
      ...previous,
      [key]: { el: "", en: "", ...previous[key], [locale]: value },
    }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${slug}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "edit", siteId, patch: { ...fields, logoUrl, gallery } }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Failed (${response.status})`);

      setSaved(true);
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-ink-800 px-3 py-2 text-sm font-medium hover:border-ink-400"
      >
        Edit copy
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-ink-800 p-4">
      <div>
        <div className="flex items-baseline justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-ink-400">Logo</label>
          <span className="text-xs text-ink-700">
            Image URL. Leave blank to use the generated emblem.
          </span>
        </div>
        <input
          value={logoUrl}
          onChange={(event) => {
            setLogoUrl(event.target.value);
            setSaved(false);
          }}
          placeholder="https://…  or a data: URI"
          className="mt-2 w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-ink-400"
        />
        {facebookId && (
          <button
            type="button"
            onClick={() => {
              setLogoUrl(`https://graph.facebook.com/${facebookId}/picture?type=large`);
              setSaved(false);
            }}
            className="mt-2 text-xs text-ink-400 underline decoration-ink-700 underline-offset-2 hover:text-ink-200"
          >
            Use their Facebook photo
          </button>
        )}
        {logoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoUrl}
            alt=""
            className="mt-3 max-h-16 rounded border border-ink-800 bg-white p-2"
          />
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label className="text-xs font-medium uppercase tracking-wider text-ink-400">Photos</label>
          <span className="text-xs text-ink-700">
            Your own shots of the place. Up to 6, JPEG/PNG/WebP.
          </span>
        </div>

        {gallery.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {gallery.map((url, index) => (
              <div key={url} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-full rounded border border-ink-800 object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => {
                    setGallery((previous) => previous.filter((_, i) => i !== index));
                    setSaved(false);
                  }}
                  className="absolute right-1 top-1 rounded bg-ink-950/80 px-1.5 text-xs text-ink-200 hover:text-alarm"
                >
                  ×
                </button>
                {index === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-ink-950/80 px-1 text-[10px] text-ink-400">
                    main
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={uploading || gallery.length >= 6}
          onChange={async (event) => {
            const files = event.target.files;
            if (!files?.length) return;

            setUploading(true);
            setError(null);
            try {
              const body = new FormData();
              for (const file of Array.from(files).slice(0, 6 - gallery.length)) {
                body.append("photos", file);
              }
              const response = await fetch(`/api/leads/${slug}/photos`, { method: "POST", body });
              const payload = (await response.json()) as { urls?: string[]; error?: string };
              if (!response.ok) throw new Error(payload.error ?? "Upload failed");

              setGallery((previous) => [...previous, ...(payload.urls ?? [])].slice(0, 6));
              setSaved(false);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : String(caught));
            } finally {
              setUploading(false);
              event.target.value = "";
            }
          }}
          className="mt-3 block w-full text-xs text-ink-400 file:mr-3 file:rounded-md file:border-0 file:bg-ink-800 file:px-3 file:py-2 file:text-sm file:text-ink-50 hover:file:bg-ink-700 disabled:opacity-40"
        />
        {uploading && <p className="mt-2 text-xs text-ink-400">Uploading…</p>}
        <p className="mt-2 text-xs text-ink-700">
          The first photo runs wide across the gallery. Saving redeploys the site.
        </p>
      </div>

      {LABELS.map(({ key, label, hint, long }) => (
        <div key={key}>
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</label>
            <span className="text-xs text-ink-700">{hint}</span>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["el", "en"] as const).map((locale) => {
              const shared = {
                value: fields[key]?.[locale] ?? "",
                className:
                  "mt-1 w-full rounded-md border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-ink-400",
              };

              return (
                <div key={locale}>
                  <span className="font-mono text-xs text-ink-700">{locale.toUpperCase()}</span>
                  {long ? (
                    <textarea
                      {...shared}
                      rows={3}
                      onChange={(event) => set(key, locale, event.target.value)}
                    />
                  ) : (
                    <input {...shared} onChange={(event) => set(key, locale, event.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {error && <p className="text-xs text-alarm">{error}</p>}
      {saved && (
        <p className="text-xs text-signal">
          Saved and redeployed. The site needs reviewing again before it can be sent.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy}
          className="rounded-md bg-signal px-3 py-2 text-sm font-medium text-ink-950 hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save and redeploy"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 text-sm text-ink-400 hover:text-ink-200"
        >
          Close
        </button>
      </div>
    </div>
  );
}
