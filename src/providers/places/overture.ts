import { existsSync } from "node:fs";
import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";

import type { Address, DiscoveryQuery, PlaceResult } from "@/core/types";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

import type { PlacesProvider } from "./types";

/**
 * Overture Maps places, queried with DuckDB.
 *
 * Overture ships as GeoParquet on S3 under CDLA-Permissive 2.0, so there is no
 * API key, no billing account, and no per-call cost. `scripts/fetch-overture.ts`
 * pulls a region into a local parquet file once; scans then run against disk,
 * which turns a ~45s remote query into a few milliseconds.
 *
 * What Overture does NOT carry, and Google does: opening hours, photos, and
 * reviews. Phase 3's generator has to work from name, category, address, phone
 * and socials alone — see docs/DISCOVERY.md.
 */

/** Columns we read. Keeping this explicit stops a schema change surprising us. */
const COLUMNS = `
  id,
  names.primary                        AS name,
  taxonomy.primary                     AS primary_category,
  taxonomy.alternates                  AS alt_categories,
  basic_category,
  confidence,
  operating_status,
  websites,
  emails,
  socials,
  phones,
  addresses,
  bbox.xmin                            AS lon,
  bbox.ymin                            AS lat
`;

/**
 * DuckDB does not hand back plain JS values for nested types: LIST arrives as
 * `{ items: [...] }` and a STRUCT inside one as `{ entries: {...} }`. These
 * wrappers are unwrapped in `toPlaceResult` so nothing downstream has to know.
 */
type DuckList<T> = { items: T[] } | null | undefined;
type DuckStruct<T> = { entries: T } | T | null | undefined;

interface OvertureAddress {
  freeform: string | null;
  locality: string | null;
  postcode: string | null;
  region: string | null;
  country: string | null;
}

interface OvertureRow {
  id: string;
  name: string | null;
  primary_category: string | null;
  alt_categories: DuckList<string>;
  basic_category: string | null;
  confidence: number | null;
  operating_status: string | null;
  websites: DuckList<string>;
  emails: DuckList<string>;
  socials: DuckList<string>;
  phones: DuckList<string>;
  addresses: DuckList<DuckStruct<OvertureAddress>>;
  lon: number;
  lat: number;
}

function toArray<T>(value: DuckList<T>): T[] {
  return value && Array.isArray(value.items) ? value.items : [];
}

function toStruct<T>(value: DuckStruct<T>): T | undefined {
  if (!value) return undefined;
  const wrapped = (value as { entries?: T }).entries;
  return wrapped ?? (value as T);
}

export class OverturePlacesProvider implements PlacesProvider {
  readonly key = "overture";

  private instance?: Promise<DuckDBInstance>;

  constructor(
    private readonly dataDir: string,
    private readonly release: string,
    /** Below this Overture existence score, a record is too doubtful to pitch. */
    private readonly minConfidence: number,
  ) {}

  /** Local extract written by `npm run overture:fetch`. */
  private localFile(): string {
    return path.join(this.dataDir, `places-${this.release}.parquet`);
  }

  /** Local extract if present, otherwise Overture's S3 bucket directly. */
  private source(): { path: string; remote: boolean } {
    const local = this.localFile();
    if (existsSync(local)) return { path: local, remote: false };
    return {
      path: `s3://overturemaps-us-west-2/release/${this.release}/theme=places/*/*`,
      remote: true,
    };
  }

  private async connect() {
    this.instance ??= DuckDBInstance.create(":memory:");
    const connection = await (await this.instance).connect();
    await connection.run("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';");
    return connection;
  }

  async *search(query: DiscoveryQuery): AsyncIterable<PlaceResult> {
    const box = query.bbox;
    if (!box) {
      throw new Error("OverturePlacesProvider needs a bounding box; resolve the area first.");
    }

    const source = this.source();
    if (source.remote) {
      logger.warn("overture.remote_scan", {
        message: "No local extract found — querying S3, which is slow. Run: npm run overture:fetch",
        expected: this.localFile(),
      });
    }

    const connection = await this.connect();

    // Category filtering checks both the primary taxonomy and its alternates,
    // because Overture files e.g. a barber under hair_salon in either slot.
    const filters = [
      `bbox.xmin BETWEEN $minLon AND $maxLon`,
      `bbox.ymin BETWEEN $minLat AND $maxLat`,
      `confidence >= $minConfidence`,
      // Never pitch a business that has closed down.
      `(operating_status IS NULL OR operating_status = 'open')`,
      `names.primary IS NOT NULL`,
    ];
    if (query.category) {
      filters.push(
        `(taxonomy.primary = $category OR list_contains(coalesce(taxonomy.alternates, []), $category))`,
      );
    }

    const sql = `
      SELECT ${COLUMNS}
      FROM read_parquet('${source.path}')
      WHERE ${filters.join(" AND ")}
      ORDER BY confidence DESC
      ${query.limit ? "LIMIT $limit" : ""}
    `;

    const prepared = await connection.prepare(sql);
    prepared.bind({
      minLon: box.minLon,
      maxLon: box.maxLon,
      minLat: box.minLat,
      maxLat: box.maxLat,
      minConfidence: this.minConfidence,
      ...(query.category ? { category: query.category } : {}),
      ...(query.limit ? { limit: query.limit } : {}),
    });

    const reader = await prepared.runAndReadAll();
    const rows = reader.getRowObjects() as unknown as OvertureRow[];

    for (const row of rows) {
      yield this.toPlaceResult(row);
    }
  }

  /**
   * Overture rows are self-contained, so there is nothing extra to fetch. The
   * method exists to satisfy the interface and to keep the call site identical
   * whichever provider is configured.
   */
  async details(sourceId: string): Promise<PlaceResult | null> {
    const source = this.source();
    const connection = await this.connect();

    const prepared = await connection.prepare(
      `SELECT ${COLUMNS} FROM read_parquet('${source.path}') WHERE id = $id LIMIT 1`,
    );
    prepared.bind({ id: sourceId });

    const reader = await prepared.runAndReadAll();
    const rows = reader.getRowObjects() as unknown as OvertureRow[];
    const row = rows[0];

    return row ? this.toPlaceResult(row) : null;
  }

  private toPlaceResult(row: OvertureRow): PlaceResult {
    const address = toStruct(toArray(row.addresses)[0]);

    const mapped: Address | undefined = address
      ? {
          formatted: [address.freeform, address.locality, address.postcode]
            .filter(Boolean)
            .join(", "),
          line: address.freeform ?? undefined,
          city: address.locality ?? undefined,
          region: address.region ?? undefined,
          postalCode: address.postcode ?? undefined,
          countryCode: address.country ?? undefined,
        }
      : undefined;

    const categories = [row.primary_category, ...toArray(row.alt_categories), row.basic_category]
      .filter((value): value is string => Boolean(value))
      // A category can appear as both primary and alternate.
      .filter((value, index, all) => all.indexOf(value) === index);

    const websites = toArray(row.websites);
    const emails = toArray(row.emails);
    const socials = toArray(row.socials);
    const phones = toArray(row.phones);

    return {
      source: this.key,
      sourceId: row.id,
      name: row.name ?? "Unknown business",
      categories,
      primaryCategory: row.primary_category ?? row.basic_category ?? undefined,
      address: mapped,
      location: { latitude: row.lat, longitude: row.lon },
      phone: phones[0],
      phones: phones.length ? phones : undefined,
      websiteUrl: websites[0],
      emails: emails.length ? emails : undefined,
      socials: socials.length ? socials : undefined,
      confidence: row.confidence ?? undefined,
      // Store the unwrapped shape, not DuckDB's wrapper objects.
      raw: {
        id: row.id,
        name: row.name,
        categories,
        confidence: row.confidence,
        operatingStatus: row.operating_status,
        websites,
        emails,
        socials,
        phones,
        address,
      },
    };
  }
}
