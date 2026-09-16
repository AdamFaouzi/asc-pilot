import { NextResponse } from "next/server";

import { reviewSite, type ReviewDecision } from "@/pipeline/review";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    siteId?: string;
    decision?: ReviewDecision;
    note?: string;
  };

  if (!body.siteId || (body.decision !== "accept" && body.decision !== "reject")) {
    return NextResponse.json({ error: "siteId and decision are required" }, { status: 400 });
  }

  try {
    const result = await reviewSite(body.siteId, body.decision, body.note);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
