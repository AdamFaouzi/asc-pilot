"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Manual interventions.
 *
 * Destructive-ish actions (disqualify, suppress) ask for a reason, because a
 * lead marked bad with no explanation is indistinguishable from a mistake when
 * you come back to it.
 */

type Action =
  | { action: "disqualify"; reason: string }
  | { action: "restore" }
  | { action: "regenerate" }
  | { action: "approve"; siteId: string }
  | { action: "reject"; siteId: string; note: string }
  | { action: "retry"; messageId: string }
  | { action: "suppress"; email: string; note: string };

export function LeadActions({
  slug,
  status,
  siteId,
  siteReviewed,
  email,
  failedMessageId,
}: {
  slug: string;
  status: string;
  siteId?: string;
  siteReviewed?: boolean;
  email?: string | null;
  failedMessageId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<{ kind: "disqualify" | "reject" | "suppress" } | null>(null);
  const [reason, setReason] = useState("");

  async function run(payload: Action) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/leads/${slug}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Failed (${response.status})`);

      setPrompt(null);
      setReason("");
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;
  const isDead = status === "DISQUALIFIED" || status === "DECLINED";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {siteId && !siteReviewed && (
          <Button onClick={() => void run({ action: "approve", siteId })} disabled={disabled} tone="go">
            Approve site
          </Button>
        )}
        {siteId && (
          <Button onClick={() => setPrompt({ kind: "reject" })} disabled={disabled}>
            Send back for work
          </Button>
        )}
        <Button onClick={() => void run({ action: "regenerate" })} disabled={disabled}>
          Regenerate site
        </Button>
        {failedMessageId && (
          <Button onClick={() => void run({ action: "retry", messageId: failedMessageId })} disabled={disabled}>
            Retry failed send
          </Button>
        )}
        {isDead ? (
          <Button onClick={() => void run({ action: "restore" })} disabled={disabled}>
            Restore lead
          </Button>
        ) : (
          <Button onClick={() => setPrompt({ kind: "disqualify" })} disabled={disabled} tone="stop">
            Mark bad / duplicate
          </Button>
        )}
        {email && (
          <Button onClick={() => setPrompt({ kind: "suppress" })} disabled={disabled} tone="stop">
            Never contact
          </Button>
        )}
      </div>

      {prompt && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              prompt.kind === "suppress" ? "Why suppress this address?" : "Reason (kept on the record)"
            }
            className="min-w-64 flex-1 rounded-md border border-ink-700 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-caution"
          />
          <Button
            disabled={disabled || reason.trim().length === 0}
            tone="stop"
            onClick={() => {
              if (prompt.kind === "disqualify") void run({ action: "disqualify", reason });
              else if (prompt.kind === "suppress" && email)
                void run({ action: "suppress", email, note: reason });
              else if (prompt.kind === "reject" && siteId)
                void run({ action: "reject", siteId, note: reason });
            }}
          >
            Confirm
          </Button>
          <button
            type="button"
            onClick={() => setPrompt(null)}
            className="px-2 py-1.5 text-xs text-ink-700 hover:text-ink-400"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-xs text-alarm">{error}</p>}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "go" | "stop";
}) {
  const toneClass =
    tone === "go"
      ? "bg-signal text-ink-950 hover:opacity-90"
      : tone === "stop"
        ? "border border-ink-800 text-ink-200 hover:border-alarm hover:text-alarm"
        : "border border-ink-800 text-ink-200 hover:border-ink-400";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
}
