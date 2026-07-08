import { NextResponse } from "next/server";
import { runCrmAudit } from "@/lib/crm-audit";
import { getAudits } from "@/lib/crm-audit-store";

export async function GET() {
  const audits = await getAudits();
  return NextResponse.json(audits);
}

export async function POST() {
  try {
    const report = await runCrmAudit();
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "CRM audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
