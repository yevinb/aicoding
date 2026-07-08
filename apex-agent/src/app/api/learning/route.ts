import { NextResponse } from "next/server";
import { runLearning } from "@/lib/learning";
import { getLearningReports } from "@/lib/learning-store";

export async function GET() {
  const reports = await getLearningReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runLearning();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Learning run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
