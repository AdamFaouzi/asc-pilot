/**
 * Enriches leads from OpenStreetMap.
 *
 * Overture carries no opening hours and no amenities, which is why those
 * sections never render. OSM often has both, and Overpass is free. Three things
 * are pulled:
 *
 *   - opening hours, which the hours section needs to render at all;
 *   - amenities (outdoor seating, step-free access, wifi) — each one a fact
 *     someone recorded, never inferred from the category;
 *   - a `website` tag, which disqualifies the lead outright. Telling a business
 *     "you have no website" when they do is the worst outcome this pipeline
 *     has, so evidence of one always wins.
 *
 * Matching is conservative: one name must contain the other, within 150 metres.
 *
 *   npm run enrich:osm -- --dry-run
 */
import "dotenv/config";

import type { OpeningHour } from "../src/core/types";
import { prisma } from "../src/lib/db";
import { isDirectoryUrl, isSocialUrl } from "../src/core/website-check";
import { disqualifyLead, updateSiteContent } from "../src/pipeline/ops";

const DAY_INDEX: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const ORDER = [0, 1, 2, 3, 4, 5, 6];

/**
 * Parses the subset of OSM's `opening_hours` grammar that actually occurs in
 * this data: day ranges and lists, several time spans, and `24/7`. Anything
 * more exotic returns null and is skipped — wrong hours on a business's own
 * website are worse than no hours.
 */
export function parseOpeningHours(value: string): OpeningHour[] | null {
  const text = value.trim();
  if (!text) return null;
  if (text === "24/7") return ORDER.map((day) => ({ day, open: "00:00", close: "23:59" }));

  // A comma starts a new rule when the next chunk begins with a day name;
  // otherwise it separates time spans inside the current rule.
  const rules: string[] = [];
  for (const part of text.split(";")) {
    let carry = "";
    for (const chunk of part.split(/,(?=\s*[A-Za-z]{2}[\s,\-])/)) {
      const combined = carry ? `${carry},${chunk}` : chunk;
      // "Mo-Tu,Th-Fr 08:00-13:00" is one rule whose day list spans a comma:
      // a chunk with no time is a continuation, not a new rule.
      if (!/\d/.test(combined)) {
        carry = combined;
        continue;
      }
      rules.push(combined);
      carry = "";
    }
    if (carry) rules.push(carry);
  }

  const result: OpeningHour[] = [];

  for (const rule of rules) {
    const trimmed = rule.trim();
    if (!trimmed) continue;
    if (/off|closed|PH|SH|sunset|sunrise/i.test(trimmed)) continue;

    const match = trimmed.match(/^([A-Za-z,\-\s]*?)\s*([\d:,\-\s]+)$/);
    if (!match) return null;

    const [, dayPart, timePart] = match;
    const days: number[] = [];

    if (!dayPart?.trim()) {
      days.push(...ORDER);
    } else {
      for (const chunk of dayPart.split(",")) {
        const range = chunk.trim().match(/^([A-Za-z]{2})-([A-Za-z]{2})$/);
        if (range) {
          const from = DAY_INDEX[range[1]!];
          const to = DAY_INDEX[range[2]!];
          if (from === undefined || to === undefined) return null;
          for (let i = 0; i < 7; i += 1) {
            const day = (from + i) % 7;
            days.push(day);
            if (day === to) break;
          }
        } else {
          const single = DAY_INDEX[chunk.trim()];
          if (single === undefined) return null;
          days.push(single);
        }
      }
    }

    for (const span of (timePart ?? "").split(",")) {
      const times = span.trim().match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
      if (!times) return null;
      for (const day of days) result.push({ day, open: times[1]!, close: times[2]! });
    }
  }

  return result.length > 0 ? result : null;
}

/** OSM tags that map onto an amenity we have a bilingual label for. */
const AMENITY_TAGS: Array<[string, (value: string) => boolean]> = [
  ["outdoor_seating", (v) => v === "yes"],
  ["wheelchair", (v) => v === "yes" || v === "limited"],
  ["internet_access", (v) => v === "wlan" || v === "yes"],
  ["air_conditioning", (v) => v === "yes"],
  ["takeaway", (v) => v === "yes"],
  ["delivery", (v) => v === "yes"],
  ["diet:vegetarian", (v) => v === "yes" || v === "only"],
  ["diet:vegan", (v) => v === "yes" || v === "only"],
  ["payment:cards", (v) => v === "yes"],
  ["dog", (v) => v === "yes"],
  ["reservation", (v) => v === "yes" || v === "recommended"],
];

function amenitiesFrom(tags: Record<string, string>): string[] {
  return AMENITY_TAGS.filter(([key, ok]) => tags[key] && ok(tags[key]!)).map(([key]) => key);
}

function normalise(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9α-ω]+/g, "");
}

function metresBetween(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = (lon1 - lon2) * 111_000 * Math.cos((lat1 * Math.PI) / 180);
  const dy = (lat1 - lat2) * 111_000;
  return Math.hypot(dx, dy);
}

interface Poi {
  name: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

async function fetchPois(): Promise<Poi[]> {
  // Every named POI, not only those with hours: amenity and website tags live
  // on plenty of records that state no opening times.
  const query =
    "[out:json][timeout:180];(" +
    'node["name"](34.5,32.2,35.75,34.65);' +
    'way["name"](34.5,32.2,35.75,34.65););out center tags;';

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      // Overpass rejects requests without an identifying agent (406).
      "User-Agent": "ASC-Pilot/0.1 (lead enrichment)",
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ data: query }).toString(),
  });
  if (!response.ok) throw new Error(`Overpass returned ${response.status}`);

  const body = (await response.json()) as {
    elements: Array<{
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  return body.elements.flatMap((element) => {
    const tags = element.tags ?? {};
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    if (!lat || !lon || !tags.name) return [];
    return [{ name: tags.name, lat, lon, tags }];
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const leads = await prisma.lead.findMany({
    where: { sites: { some: { status: "PREVIEW" } } },
    include: {
      business: { select: { name: true, latitude: true, longitude: true } },
      sites: { where: { status: "PREVIEW" }, orderBy: { version: "desc" }, take: 1 },
    },
  });

  console.log("Fetching OpenStreetMap data for Cyprus…");
  const pois = await fetchPois();
  console.log(`${pois.length} named POIs\n`);

  let enriched = 0;
  let unparsed = 0;
  let disqualified = 0;

  for (const lead of leads) {
    const { name, latitude, longitude } = lead.business;
    const site = lead.sites[0];
    if (!site || latitude == null || longitude == null) continue;

    const target = normalise(name);
    let best: { poi: Poi; distance: number } | null = null;

    for (const poi of pois) {
      const distance = metresBetween(latitude, longitude, poi.lat, poi.lon);
      if (distance > 150) continue;

      const candidate = normalise(poi.name);
      if (!candidate || !target) continue;
      if (!candidate.includes(target) && !target.includes(candidate)) continue;

      if (!best || distance < best.distance) best = { poi, distance };
    }

    if (!best) continue;

    const tags = best.poi.tags;
    const website = tags.website ?? tags["contact:website"];

    // A Facebook page or a booking.com listing in the `website` tag is not a
    // website — it is exactly the social/directory presence that qualifies a
    // lead in the first place. Only a site of the business's own disqualifies.
    const realWebsite = website && !isSocialUrl(website) && !isDirectoryUrl(website) ? website : null;

    if (realWebsite) {
      disqualified += 1;
      console.log(`  ✗ ${name.slice(0, 32).padEnd(34)} has a website: ${realWebsite.slice(0, 40)}`);
      if (!dryRun) await disqualifyLead(lead.slug, `OpenStreetMap lists a website: ${realWebsite}`);
      continue;
    }

    const hours = tags.opening_hours ? parseOpeningHours(tags.opening_hours) : null;
    if (tags.opening_hours && !hours) {
      unparsed += 1;
      console.log(`  ? ${name.slice(0, 32).padEnd(34)} unparsed: ${tags.opening_hours.slice(0, 44)}`);
    }

    const amenities = amenitiesFrom(tags);
    if (!hours && amenities.length === 0) continue;

    enriched += 1;
    const summary = [hours ? "hours" : null, amenities.length ? `${amenities.length} amenities` : null]
      .filter(Boolean)
      .join(" + ");
    console.log(`  ✓ ${name.slice(0, 32).padEnd(34)} ${Math.round(best.distance)}m  ${summary}`);

    if (dryRun) continue;

    const content = site.content as Record<string, unknown> | null;
    if (!content) continue;

    await prisma.generatedSite.update({
      where: { id: site.id },
      data: {
        content: {
          ...content,
          ...(hours ? { hours } : {}),
          ...(amenities.length ? { amenities } : {}),
        } as never,
      },
    });
    // Re-render through the normal path so the page picks the new data up.
    await updateSiteContent(site.id, {});
  }

  console.log(
    `\n${dryRun ? "Would enrich" : "Enriched"} ${enriched} site(s).` +
      `\n${disqualified} lead(s) ${dryRun ? "would be " : ""}disqualified — OpenStreetMap lists a website.` +
      `\n${unparsed} had opening hours in a form we won't guess at.`,
  );
}

// Only run when invoked directly — importing this module (for the parser, say)
// must not fire off a live enrichment.
if (process.argv[1]?.includes("enrich-osm")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
