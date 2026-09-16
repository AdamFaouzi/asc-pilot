/**
 * Pulls an Overture places extract to disk.
 *
 * Overture's parquet lives on S3 and each remote scan re-reads it, which takes
 * ~45s. Fetching a region once turns every subsequent scan into a local read.
 * Re-run when Overture ships a new release (roughly monthly).
 *
 *   npm run overture:fetch                    # all of Cyprus
 *   npm run overture:fetch -- --area limassol
 */
import "dotenv/config";

import { mkdir } from "node:fs/promises";
import path from "node:path";

import { DuckDBInstance } from "@duckdb/node-api";

import { getEnv } from "../src/lib/env";
import { resolveArea } from "../src/providers/geocode";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const env = getEnv();
  const area = arg("area") ?? "cyprus";
  const resolved = await resolveArea(area);

  const dir = path.resolve(env.OVERTURE_DATA_DIR);
  await mkdir(dir, { recursive: true });
  const destination = path.join(dir, `places-${env.OVERTURE_RELEASE}.parquet`);

  const source = `s3://overturemaps-us-west-2/release/${env.OVERTURE_RELEASE}/theme=places/*/*`;

  console.log(`Fetching Overture places for ${resolved.label}`);
  console.log(`  release: ${env.OVERTURE_RELEASE}`);
  console.log(`  bbox:    ${JSON.stringify(resolved.bbox)}`);
  console.log(`  to:      ${destination}`);
  console.log("This reads a few hundred MB from S3 and takes a couple of minutes.\n");

  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();
  await connection.run("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';");

  const started = Date.now();
  await connection.run(`
    COPY (
      SELECT *
      FROM read_parquet('${source}')
      WHERE bbox.xmin BETWEEN ${resolved.bbox.minLon} AND ${resolved.bbox.maxLon}
        AND bbox.ymin BETWEEN ${resolved.bbox.minLat} AND ${resolved.bbox.maxLat}
    ) TO '${destination}' (FORMAT PARQUET, COMPRESSION ZSTD)
  `);

  const reader = await connection.runAndReadAll(
    `SELECT count(*) AS n,
            count(*) FILTER (WHERE websites IS NULL OR len(websites) = 0) AS no_site,
            count(*) FILTER (WHERE emails IS NOT NULL AND len(emails) > 0) AS with_email
     FROM read_parquet('${destination}')`,
  );
  const [row] = reader.getRowObjects() as unknown as Array<{
    n: bigint;
    no_site: bigint;
    with_email: bigint;
  }>;

  console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s.`);
  console.log(`  places:            ${row?.n ?? 0}`);
  console.log(`  without a website: ${row?.no_site ?? 0}`);
  console.log(`  with an email:     ${row?.with_email ?? 0}`);
  console.log("\nData © Overture Maps Foundation, CDLA-Permissive 2.0.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
