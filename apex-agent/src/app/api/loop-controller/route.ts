import { NextResponse } from "next/server";
import { getLoopReports, runAutonomousLoop } from "@/lib/loop-controller";

export async function GET() {
  const reports = await getLoopReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runAutonomousLoop();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Autonomous loop failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
