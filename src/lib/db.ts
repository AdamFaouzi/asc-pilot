import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma";

import { getEnv } from "./env";

/**
 * Prisma singleton.
 *
 * Prisma 7 connects through a driver adapter rather than a connection string in
 * the schema, so the pool is constructed here from the validated environment.
 * The client is stashed on `globalThis` because Next's dev server re-evaluates
 * modules on every change, and a fresh pool per reload exhausts Postgres.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const env = getEnv();

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (getEnv().NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
