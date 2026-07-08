import { NextRequest, NextResponse } from "next/server";
import { runAgent } from "@/lib/agent";
import { getLead, updateLead } from "@/lib/store";
import { ActivityEntry } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { leadId, instruction } = await req.json();
  const lead = await getLead(leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  let output;
  try {
    output = await runAgent(lead, instruction);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const entry: ActivityEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: "agent_run",
    summary: `Apex run — ${output.recommendedNextAction.label} (priority ${output.qualification.priorityScore})`,
    detail: instruction,
  };

  const updated = await updateLead(lead.id, {
    fitScore: output.qualification.fitScore,
    intentScore: output.qualification.intentScore,
    priorityScore: output.qualification.priorityScore,
    estimatedDealSize: output.qualification.estimatedDealSize,
    closeProbability: output.qualification.closeProbability,
    status: output.crmUpdate.leadStatus,
    crm: output.crmUpdate,
    activity: [...lead.activity, entry],
  });

  return NextResponse.json({ output, lead: updated });
}
