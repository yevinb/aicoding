import { NextRequest, NextResponse } from "next/server";
import { runMeeting } from "@/lib/meeting";
import { getMeetingReports } from "@/lib/meeting-store";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  const reports = await getMeetingReports(leadId);
  return NextResponse.json(reports);
}

export async function POST(req: NextRequest) {
  const { leadId, meetingNotes } = await req.json();
  if (!leadId) {
    return NextResponse.json({ error: "leadId is required" }, { status: 400 });
  }
  try {
    const report = await runMeeting(leadId, meetingNotes);
    return NextResponse.json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Meeting run failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
