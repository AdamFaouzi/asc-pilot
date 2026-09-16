/**
 * How many qualified leads would get a real category label rather than the
 * generic "Τοπική επιχείρηση" fallback. A generic hero is the single loudest
 * signal that a page was mass-produced, so this is worth watching.
 *
 *   npm run coverage
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { hasGlyph } from "../src/site/glyphs";
import { hasCategoryLabel } from "../src/site/i18n";

async function main() {
  const rows = await prisma.business.groupBy({
    by: ["primaryCategory"],
    _count: { _all: true },
    where: { lead: { status: { in: ["NEW", "NEEDS_REVIEW", "SITE_READY", "APPROVED"] } } },
  });

  let labelled = 0;
  let generic = 0;
  let glyphed = 0;
  const missing: Array<[string, number]> = [];
  const noGlyph: Array<[string, number]> = [];

  for (const row of rows) {
    const count = row._count._all;
    if (hasCategoryLabel(row.primaryCategory ?? undefined)) labelled += count;
    else {
      generic += count;
      missing.push([row.primaryCategory ?? "(none)", count]);
    }

    if (hasGlyph(row.primaryCategory ?? undefined)) glyphed += count;
    else noGlyph.push([row.primaryCategory ?? "(none)", count]);
  }

  const total = labelled + generic;
  console.log(`Category labels: ${labelled}/${total} (${((100 * labelled) / total).toFixed(1)}%)`);

  if (missing.length > 0) {
    console.log(`\nNo label — add to src/site/i18n.ts:`);
    for (const [category, count] of missing.sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}  ${category}`);
    }
  }

  console.log(`\nCategory glyphs: ${glyphed}/${total} (${((100 * glyphed) / total).toFixed(1)}%)`);
  if (noGlyph.length > 0) {
    console.log(`\nFalling back to the generic storefront — add to src/site/glyphs.ts:`);
    for (const [category, count] of noGlyph.sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}  ${category}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
