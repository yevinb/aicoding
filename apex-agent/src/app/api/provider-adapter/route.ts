import { NextResponse } from "next/server";
import { getProviderAdapterReports, runProviderAdapterLayer } from "@/lib/provider-adapter";

export async function GET() {
  const reports = await getProviderAdapterReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runProviderAdapterLayer();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Provider adapter cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
