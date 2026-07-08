import { NextRequest, NextResponse } from "next/server";
import { runOutreach } from "@/lib/outreach";
import { getPlaybook } from "@/lib/outreach-store";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  const playbook = await getPlaybook(leadId);
  return NextResponse.json(playbook);
}

export async function POST(req: NextRequest) {
  const { leadId } = await req.json();
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  try {
    const playbook = await runOutreach(leadId);
    return NextResponse.json(playbook);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outreach run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
