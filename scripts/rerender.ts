/**
 * Re-renders every deployed site from its stored content.
 *
 * Needed whenever something outside the business's own content changes — the
 * price on the offer banner, a template tweak, a new section. The price is
 * baked into the rendered HTML, so changing it in config is not enough on its
 * own.
 *
 * Reviews are preserved: this changes our chrome, not the business's page.
 *
 *   npm run rerender
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { getPlan } from "../src/providers/billing";
import { updateSiteContent } from "../src/pipeline/ops";

async function main() {
  const plan = await getPlan();
  console.log(`Price: ${plan.displayPrice} (${plan.fromStripe ? "from Stripe" : "fallback — Stripe not configured"})\n`);

  const sites = await prisma.generatedSite.findMany({
    where: { status: { in: ["PREVIEW", "NEEDS_WORK"] } },
    select: { id: true, lead: { select: { slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  let done = 0;
  let failed = 0;

  for (const site of sites) {
    try {
      await updateSiteContent(site.id, {}, { preserveReview: true });
      done += 1;
      if (done % 25 === 0) console.log(`  ${done}/${sites.length}…`);
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${site.lead.slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\nRe-rendered ${done}/${sites.length} site(s)${failed ? `, ${failed} failed` : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
