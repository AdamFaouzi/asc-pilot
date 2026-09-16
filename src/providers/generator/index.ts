import { getEnv, requireEnv } from "@/lib/env";

import { ClaudeSiteGenerator } from "./claude";
import { MockSiteGenerator } from "./mock";
import type { SiteGenerator } from "./types";

export type { SiteGenerator } from "./types";

/** Resolves the site generator from `GENERATOR_PROVIDER`. */
export function getSiteGenerator(): SiteGenerator {
  const provider = getEnv().GENERATOR_PROVIDER;

  switch (provider) {
    case "claude":
      return new ClaudeSiteGenerator(
        requireEnv("ANTHROPIC_API_KEY", "the Claude site generator"),
        getEnv().ANTHROPIC_MODEL,
      );
    case "mock":
      return new MockSiteGenerator();
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown site generator: ${String(exhaustive)}`);
    }
  }
}
