import { NextResponse } from "next/server";
import { runEmployeeOs } from "@/lib/employee-os";
import { getEmployeeOsReports } from "@/lib/employee-os-store";

export async function GET() {
  const reports = await getEmployeeOsReports();
  return NextResponse.json(reports);
}

export async function POST() {
  try {
    const report = await runEmployeeOs();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Revenue OS cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
