import type { GeoPoint } from "@/core/types";

export interface ResolvedArea {
  /** Canonical label from the geocoder, e.g. "Limassol, Limassol District, Cyprus". */
  label: string;
  center: GeoPoint;
  /** Bounding box the discovery query should scan. */
  bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

/** Turns an operator-typed area ("Limassol, Cyprus") into coordinates. */
export interface GeocodeProvider {
  readonly key: string;
  resolve(area: string): Promise<ResolvedArea | null>;
}
