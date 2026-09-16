/**
 * Runs outreach.
 *
 * Dry run is the default and has to be turned off explicitly — the failure mode
 * here is emailing a real business by accident, so the safe path is the one you
 * get by typing less.
 *
 *   npm run outreach                      # dry run: compose and log, send nothing
 *   npm run outreach -- --limit 10
 *   npm run outreach -- --slug aces-bar
 *   npm run outreach -- --send            # actually send (also needs OUTREACH_ENABLED=true)
 */
import "dotenv/config";

import { getEnv } from "../src/lib/env";
import { runOutreach } from "../src/pipeline/outreach";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const send = process.argv.includes("--send");
  const env = getEnv();

  if (send && !env.OUTREACH_ENABLED) {
    console.error(
      "--send was passed but OUTREACH_ENABLED is false.\n" +
        "Both are required. Set OUTREACH_ENABLED=true in .env once the compliance\n" +
        "review in docs/COMPLIANCE.md is settled.",
    );
    process.exitCode = 1;
    return;
  }

  const limitArg = arg("limit");
  const summary = await runOutreach({
    dryRun: !send,
    limit: limitArg ? Number(limitArg) : undefined,
    slug: arg("slug"),
  });

  console.log(`\n${summary.dryRun ? "DRY RUN — nothing was sent" : "LIVE SEND"}`);
  console.log(`  considered: ${summary.considered}`);
  console.log(`  ${summary.dryRun ? "would send" : "sent"}: ${summary.sent}`);
  console.log(`  blocked:    ${summary.blocked}`);
  console.log(`  failed:     ${summary.failed}`);

  if (Object.keys(summary.blocks).length > 0) {
    console.log(`\nBlocked by:`);
    for (const [reason, count] of Object.entries(summary.blocks).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}  ${reason}`);
    }
  }

  console.log();
  for (const result of summary.results) {
    const target = result.email ? ` → ${result.email}` : "";
    console.log(`  ${result.slug}${target}: ${result.outcome}${result.detail ? ` (${result.detail})` : ""}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
