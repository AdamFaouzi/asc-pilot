/**
 * Recomputes slugs for leads whose slug no longer reflects their name.
 *
 * Needed after a slugify change — the Greek transliteration fix turned a run of
 * "business", "business-2", "business-3" URLs into readable ones. Only touches
 * leads that have not been contacted yet, because a slug that has already gone
 * out in an email is a live URL someone may return to.
 *
 *   npm run reslug -- --dry-run
 */
import "dotenv/config";

import { uniqueSlug } from "../src/core/slug";
import { prisma } from "../src/lib/db";

const UNCONTACTED = ["NEW", "NEEDS_REVIEW", "SITE_GENERATING", "SITE_READY"] as const;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const leads = await prisma.lead.findMany({
    where: { status: { in: [...UNCONTACTED] } },
    include: { business: { select: { name: true, city: true } } },
  });

  let changed = 0;

  for (const lead of leads) {
    const desired = await uniqueSlug(
      lead.business.name,
      async (candidate) =>
        candidate !== lead.slug &&
        (await prisma.lead.count({ where: { slug: candidate } })) > 0,
      lead.business.city ?? undefined,
    );

    if (desired === lead.slug) continue;

    changed += 1;
    console.log(`${lead.slug}  →  ${desired}   (${lead.business.name})`);

    if (!dryRun) {
      await prisma.lead.update({ where: { id: lead.id }, data: { slug: desired } });
    }
  }

  console.log(`\n${changed} slug(s) ${dryRun ? "would change" : "updated"} of ${leads.length} leads.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
