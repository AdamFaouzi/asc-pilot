import type { PlaceResult } from "./types";

/**
 * Deciding whether a business really has no website.
 *
 * A missing website field in an open dataset is a weaker signal than a missing
 * one in Google's data — Overture inherits the field rather than maintaining
 * it, so "no website listed" sometimes means "nobody recorded one". Emailing a
 * business that already has a site is the worst outcome for this product: it
 * makes the pitch look automated and wrong.
 *
 * The cheapest strong signal available for free is the business's own email
 * domain. `info@emilysbeauty.com.cy` implies somebody bought that domain, and
 * a domain that serves a page is a website whatever the dataset says.
 */

export type WebsiteVerdict =
  | "UNKNOWN"
  | "NONE"
  | "SOCIAL_ONLY"
  | "DIRECTORY_ONLY"
  | "HAS_WEBSITE";

export interface WebsiteEvidence {
  /** Human-readable reasons, in the order they were established. */
  reasons: string[];
  listedWebsites?: string[];
  /** Custom domains extracted from the business's email addresses. */
  emailDomains?: string[];
  /** Domains that answered an HTTP request. */
  liveDomains?: string[];
  socials?: string[];
  probedAt?: string;
}

export interface WebsiteCheckResult {
  verdict: WebsiteVerdict;
  evidence: WebsiteEvidence;
}

/**
 * Mailbox providers. An address at one of these tells us nothing about whether
 * the business has a site, so these domains are never probed.
 */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.gr",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.gr",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "aol.com",
  "gmx.com",
  "mail.ru",
  "yandex.ru",
  "protonmail.com",
  "proton.me",
  "cytanet.com.cy",
  "cablenet.com.cy",
  "primehome.com",
  "spidernet.com.cy",
]);

/**
 * Hosts that are a listing about a business rather than a site belonging to it.
 * A business whose only "website" is a Facebook page is still a lead.
 */
const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "linkedin.com",
  "youtube.com",
  "wa.me",
  "t.me",
];

const DIRECTORY_HOSTS = [
  "yelp.com",
  "tripadvisor.com",
  "booking.com",
  "foursquare.com",
  "yellowpages.com.cy",
  "cyprusyellowpages.com",
  "deliveroo.com",
  "wolt.com",
  "foody.com.cy",
  "google.com",
  "goo.gl",
  "linktr.ee",
  "bit.ly",
];

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function matchesAny(host: string, list: string[]): boolean {
  return list.some((entry) => host === entry || host.endsWith(`.${entry}`));
}

export function isSocialUrl(url: string): boolean {
  const host = hostOf(url);
  return host ? matchesAny(host, SOCIAL_HOSTS) : false;
}

export function isDirectoryUrl(url: string): boolean {
  const host = hostOf(url);
  return host ? matchesAny(host, DIRECTORY_HOSTS) : false;
}

/** Custom (non-mailbox-provider) domains from a business's email addresses. */
export function customEmailDomains(emails: string[] | undefined): string[] {
  if (!emails?.length) return [];

  const domains = emails
    .map((email) => email.split("@")[1]?.toLowerCase().trim())
    .filter((domain): domain is string => Boolean(domain))
    .filter((domain) => !FREE_EMAIL_DOMAINS.has(domain));

  return [...new Set(domains)];
}

/**
 * Classifies without any network access. This is the whole decision when
 * `WEBSITE_PROBE_ENABLED` is off.
 */
export function classifyOffline(place: PlaceResult): WebsiteCheckResult {
  const reasons: string[] = [];
  const listed = [place.websiteUrl, ...(place.socials ?? [])].filter(
    (value): value is string => Boolean(value),
  );

  const realSites = (place.websiteUrl ? [place.websiteUrl] : []).filter(
    (url) => !isSocialUrl(url) && !isDirectoryUrl(url),
  );

  if (realSites.length > 0) {
    reasons.push(`Source lists a website: ${realSites.join(", ")}`);
    return {
      verdict: "HAS_WEBSITE",
      evidence: { reasons, listedWebsites: realSites, socials: place.socials },
    };
  }

  if (place.websiteUrl && isDirectoryUrl(place.websiteUrl)) {
    reasons.push(`Only listed URL is a directory page: ${place.websiteUrl}`);
    return {
      verdict: "DIRECTORY_ONLY",
      evidence: { reasons, listedWebsites: [place.websiteUrl], socials: place.socials },
    };
  }

  const emailDomains = customEmailDomains(place.emails);
  if (emailDomains.length > 0) {
    // Not conclusive on its own — the domain might only handle mail. The probe
    // step resolves it; offline we flag rather than guess.
    reasons.push(`Email uses custom domain(s): ${emailDomains.join(", ")} — needs a probe to confirm`);
    return { verdict: "UNKNOWN", evidence: { reasons, emailDomains, socials: place.socials } };
  }

  const socials = (place.socials ?? []).filter(isSocialUrl);
  if (socials.length > 0) {
    reasons.push("No website; social profile only");
    return { verdict: "SOCIAL_ONLY", evidence: { reasons, socials } };
  }

  reasons.push("No website, no custom email domain, no social profile");
  return { verdict: "NONE", evidence: { reasons, listedWebsites: listed.length ? listed : undefined } };
}

/**
 * What a domain does when you ask it for a page.
 *
 * The distinction that matters is not "did it return 200" but "did anything
 * answer at all". A domain bought purely for email fails to connect; a domain
 * that answers with 403 is running a web server behind bot protection, which
 * almost always means the business has a site. Treating 403 as "no page" is how
 * you end up emailing someone their own website doesn't exist.
 */
export type ProbeOutcome =
  /** A page loaded. The business has a website. */
  | "live"
  /** Something answered, but we can't read it — blocked, 404, or erroring. */
  | "responded"
  /** Nothing answered: DNS failure, refused connection, or timeout. */
  | "silent";

export interface ProbeResult {
  domain: string;
  outcome: ProbeOutcome;
  status?: number;
}

export async function probeDomain(domain: string, timeoutMs: number): Promise<ProbeResult> {
  let sawResponse: number | undefined;

  for (const url of [`https://${domain}`, `http://${domain}`]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          // Identify honestly. Some hosts block unknown agents, which is
          // precisely the "responded" case handled below.
          "User-Agent": "ASC-Pilot/0.1 (+website availability check)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      if (response.ok) return { domain, outcome: "live", status: response.status };

      // A server answered. Remember it and try the other scheme.
      sawResponse = response.status;
    } catch {
      // DNS failure, TLS error, refused, or timeout — try the next scheme.
    } finally {
      clearTimeout(timer);
    }
  }

  return sawResponse === undefined
    ? { domain, outcome: "silent" }
    : { domain, outcome: "responded", status: sawResponse };
}

/**
 * Full check: offline classification, then an HTTP probe for the UNKNOWN cases
 * where a custom email domain might or might not host a site.
 */
export async function checkWebsite(
  place: PlaceResult,
  options: { probe: boolean; timeoutMs: number },
): Promise<WebsiteCheckResult> {
  const offline = classifyOffline(place);

  if (offline.verdict !== "UNKNOWN" || !options.probe) {
    // An unresolved UNKNOWN must not look like a qualified lead.
    if (offline.verdict === "UNKNOWN" && !options.probe) {
      return {
        verdict: "UNKNOWN",
        evidence: {
          ...offline.evidence,
          reasons: [...offline.evidence.reasons, "Probe disabled — left for manual review"],
        },
      };
    }
    return offline;
  }

  const domains = offline.evidence.emailDomains ?? [];
  const results: ProbeResult[] = [];

  for (const domain of domains) {
    results.push(await probeDomain(domain, options.timeoutMs));
  }

  const live = results.filter((result) => result.outcome === "live");
  const responded = results.filter((result) => result.outcome === "responded");

  const evidence: WebsiteEvidence = {
    ...offline.evidence,
    liveDomains: live.map((result) => result.domain),
    probedAt: new Date().toISOString(),
  };

  if (live.length > 0) {
    return {
      verdict: "HAS_WEBSITE",
      evidence: {
        ...evidence,
        reasons: [...evidence.reasons, `Domain serves a live page: ${live.map((r) => r.domain).join(", ")}`],
      },
    };
  }

  if (responded.length > 0) {
    // A web server exists but wouldn't show us the page. Too likely to be a
    // real website to pitch, too uncertain to discard — a human decides.
    return {
      verdict: "UNKNOWN",
      evidence: {
        ...evidence,
        reasons: [
          ...evidence.reasons,
          `Domain answered but blocked the check (${responded
            .map((r) => `${r.domain}: HTTP ${r.status}`)
            .join(", ")}) — a web server is running, so verify by hand before pitching`,
        ],
      },
    };
  }

  const socials = (place.socials ?? []).filter(isSocialUrl);
  return {
    verdict: socials.length > 0 ? "SOCIAL_ONLY" : "NONE",
    evidence: {
      ...evidence,
      socials,
      reasons: [
        ...evidence.reasons,
        `Custom domain(s) did not answer at all: ${domains.join(", ")} — mail-only domain`,
      ],
    },
  };
}
