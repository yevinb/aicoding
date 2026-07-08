import { NextResponse } from "next/server";
import { runProspectIntelligence } from "@/lib/prospect-intelligence";
import { getProspectIntelligenceReports } from "@/lib/prospect-intelligence-store";

export async function GET() {
  const reports = await getProspectIntelligenceReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runProspectIntelligence();
    return NextResponse.json(report);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Intelligence cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
