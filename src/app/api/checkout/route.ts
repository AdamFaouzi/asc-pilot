import { NextResponse } from "next/server";

import { createCheckoutSession } from "@/pipeline/billing";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Starts checkout for a preview site. Called by the CTA on the site itself. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { slug?: string };

  if (!body.slug || !/^[a-z0-9-]+$/.test(body.slug)) {
    return NextResponse.json({ error: "A valid slug is required" }, { status: 400 });
  }

  try {
    const { url } = await createCheckoutSession(body.slug);
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("billing.checkout_failed", { slug: body.slug, error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
