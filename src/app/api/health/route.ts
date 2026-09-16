import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getEnv, integrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Liveness + database reachability, plus which integrations are wired up. */
export async function GET() {
  let database: "up" | "down" = "down";
  let databaseError: string | undefined;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch (error) {
    databaseError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(
    {
      status: database === "up" ? "ok" : "degraded",
      environment: getEnv().NODE_ENV,
      database,
      databaseError,
      outreachEnabled: getEnv().OUTREACH_ENABLED,
      integrations: integrationStatus(),
    },
    { status: database === "up" ? 200 : 503 },
  );
}
