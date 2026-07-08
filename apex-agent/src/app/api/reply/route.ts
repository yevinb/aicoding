import { NextRequest, NextResponse } from "next/server";
import { runReplyAnalysis } from "@/lib/reply";
import { getReplyAnalyses } from "@/lib/reply-store";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  const analyses = await getReplyAnalyses(leadId);
  return NextResponse.json(analyses);
}

export async function POST(req: NextRequest) {
  const { leadId, message } = await req.json();
  if (!leadId || !message?.trim()) {
    return NextResponse.json(
      { error: "leadId and message are required" },
      { status: 400 }
    );
  }
  try {
    const analysis = await runReplyAnalysis(leadId, message.trim());
    return NextResponse.json(analysis);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reply analysis failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
