/**
 * Re-checks the "no website" claim behind every lead that has a site waiting.
 *
 * The original discovery only probed businesses with a custom email domain, so
 * a business on a free mailbox qualified on nothing but Overture's silence.
 * This re-runs the check with name-derived domain guessing.
 *
 * Reports by default. Pass --apply to write the verdicts back.
 *
 *   npx tsx scripts/recheck-websites.ts [--apply]
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { getEnv } from "../src/lib/env";
import { checkWebsite } from "../src/core/website-check";
import { asJson } from "../src/lib/json";

async function main() {
  const apply = process.argv.includes("--apply");
  const env = getEnv();

  const sites = await prisma.generatedSite.findMany({
    where: { status: { in: ["PREVIEW", "NEEDS_WORK"] } },
    select: {
      lead: {
        select: {
          id: true,
          slug: true,
          business: {
            select: {
              id: true, name: true, phone: true, city: true,
              websiteUrl: true, websiteVerdict: true,
              contacts: { select: { channel: true, value: true } },
            },
          },
        },
      },
    },
  });

  console.log(`${apply ? "Applying" : "Reporting"} — ${sites.length} lead(s)\n`);
  const found: Array<{ slug: string; name: string; reason: string }> = [];
  let done = 0;

  for (const { lead } of sites) {
    const b = lead.business;
    const result = await checkWebsite(
      {
        source: "overture",
        sourceId: b.id,
        name: b.name,
        categories: [],
        phone: b.phone ?? undefined,
        address: b.city ? { city: b.city } : undefined,
        websiteUrl: b.websiteUrl ?? undefined,
        socials: b.contacts
          .filter((c) => c.channel === "FACEBOOK" || c.channel === "INSTAGRAM")
          .map((c) => c.value),
        emails: b.contacts.filter((c) => c.channel === "EMAIL").map((c) => c.value),
      } as never,
      { probe: env.WEBSITE_PROBE_ENABLED, timeoutMs: env.WEBSITE_PROBE_TIMEOUT_MS },
    );

    done += 1;
    if (done % 20 === 0) console.log(`  ${done}/${sites.length}…`);

    if (result.verdict !== "HAS_WEBSITE") continue;

    const reason = result.evidence.reasons[result.evidence.reasons.length - 1] ?? "";
    found.push({ slug: lead.slug, name: b.name, reason });

    if (apply) {
      await prisma.business.update({
        where: { id: b.id },
        data: { websiteVerdict: "HAS_WEBSITE", websiteEvidence: asJson(result.evidence), websiteCheckedAt: new Date() },
      });
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "DISQUALIFIED", reviewReason: `Already has a website — ${reason}` },
      });
    }
  }

  console.log(`\n${found.length} of ${sites.length} already have a website:\n`);
  for (const f of found) console.log(`  ${f.slug}\n    ${f.name} — ${f.reason}`);
  if (found.length > 0 && !apply) console.log("\nRe-run with --apply to disqualify these.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
