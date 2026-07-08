import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_REVENUE_TARGET, runAnalytics } from "@/lib/analytics";
import { getAnalyticsReports } from "@/lib/analytics-store";

export async function GET() {
  const reports = await getAnalyticsReports();
  return NextResponse.json(reports);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Number(body?.revenueTarget);
    const revenueTarget =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REVENUE_TARGET;
    const report = await runAnalytics(revenueTarget);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analytics run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
