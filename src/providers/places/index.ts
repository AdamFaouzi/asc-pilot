import { getEnv, requireEnv } from "@/lib/env";

import { GooglePlacesProvider } from "./google";
import { MockPlacesProvider } from "./mock";
import { OverturePlacesProvider } from "./overture";
import type { PlacesProvider } from "./types";

export type { PlacesProvider } from "./types";

/** Resolves the places source from `PLACES_PROVIDER`. */
export function getPlacesProvider(): PlacesProvider {
  const env = getEnv();

  switch (env.PLACES_PROVIDER) {
    case "overture":
      return new OverturePlacesProvider(
        env.OVERTURE_DATA_DIR,
        env.OVERTURE_RELEASE,
        env.OVERTURE_MIN_CONFIDENCE,
      );
    case "google":
      return new GooglePlacesProvider(requireEnv("GOOGLE_PLACES_API_KEY", "the Google Places provider"));
    case "mock":
      return new MockPlacesProvider();
    default: {
      const exhaustive: never = env.PLACES_PROVIDER;
      throw new Error(`Unknown places provider: ${String(exhaustive)}`);
    }
  }
}
