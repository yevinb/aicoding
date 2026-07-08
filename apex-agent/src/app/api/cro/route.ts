import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_REVENUE_TARGET } from "@/lib/analytics";
import { runCroReview } from "@/lib/cro";
import { getCroReviews } from "@/lib/cro-store";

export async function GET() {
  const reviews = await getCroReviews();
  return NextResponse.json(reviews);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Number(body?.revenueTarget);
    const revenueTarget =
      Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_REVENUE_TARGET;
    const report = await runCroReview(revenueTarget);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "CRO review failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
