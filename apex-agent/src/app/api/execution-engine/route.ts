import { NextResponse } from "next/server";
import { runExecutionEngine } from "@/lib/execution-engine";
import { getExecutionReports } from "@/lib/execution-engine-store";

export async function GET() {
  const reports = await getExecutionReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runExecutionEngine();
    return NextResponse.json(report);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Execution cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
