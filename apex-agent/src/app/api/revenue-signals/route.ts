import { NextResponse } from "next/server";
import { runRevenueSignalEngine } from "@/lib/revenue-signal";
import { getRevenueSignalReports } from "@/lib/revenue-signal-store";

export async function GET() {
  const reports = await getRevenueSignalReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runRevenueSignalEngine();
    return NextResponse.json(report);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Revenue signal cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
