import type { GeocodeProvider, ResolvedArea } from "./types";

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string];
}

/**
 * OpenStreetMap's free geocoder. Their usage policy requires an identifying
 * User-Agent with a contact address and at most one request per second, so this
 * serialises calls and refuses to run without `NOMINATIM_USER_AGENT` set.
 */
export class NominatimGeocoder implements GeocodeProvider {
  readonly key = "nominatim";

  private lastCallAt = 0;

  constructor(private readonly userAgent: string) {}

  private async throttle() {
    const waitMs = 1000 - (Date.now() - this.lastCallAt);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.lastCallAt = Date.now();
  }

  async resolve(area: string): Promise<ResolvedArea | null> {
    await this.throttle();

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", area);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, { headers: { "User-Agent": this.userAgent } });
    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status} for "${area}"`);
    }

    const results = (await response.json()) as NominatimResult[];
    const first = results[0];
    if (!first) return null;

    // Nominatim orders the box [minLat, maxLat, minLon, maxLon].
    const [minLat, maxLat, minLon, maxLon] = first.boundingbox.map(Number) as [
      number,
      number,
      number,
      number,
    ];

    return {
      label: first.display_name,
      center: { latitude: Number(first.lat), longitude: Number(first.lon) },
      bbox: { minLat, maxLat, minLon, maxLon },
    };
  }
}
