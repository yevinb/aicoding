import { NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator";
import { getReports } from "@/lib/report-store";

export async function GET() {
  const reports = await getReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runOrchestrator();
    return NextResponse.json(report);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Orchestrator cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
