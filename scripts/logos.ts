/**
 * Applies each business's Facebook page photo as their site logo.
 *
 * The hard part is not fetching — it's telling a real logo from Facebook's
 * default placeholder, which is served byte-identically to every page that has
 * no picture. Hashing catches those: any image whose hash repeats across
 * different businesses cannot be a logo belonging to any of them.
 *
 *   npm run logos -- --dry-run     # report what would change
 *   npm run logos                  # apply
 *   npm run logos -- --clear       # remove logos, restore generated emblems
 */
import "dotenv/config";

import { createHash } from "node:crypto";

import { prisma } from "../src/lib/db";
import { updateSiteContent } from "../src/pipeline/ops";

/** Facebook's default page avatar, observed directly. */
const KNOWN_PLACEHOLDERS = new Set(["05987d758f7729d5e811b5c9e3db3931"]);

/** Below this, the response is an error page or a blank square, not a logo. */
const MIN_BYTES = 1500;

/** A hash shared by this many businesses is a default, not anyone's logo. */
const SHARED_HASH_THRESHOLD = 2;

interface Candidate {
  slug: string;
  siteId: string;
  businessName: string;
  facebookId: string;
  url: string;
  hash?: string;
  bytes?: number;
  skip?: string;
}

async function fetchImage(url: string): Promise<{ hash: string; bytes: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal });
    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    return { hash: createHash("md5").update(buffer).digest("hex"), bytes: buffer.byteLength };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const clear = process.argv.includes("--clear");

  const leads = await prisma.lead.findMany({
    where: { sites: { some: { status: { in: ["PREVIEW", "NEEDS_WORK"] } } } },
    include: {
      business: { select: { name: true, contacts: { where: { channel: "FACEBOOK" } } } },
      sites: { where: { status: { in: ["PREVIEW", "NEEDS_WORK"] } }, orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (clear) {
    let cleared = 0;
    for (const lead of leads) {
      const site = lead.sites[0];
      if (!site) continue;
      const content = site.content as { logoUrl?: string } | null;
      if (!content?.logoUrl) continue;
      if (!dryRun) await updateSiteContent(site.id, { logoUrl: "" });
      cleared += 1;
    }
    console.log(`${dryRun ? "Would clear" : "Cleared"} ${cleared} logo(s).`);
    return;
  }

  const candidates: Candidate[] = [];
  for (const lead of leads) {
    const site = lead.sites[0];
    const facebook = lead.business.contacts[0]?.value;
    const id = facebook?.match(/(\d{6,})/)?.[1];

    if (!site) continue;
    if (!id) {
      candidates.push({
        slug: lead.slug,
        siteId: "",
        businessName: lead.business.name,
        facebookId: "",
        url: "",
        skip: "no Facebook page",
      });
      continue;
    }

    candidates.push({
      slug: lead.slug,
      siteId: site.id,
      businessName: lead.business.name,
      facebookId: id,
      url: `https://graph.facebook.com/${id}/picture?type=large`,
    });
  }

  const fetchable = candidates.filter((entry) => !entry.skip);
  console.log(`Fetching ${fetchable.length} Facebook photos…\n`);

  // Sequential: this hits one host, and politeness costs a few seconds.
  for (const entry of fetchable) {
    const result = await fetchImage(entry.url);
    if (!result) {
      entry.skip = "fetch failed";
      continue;
    }
    entry.hash = result.hash;
    entry.bytes = result.bytes;
  }

  // Any hash seen for more than one business is a shared default.
  const frequency = new Map<string, number>();
  for (const entry of fetchable) {
    if (entry.hash) frequency.set(entry.hash, (frequency.get(entry.hash) ?? 0) + 1);
  }

  for (const entry of fetchable) {
    if (entry.skip) continue;
    if (!entry.hash) continue;

    if (KNOWN_PLACEHOLDERS.has(entry.hash)) entry.skip = "Facebook default avatar";
    else if ((frequency.get(entry.hash) ?? 0) >= SHARED_HASH_THRESHOLD)
      entry.skip = `shared image (${frequency.get(entry.hash)} businesses)`;
    else if ((entry.bytes ?? 0) < MIN_BYTES) entry.skip = `too small (${entry.bytes}b)`;
  }

  const apply = candidates.filter((entry) => !entry.skip);
  const skipped = candidates.filter((entry) => entry.skip);

  for (const entry of apply) {
    if (!dryRun) await updateSiteContent(entry.siteId, { logoUrl: entry.url });
    console.log(`  ✓ ${entry.businessName.slice(0, 40).padEnd(42)} ${entry.bytes}b`);
  }

  console.log(
    `\n${dryRun ? "Would apply" : "Applied"} ${apply.length} logo(s); ${skipped.length} kept the generated emblem.`,
  );

  const reasons = new Map<string, number>();
  for (const entry of skipped) reasons.set(entry.skip!, (reasons.get(entry.skip!) ?? 0) + 1);
  for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(3)}  ${reason}`);
  }

  if (!dryRun && apply.length > 0) {
    console.log(`\nThese sites now need reviewing again — the page changed.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
