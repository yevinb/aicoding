import { NextRequest, NextResponse } from "next/server";
import { runPlanning } from "@/lib/planning";
import { getPlan } from "@/lib/plan-store";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  const plan = await getPlan(leadId);
  return NextResponse.json(plan);
}

export async function POST(req: NextRequest) {
  const { leadId } = await req.json();
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  try {
    const plan = await runPlanning(leadId);
    return NextResponse.json(plan);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
