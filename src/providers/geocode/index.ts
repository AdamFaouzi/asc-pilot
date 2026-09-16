import { getEnv, requireEnv } from "@/lib/env";

import { NominatimGeocoder } from "./nominatim";
import { StaticGeocoder } from "./static";
import type { GeocodeProvider, ResolvedArea } from "./types";

export type { GeocodeProvider, ResolvedArea } from "./types";
export { StaticGeocoder } from "./static";

export function getGeocodeProvider(): GeocodeProvider {
  const provider = getEnv().GEOCODE_PROVIDER;

  switch (provider) {
    case "nominatim":
      return new NominatimGeocoder(requireEnv("NOMINATIM_USER_AGENT", "the Nominatim geocoder"));
    case "static":
      return new StaticGeocoder();
    default: {
      const exhaustive: never = provider;
      throw new Error(`Unknown geocode provider: ${String(exhaustive)}`);
    }
  }
}

/**
 * Resolves an area, falling back to the built-in gazetteer so a Nominatim
 * outage doesn't stop a scan of a town we already have coordinates for.
 */
export async function resolveArea(area: string): Promise<ResolvedArea> {
  const provider = getGeocodeProvider();

  const resolved = await provider.resolve(area).catch(() => null);
  if (resolved) return resolved;

  if (provider.key !== "static") {
    const fallback = await new StaticGeocoder().resolve(area);
    if (fallback) return fallback;
  }

  throw new Error(
    `Could not resolve area "${area}". Known areas: ${StaticGeocoder.knownAreas().join(", ")}. ` +
      `Set GEOCODE_PROVIDER=nominatim (with NOMINATIM_USER_AGENT) to look up arbitrary places.`,
  );
}
