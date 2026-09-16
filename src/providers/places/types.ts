import type { DiscoveryQuery, PlaceResult } from "@/core/types";

/**
 * A source of local business listings.
 *
 * `search` yields results rather than returning an array: providers page, and
 * discovery should be able to stop early once the operator's limit is hit
 * instead of paying for pages it will discard.
 */
export interface PlacesProvider {
  /** Registry key, also stored on Business.source. */
  readonly key: string;

  search(query: DiscoveryQuery): AsyncIterable<PlaceResult>;

  /**
   * Fetches the detail fields (hours, photos, reviews, website) that search
   * results usually omit. Providers that return everything up front may
   * return the input unchanged.
   */
  details(sourceId: string): Promise<PlaceResult | null>;
}
