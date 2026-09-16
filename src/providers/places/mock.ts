import type { DiscoveryQuery, PlaceResult } from "@/core/types";

import type { PlacesProvider } from "./types";

/**
 * Fixture provider used until a real Places key exists (Phase 2). It returns a
 * small, deliberately mixed set — one with a website, one Instagram-only, one
 * with nothing — so qualification logic can be exercised offline.
 */

const FIXTURES: PlaceResult[] = [
  {
    source: "mock",
    sourceId: "mock-kafeneio",
    name: "Kafeneio Tou Andrea",
    categories: ["cafe", "restaurant"],
    primaryCategory: "cafe",
    address: {
      formatted: "12 Agiou Andreou, Limassol 3036, Cyprus",
      line: "12 Agiou Andreou",
      city: "Limassol",
      postalCode: "3036",
      countryCode: "CY",
    },
    location: { latitude: 34.6751, longitude: 33.0439 },
    phone: "+357 25 000000",
    rating: 4.7,
    reviewCount: 214,
    openingHours: [
      { day: 1, open: "07:00", close: "19:00" },
      { day: 2, open: "07:00", close: "19:00" },
      { day: 3, open: "07:00", close: "19:00" },
      { day: 4, open: "07:00", close: "19:00" },
      { day: 5, open: "07:00", close: "22:00" },
      { day: 6, open: "08:00", close: "22:00" },
    ],
    reviews: [{ author: "Maria K.", rating: 5, text: "Best frappé in the old town." }],
  },
  {
    source: "mock",
    sourceId: "mock-barber",
    name: "Kyriakos Barber Shop",
    categories: ["hair_care", "barber_shop"],
    primaryCategory: "barber_shop",
    address: {
      formatted: "5 Anexartisias, Limassol 3040, Cyprus",
      city: "Limassol",
      countryCode: "CY",
    },
    location: { latitude: 34.6787, longitude: 33.0421 },
    phone: "+357 25 111111",
    rating: 4.9,
    reviewCount: 88,
  },
  {
    source: "mock",
    sourceId: "mock-taverna",
    name: "Taverna Petra",
    categories: ["restaurant"],
    primaryCategory: "restaurant",
    // Already has a site — discovery must filter this one out.
    websiteUrl: "https://tavernapetra.example",
    address: { formatted: "44 Georgiou A', Limassol, Cyprus", city: "Limassol", countryCode: "CY" },
    location: { latitude: 34.7071, longitude: 33.0951 },
    rating: 4.3,
    reviewCount: 512,
  },
];

export class MockPlacesProvider implements PlacesProvider {
  readonly key = "mock";

  async *search(query: DiscoveryQuery): AsyncIterable<PlaceResult> {
    const limit = query.limit ?? FIXTURES.length;
    const matching = query.category
      ? FIXTURES.filter((f) => f.categories.includes(query.category!))
      : FIXTURES;

    for (const result of matching.slice(0, limit)) {
      yield result;
    }
  }

  async details(sourceId: string): Promise<PlaceResult | null> {
    return FIXTURES.find((f) => f.sourceId === sourceId) ?? null;
  }
}
