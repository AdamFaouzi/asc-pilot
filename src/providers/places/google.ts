import type { DiscoveryQuery, PlaceResult } from "@/core/types";

import type { PlacesProvider } from "./types";

/**
 * Google Places (New) adapter.
 *
 * Phase 2 fills this in: `searchNearby` / `searchText` for discovery, then a
 * details call per candidate for `websiteUri`, `regularOpeningHours`, `photos`
 * and `reviews`. Left unimplemented rather than stubbed with fake data so a
 * misconfigured run fails loudly instead of quietly discovering nothing.
 */
export class GooglePlacesProvider implements PlacesProvider {
  readonly key = "google_places";

  constructor(private readonly apiKey: string) {}

  // eslint-disable-next-line require-yield
  async *search(_query: DiscoveryQuery): AsyncIterable<PlaceResult> {
    throw new Error("GooglePlacesProvider.search is not implemented yet (Phase 2).");
  }

  async details(_sourceId: string): Promise<PlaceResult | null> {
    throw new Error("GooglePlacesProvider.details is not implemented yet (Phase 2).");
  }
}
