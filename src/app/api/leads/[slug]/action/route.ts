import { NextResponse } from "next/server";

import { generateSites } from "@/pipeline/generation";
import { addSuppression, disqualifyLead, publishRevision, restoreLead, retryOutreach, updateSiteContent } from "@/pipeline/ops";
import { reviewSite } from "@/pipeline/review";

export const dynamic = "force-dynamic";

/** Manual interventions from the lead detail page. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "disqualify":
        await disqualifyLead(slug, String(body.reason || "Marked bad or duplicate"));
        return NextResponse.json({ ok: true });

      case "restore": {
        const status = await restoreLead(slug);
        return NextResponse.json({ ok: true, status });
      }

      case "regenerate": {
        const summary = await generateSites({ slug, force: true });
        if (summary.failed > 0 || summary.urls.length === 0) {
          return NextResponse.json({ error: "Generation failed — see server logs" }, { status: 500 });
        }
        return NextResponse.json({ ok: true, url: summary.urls[0]?.url });
      }

      case "approve":
      case "reject": {
        if (typeof body.siteId !== "string") {
          return NextResponse.json({ error: "siteId is required" }, { status: 400 });
        }
        const result = await reviewSite(
          body.siteId,
          action === "approve" ? "accept" : "reject",
          typeof body.note === "string" ? body.note : undefined,
        );
        return NextResponse.json({ ok: true, ...result });
      }

      case "publish": {
        const url = await publishRevision(slug);
        return NextResponse.json({ ok: true, url });
      }

      case "edit": {
        if (typeof body.siteId !== "string") {
          return NextResponse.json({ error: "siteId is required" }, { status: 400 });
        }
        const url = await updateSiteContent(body.siteId, body.patch as never);
        return NextResponse.json({ ok: true, url });
      }

      case "retry": {
        if (typeof body.messageId !== "string") {
          return NextResponse.json({ error: "messageId is required" }, { status: 400 });
        }
        await retryOutreach(body.messageId);
        return NextResponse.json({ ok: true });
      }

      case "suppress": {
        if (typeof body.email !== "string") {
          return NextResponse.json({ error: "email is required" }, { status: 400 });
        }
        await addSuppression(body.email, typeof body.note === "string" ? body.note : undefined);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
