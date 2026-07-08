import { NextResponse } from "next/server";
import { runMissionControl } from "@/lib/mission-control";
import { getMissionBriefings } from "@/lib/mission-control-store";

export async function GET() {
  const briefings = await getMissionBriefings();
  return NextResponse.json(briefings);
}

export async function POST() {
  try {
    const report = await runMissionControl();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Mission Control cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
