"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Puts a reviewed revision over a paying customer's live page.
 *
 * Editing a live site leaves the live page alone and produces a new version,
 * so this is the step that actually swaps them. It only appears once the
 * revision has passed review, because the gate that stops unreviewed copy
 * reaching a real business's customers applies here too.
 */
export function PublishRevision({ slug, version }: { slug: string; version: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${slug}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Failed (${response.status})`);
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-md border border-signal/40 bg-signal/5 p-4">
      <p className="text-sm font-medium">Version {version} is approved and waiting</p>
      <p className="mt-1 text-xs text-ink-400">
        The customer is still seeing the version before it. Publishing swaps them.
      </p>
      {error && <p className="mt-2 text-xs text-alarm">{error}</p>}
      <button
        type="button"
        onClick={publish}
        disabled={busy}
        className="mt-3 rounded-md bg-signal px-3 py-2 text-sm font-medium text-ink-950 hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Publishing…" : `Publish version ${version}`}
      </button>
    </div>
  );
}
