import { getEnv, requireEnv } from "@/lib/env";

import { LocalHostingProvider } from "./local";
import type { HostingProvider } from "./types";
import { VercelHostingProvider } from "./vercel";

export type { HostingProvider } from "./types";

/** Resolves the hosting target from `HOSTING_PROVIDER`. */
export function getHostingProvider(): HostingProvider {
  const provider = getEnv().HOSTING_PROVIDER;

  switch (provider) {
    case "vercel":
      return new VercelHostingProvider(
        requireEnv("VERCEL_TOKEN", "the Vercel hosting provider"),
        getEnv().VERCEL_PROJECT_ID,
        getEnv().VERCEL_TEAM_ID,
      );
    case "local":
      return new LocalHostingProvider();
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown hosting provider: ${String(exhaustive)}`);
    }
  }
}
