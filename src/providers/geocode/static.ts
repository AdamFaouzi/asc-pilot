import type { GeocodeProvider, ResolvedArea } from "./types";

/**
 * Built-in gazetteer for the areas we actually operate in. Works offline and
 * without hitting anyone's rate limit, which makes it the sane default for a
 * tool that is mostly re-scanning the same handful of Cypriot towns.
 *
 * Boxes are drawn to cover the town plus its immediate suburbs.
 */
const AREAS: Record<string, ResolvedArea> = {
  limassol: {
    label: "Limassol, Cyprus",
    center: { latitude: 34.6841, longitude: 33.0379 },
    bbox: { minLat: 34.63, maxLat: 34.75, minLon: 32.9, maxLon: 33.15 },
  },
  nicosia: {
    label: "Nicosia, Cyprus",
    center: { latitude: 35.1856, longitude: 33.3823 },
    bbox: { minLat: 35.11, maxLat: 35.23, minLon: 33.28, maxLon: 33.45 },
  },
  larnaca: {
    label: "Larnaca, Cyprus",
    center: { latitude: 34.9182, longitude: 33.622 },
    bbox: { minLat: 34.86, maxLat: 34.97, minLon: 33.55, maxLon: 33.68 },
  },
  paphos: {
    label: "Paphos, Cyprus",
    center: { latitude: 34.7754, longitude: 32.4245 },
    bbox: { minLat: 34.72, maxLat: 34.83, minLon: 32.36, maxLon: 32.5 },
  },
  ayianapa: {
    label: "Ayia Napa, Cyprus",
    center: { latitude: 34.9884, longitude: 33.9994 },
    bbox: { minLat: 34.955, maxLat: 35.03, minLon: 33.94, maxLon: 34.05 },
  },
  paralimni: {
    label: "Paralimni, Cyprus",
    center: { latitude: 35.0386, longitude: 33.9822 },
    bbox: { minLat: 35.0, maxLat: 35.08, minLon: 33.93, maxLon: 34.03 },
  },
  cyprus: {
    label: "Cyprus",
    center: { latitude: 35.0, longitude: 33.0 },
    bbox: { minLat: 34.5, maxLat: 35.75, minLon: 32.2, maxLon: 34.65 },
  },
};

/** "Limassol, Cyprus" and "limassol" both key to `limassol`. */
function normalise(area: string): string {
  return area
    .toLowerCase()
    .replace(/,.*$/, "")
    .replace(/[^a-z]/g, "");
}

export class StaticGeocoder implements GeocodeProvider {
  readonly key = "static";

  async resolve(area: string): Promise<ResolvedArea | null> {
    return AREAS[normalise(area)] ?? null;
  }

  static knownAreas(): string[] {
    return Object.keys(AREAS);
  }
}
