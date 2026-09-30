/**
 * Bulk-accepts the sites that assert nothing the generator could not source.
 *
 * The review queue exists because a generated page can state things about a
 * real business that were never in its input, and those go in
 * `unverifiedClaims`. A site with an empty list has nothing of that kind to
 * catch, so accepting it in bulk costs the operator nothing it would have
 * found by looking.
 *
 * Anything with a claim, and anything the fallback generator produced, is
 * left in the queue deliberately.
 *
 *   npx tsx scripts/accept-clean.ts [--apply]
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { reviewSite } from "../src/pipeline/review";

function claimsOf(assets: unknown): string[] {
  if (!assets || typeof assets !== "object") return [];
  const claims = (assets as { unverifiedClaims?: unknown }).unverifiedClaims;
  return Array.isArray(claims) ? claims.filter((c): c is string => typeof c === "string") : [];
}

async function main() {
  const apply = process.argv.includes("--apply");

  const sites = await prisma.generatedSite.findMany({
    where: {
      status: "PREVIEW",
      reviewedByHuman: false,
      // A lead ruled out for already having a website must not be accepted.
      lead: { status: { notIn: ["DISQUALIFIED", "DECLINED"] } },
    },
    select: { id: true, assets: true, lead: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  const clean = sites.filter((s) => claimsOf(s.assets).length === 0);
  const held = sites.length - clean.length;

  console.log(`unreviewed: ${sites.length}`);
  console.log(`  clean, accepting: ${clean.length}`);
  console.log(`  held for review:  ${held}`);

  if (!apply) {
    console.log("\nDry run. Re-run with --apply.");
    return;
  }

  let done = 0;
  for (const site of clean) {
    await reviewSite(site.id, "accept");
    done += 1;
    if (done % 20 === 0) console.log(`  ${done}/${clean.length}…`);
  }
  console.log(`\nAccepted ${done} site(s).`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
