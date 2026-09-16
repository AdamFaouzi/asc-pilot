import { customEmailDomains } from "./website-check";
import type { PlaceResult } from "./types";

/**
 * Turning a place record into contact candidates.
 *
 * Confidence is not decoration: leads below the configured threshold go to
 * manual review instead of automated outreach, so the score decides whether a
 * human looks at a business before it gets emailed.
 */

export type ContactChannel = "EMAIL" | "PHONE" | "INSTAGRAM" | "FACEBOOK" | "WHATSAPP" | "CONTACT_FORM";

export interface ContactCandidate {
  channel: ContactChannel;
  value: string;
  source: string;
  /** How likely this reaches the business. Not a judgement on emailing them. */
  confidence: number;
  isPrimary: boolean;
  /** info@ / contact@ rather than a named person. */
  isRoleAddress: boolean;
  /** Mailbox provider rather than a domain the business owns. */
  isFreeMailbox: boolean;
}

/** Role addresses belong to the business, not to a named individual. */
const ROLE_PREFIXES = ["info", "contact", "hello", "enquiries", "inquiries", "office", "admin", "sales", "reservations", "bookings"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function scoreEmail(
  email: string,
  place: PlaceResult,
): { score: number; notes: string[]; isRole: boolean; isFree: boolean } {
  const notes: string[] = [];

  const [local, domain] = email.split("@");
  if (!local || !domain) return { score: 0, notes: ["malformed"], isRole: false, isFree: false };

  /*
   * Confidence answers one question only: will this address reach the
   * business? It is NOT a measure of whether emailing them is a good idea —
   * that is a separate, legal question, tracked by `isFreeMailbox` and
   * `isRoleAddress` so Phase 4 can gate on it explicitly.
   *
   * The distinction matters because it inverts. A business with no website
   * almost by definition uses a Gmail address, so penalising free mailboxes
   * would push exactly our target market below the review threshold while
   * promoting businesses that already have a site. Publication is what earns
   * the baseline: these addresses come from listings the business itself put up.
   */
  let score = 0.7;

  const isRole = ROLE_PREFIXES.some((prefix) => local.toLowerCase().startsWith(prefix));
  if (isRole) {
    score += 0.15;
    notes.push("role address");
  }

  const isFree = customEmailDomains([email]).length === 0;
  if (!isFree) {
    score += 0.05;
    notes.push("custom domain");
  } else {
    notes.push("free mailbox");
  }

  // Does the domain look like it belongs to this business?
  const nameTokens = place.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 4);
  const domainRoot = domain.toLowerCase().split(".")[0] ?? "";
  if (!isFree && nameTokens.some((token) => domainRoot.includes(token))) {
    score += 0.1;
    notes.push("domain matches business name");
  }

  return { score: Math.min(score, 1), notes, isRole, isFree };
}

export function extractContacts(place: PlaceResult): ContactCandidate[] {
  const contacts: ContactCandidate[] = [];

  const emails = (place.emails ?? [])
    .map((email) => email.trim().toLowerCase())
    .filter((email) => EMAIL_PATTERN.test(email))
    .filter((email, index, all) => all.indexOf(email) === index);

  const scored = emails
    .map((email) => ({ email, ...scoreEmail(email, place) }))
    .sort((a, b) => b.score - a.score);

  scored.forEach((entry, index) => {
    contacts.push({
      channel: "EMAIL",
      value: entry.email,
      source: `${place.source}:${entry.notes.join("+") || "listed"}`,
      confidence: entry.score,
      isPrimary: index === 0,
      isRoleAddress: entry.isRole,
      isFreeMailbox: entry.isFree,
    });
  });

  (place.phones ?? (place.phone ? [place.phone] : [])).forEach((phone, index) => {
    contacts.push({
      channel: "PHONE",
      value: phone,
      source: place.source,
      // Phones are reliable as data but aren't an outreach channel here.
      confidence: 0.7,
      isPrimary: index === 0,
      isRoleAddress: false,
      isFreeMailbox: false,
    });
  });

  (place.socials ?? []).forEach((url) => {
    const lower = url.toLowerCase();
    const channel: ContactChannel | null = lower.includes("instagram.com")
      ? "INSTAGRAM"
      : lower.includes("facebook.com") || lower.includes("fb.com")
        ? "FACEBOOK"
        : lower.includes("wa.me")
          ? "WHATSAPP"
          : null;

    if (!channel) return;

    contacts.push({
      channel,
      value: url,
      source: place.source,
      // Useful for generation and manual follow-up, not for automated email.
      confidence: 0.4,
      isPrimary: false,
      isRoleAddress: false,
      isFreeMailbox: false,
    });
  });

  return contacts;
}

export function bestEmail(contacts: ContactCandidate[]): ContactCandidate | undefined {
  return contacts
    .filter((contact) => contact.channel === "EMAIL")
    .sort((a, b) => b.confidence - a.confidence)[0];
}
