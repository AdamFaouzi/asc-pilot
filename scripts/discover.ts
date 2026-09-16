/**
 * Runs a discovery scan.
 *
 *   npm run discover -- --area limassol
 *   npm run discover -- --area limassol --category beauty_salon --limit 200
 *   npm run discover -- --area limassol --recheck
 */
import "dotenv/config";

import { runDiscovery } from "../src/pipeline/discovery";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const area = arg("area");
  if (!area) {
    console.error("Usage: npm run discover -- --area <area> [--category <c>] [--limit <n>] [--recheck]");
    process.exitCode = 1;
    return;
  }

  const limitArg = arg("limit");
  const summary = await runDiscovery({
    area,
    category: arg("category"),
    limit: limitArg ? Number(limitArg) : undefined,
    recheck: process.argv.includes("--recheck"),
  });

  console.log(`\nDiscovery run ${summary.runId} — ${summary.area}`);
  console.log(`  seen:          ${summary.seen}`);
  console.log(`  new:           ${summary.created}`);
  console.log(`  updated:       ${summary.updated}`);
  console.log(`  qualified:     ${summary.qualified}   (ready for site generation)`);
  console.log(`  needs review:  ${summary.needsReview}`);
  console.log(`  disqualified:  ${summary.disqualified} (already have a website)`);
  console.log(`  with an email: ${summary.withEmail}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
