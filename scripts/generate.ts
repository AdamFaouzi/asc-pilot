/**
 * Generates preview sites for qualified leads.
 *
 *   npm run generate -- --limit 5
 *   npm run generate -- --slug roussis-smile-dental-clinic
 *   npm run generate -- --slug ... --force     # new version of an existing site
 */
import "dotenv/config";

import { generateSites } from "../src/pipeline/generation";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const limitArg = arg("limit");

  const summary = await generateSites({
    slug: arg("slug"),
    limit: limitArg ? Number(limitArg) : undefined,
    force: process.argv.includes("--force"),
  });

  console.log(`\nGenerated ${summary.succeeded}/${summary.attempted} sites (${summary.failed} failed)`);
  if (summary.withUnverifiedClaims > 0) {
    console.log(`${summary.withUnverifiedClaims} carry unverified claims — review before sending.`);
  }
  if (summary.inputTokens > 0) {
    // Claude Opus 5: $5/MTok in, $25/MTok out.
    const cost = (summary.inputTokens / 1e6) * 5 + (summary.outputTokens / 1e6) * 25;
    console.log(
      `${summary.inputTokens} in / ${summary.outputTokens} out tokens — about $${cost.toFixed(3)} ` +
        `($${(cost / Math.max(summary.succeeded, 1)).toFixed(3)} per site)`,
    );
  }

  console.log();
  for (const entry of summary.urls) {
    const flag = entry.claims > 0 ? `  ⚠ ${entry.claims} unverified` : "";
    console.log(`  ${entry.url}   [${entry.template}]${flag}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
