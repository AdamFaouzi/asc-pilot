"use client";

import { useState } from "react";

/**
 * What the business owner sees.
 *
 * Written for someone who is not a web person, on a phone, in Greek: add
 * photos, set your hours, done. No account, no jargon, no way to break the
 * page — they can only supply content, never edit layout or copy.
 */

const DAYS = [
  { day: 1, el: "Δευτέρα", en: "Monday" },
  { day: 2, el: "Τρίτη", en: "Tuesday" },
  { day: 3, el: "Τετάρτη", en: "Wednesday" },
  { day: 4, el: "Πέμπτη", en: "Thursday" },
  { day: 5, el: "Παρασκευή", en: "Friday" },
  { day: 6, el: "Σάββατο", en: "Saturday" },
  { day: 0, el: "Κυριακή", en: "Sunday" },
];

interface HourRow {
  day: number;
  open: string;
  close: string;
  closed: boolean;
}

export function OwnerEditor({
  token,
  businessName,
  previewUrl,
  initialGallery,
  initialHours,
}: {
  token: string;
  businessName: string;
  previewUrl: string | null;
  initialGallery: string[];
  initialHours: Array<{ day: number; open: string; close: string }>;
}) {
  const [gallery, setGallery] = useState(initialGallery);
  const [hours, setHours] = useState<HourRow[]>(() =>
    DAYS.map(({ day }) => {
      const found = initialHours.find((entry) => entry.day === day);
      return {
        day,
        open: found?.open ?? "09:00",
        close: found?.close ?? "18:00",
        closed: !found,
      };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadPhotos(files: FileList) {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const body = new FormData();
      for (const url of gallery) body.append("keep", url);
      for (const file of Array.from(files).slice(0, 6 - gallery.length)) body.append("photos", file);

      const response = await fetch(`/api/my/${token}`, { method: "POST", body });
      const payload = (await response.json()) as { gallery?: string[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Upload failed");

      setGallery(payload.gallery ?? []);
      setMessage("Οι φωτογραφίες αποθηκεύτηκαν. / Photos saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(url: string) {
    setBusy(true);
    try {
      const body = new FormData();
      for (const kept of gallery.filter((entry) => entry !== url)) body.append("keep", kept);
      const response = await fetch(`/api/my/${token}`, { method: "POST", body });
      const payload = (await response.json()) as { gallery?: string[] };
      setGallery(payload.gallery ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function saveHours() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/my/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hours: hours
            .filter((row) => !row.closed)
            .map(({ day, open, close }) => ({ day, open, close })),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not save");
      }
      setMessage("Οι ώρες αποθηκεύτηκαν. / Opening hours saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{businessName}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          Προσθέστε φωτογραφίες και τις ώρες σας — η ιστοσελίδα σας ενημερώνεται αμέσως.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink-400">
          Add your photos and opening hours. Your website updates straight away.
        </p>
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-signal hover:opacity-80"
          >
            Δείτε την ιστοσελίδα σας / View your website ↗
          </a>
        )}
      </header>

      {message && <p className="mt-6 rounded-md border border-signal/30 bg-signal/5 px-4 py-2 text-sm text-signal">{message}</p>}
      {error && <p className="mt-6 rounded-md border border-alarm/30 bg-alarm/5 px-4 py-2 text-sm text-alarm">{error}</p>}

      <section className="mt-10">
        <h2 className="text-sm font-medium">Φωτογραφίες / Photos</h2>
        <p className="mt-1 text-xs text-ink-400">
          Έως 6. Η πρώτη είναι η κύρια. / Up to 6. The first one is the main photo.
        </p>

        {gallery.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((url, index) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-28 w-full rounded-lg border border-ink-800 object-cover" />
                <button
                  type="button"
                  onClick={() => void removePhoto(url)}
                  disabled={busy}
                  aria-label="Remove"
                  className="absolute right-2 top-2 rounded bg-ink-950/80 px-2 py-0.5 text-sm text-ink-200 hover:text-alarm"
                >
                  ×
                </button>
                {index === 0 && (
                  <span className="absolute bottom-2 left-2 rounded bg-ink-950/80 px-1.5 py-0.5 text-[10px] text-ink-400">
                    κύρια / main
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {gallery.length < 6 && (
          <label className="mt-4 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-ink-700 px-4 py-8 text-sm text-ink-400 hover:border-ink-400 hover:text-ink-200">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              className="hidden"
              onChange={(event) => {
                if (event.target.files?.length) void uploadPhotos(event.target.files);
                event.target.value = "";
              }}
            />
            {busy ? "…" : "Επιλέξτε φωτογραφίες / Choose photos"}
          </label>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-medium">Ώρες λειτουργίας / Opening hours</h2>

        <div className="mt-4 space-y-2">
          {hours.map((row, index) => {
            const label = DAYS.find((entry) => entry.day === row.day)!;
            return (
              <div key={row.day} className="flex flex-wrap items-center gap-3 border-b border-ink-800 pb-2">
                <span className="w-28 shrink-0 text-sm">{label.el}</span>
                <label className="flex items-center gap-2 text-xs text-ink-400">
                  <input
                    type="checkbox"
                    checked={!row.closed}
                    onChange={(event) =>
                      setHours((previous) =>
                        previous.map((entry, i) => (i === index ? { ...entry, closed: !event.target.checked } : entry)),
                      )
                    }
                  />
                  ανοιχτά
                </label>
                {!row.closed && (
                  <>
                    <input
                      type="time"
                      value={row.open}
                      onChange={(event) =>
                        setHours((previous) =>
                          previous.map((entry, i) => (i === index ? { ...entry, open: event.target.value } : entry)),
                        )
                      }
                      className="rounded-md border border-ink-800 bg-ink-900 px-2 py-1 text-sm"
                    />
                    <span className="text-ink-700">–</span>
                    <input
                      type="time"
                      value={row.close}
                      onChange={(event) =>
                        setHours((previous) =>
                          previous.map((entry, i) => (i === index ? { ...entry, close: event.target.value } : entry)),
                        )
                      }
                      className="rounded-md border border-ink-800 bg-ink-900 px-2 py-1 text-sm"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void saveHours()}
          disabled={busy}
          className="mt-4 rounded-md bg-signal px-4 py-2 text-sm font-medium text-ink-950 hover:opacity-90 disabled:opacity-40"
        >
          Αποθήκευση / Save hours
        </button>
      </section>
    </main>
  );
}
