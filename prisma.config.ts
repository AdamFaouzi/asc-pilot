import "dotenv/config";

import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads the connection string from here rather than from the schema's
 * datasource block, and no longer loads `.env` on its own — hence the
 * `dotenv/config` import above.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
