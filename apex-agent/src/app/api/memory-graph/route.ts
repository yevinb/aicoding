import { NextResponse } from "next/server";
import { getMemoryGraphReports, runMemoryGraphEngine } from "@/lib/memory-graph";

export async function GET() {
  const reports = await getMemoryGraphReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runMemoryGraphEngine();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Memory graph cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
