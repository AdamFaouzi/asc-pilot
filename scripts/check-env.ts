/**
 * Prints which phases are ready to run. Useful before wiring a new integration:
 * `npm run check:env`.
 */
import "dotenv/config";

import { getEnv, integrationStatus } from "../src/lib/env";

function main() {
  const env = getEnv();
  const integrations = integrationStatus();

  console.log(`ASC-Pilot environment: ${env.NODE_ENV}\n`);

  for (const integration of integrations) {
    const mark = integration.configured ? "✓" : "·";
    console.log(`${mark} Phase ${integration.phase}  ${integration.label}`);
    if (!integration.configured) {
      console.log(`     needs: ${integration.vars.join(", ")}`);
    }
  }

  console.log(`\nOutreach sending: ${env.OUTREACH_ENABLED ? "ENABLED" : "disabled"}`);

  const missing = integrations.filter((i) => !i.configured);
  if (missing.length > 0) {
    console.log(`\n${missing.length} integration(s) not configured. See .env.example.`);
  }
}

main();
