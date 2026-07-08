import { NextRequest, NextResponse } from "next/server";
import { runResearch } from "@/lib/research";
import { getResearch } from "@/lib/research-store";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  const profile = await getResearch(leadId);
  return NextResponse.json(profile);
}

export async function POST(req: NextRequest) {
  const { leadId } = await req.json();
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  try {
    const profile = await runResearch(leadId);
    return NextResponse.json(profile);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Research run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
