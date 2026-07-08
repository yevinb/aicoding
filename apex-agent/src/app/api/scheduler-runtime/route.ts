import { NextResponse } from "next/server";
import { runSchedulerRuntime } from "@/lib/scheduler-runtime";
import { getSchedulerRuntimeReports } from "@/lib/scheduler-runtime-store";

export async function GET() {
  const reports = await getSchedulerRuntimeReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runSchedulerRuntime();
    return NextResponse.json(report);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Scheduler runtime cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
