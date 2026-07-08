import { NextResponse } from "next/server";
import { getCommunicationOsReports, runCommunicationOs } from "@/lib/communication-os";

export async function GET() {
  const reports = await getCommunicationOsReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runCommunicationOs();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Communication OS cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
