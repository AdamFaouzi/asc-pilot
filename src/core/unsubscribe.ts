import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Unsubscribe tokens.
 *
 * Signed rather than random so opt-out links can't be forged or enumerated, and
 * so the link keeps working even if the outreach row is later rewritten. The
 * token carries the recipient address, because suppression is keyed by address
 * — an opt-out has to survive re-discovering the same business next month.
 */

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createUnsubscribeToken(email: string, secret: string): string {
  const payload = Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the email the token was issued for, or null if it doesn't verify. */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  // Constant-time compare; timingSafeEqual throws on length mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}

export function unsubscribeUrl(email: string, appUrl: string, secret: string): string {
  const token = createUnsubscribeToken(email, secret);
  return `${appUrl.replace(/\/$/, "")}/unsubscribe?t=${encodeURIComponent(token)}`;
}
