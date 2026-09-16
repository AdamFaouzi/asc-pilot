import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tokens for the business owner's own edit link.
 *
 * The scaling insight this exists to serve: we cannot photograph 114 shops, and
 * no API sells a decent photo of a Paphos taverna. But the owner has photos on
 * their phone and cares more than we ever will — so the preview's job is to
 * earn a reply, and the pictures arrive from them afterwards.
 *
 * Signed rather than random so nothing has to be stored or looked up, and
 * scoped to one slug so a leaked link can only ever touch that one site. No
 * account, no password — asking a taverna owner to register would lose more
 * than it protects.
 */

const PURPOSE = "owner-edit";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`${PURPOSE}:${payload}`).digest("base64url");
}

export function createOwnerToken(slug: string, secret: string): string {
  const payload = Buffer.from(slug, "utf8").toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the slug the token was issued for, or null if it doesn't verify. */
export function verifyOwnerToken(token: string, secret: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const slug = Buffer.from(payload, "base64url").toString("utf8");
    return /^[a-z0-9-]+$/.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

export function ownerUrl(slug: string, appUrl: string, secret: string): string {
  return `${appUrl.replace(/\/$/, "")}/my/${createOwnerToken(slug, secret)}`;
}
