import OpenAI from "openai";
import { demoRun } from "./agent";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./orchestrator-prompt";
import { saveReport } from "./report-store";
import { getLeads, updateLead } from "./store";
import {
  ActivityEntry,
  CompletedAction,
  CrmRecord,
  Lead,
  OpportunityRow,
  OrchestratorReport,
} from "./types";

interface LeadUpdate {
  leadId: string;
  fitScore: number;
  intentScore: number;
  priorityScore: number;
  estimatedDealSize: string;
  closeProbability: number;
  crmUpdate: CrmRecord;
}

type RawReport = Omit<OrchestratorReport, "id" | "timestamp" | "engine"> & {
  leadUpdates?: LeadUpdate[];
};

export async function runOrchestrator(): Promise<OrchestratorReport> {
  const leads = await getLeads();
  const raw = process.env.OPENAI_API_KEY
    ? await openaiCycle(leads)
    : demoCycle(leads);

  const { leadUpdates = [], ...reportBody } = raw;
  await applyLeadUpdates(leads, leadUpdates);

  const report: OrchestratorReport = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    ...reportBody,
  };
  await saveReport(report);
  return report;
}

async function applyLeadUpdates(
  leads: Lead[],
  updates: LeadUpdate[]
): Promise<void> {
  for (const u of updates) {
    const lead = leads.find((l) => l.id === u.leadId);
    if (!lead) continue;
    const entry: ActivityEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "agent_run",
      summary: `Orchestrator cycle — ${u.crmUpdate.nextAction} (priority ${u.priorityScore})`,
    };
    await updateLead(lead.id, {
      fitScore: u.fitScore,
      intentScore: u.intentScore,
      priorityScore: u.priorityScore,
      estimatedDealSize: u.estimatedDealSize,
      closeProbability: u.closeProbability,
      status: u.crmUpdate.leadStatus,
      crm: u.crmUpdate,
      activity: [...lead.activity, entry],
    });
  }
}

async function openaiCycle(leads: Lead[]): Promise<RawReport> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = leads.map((l) => ({
    id: l.id,
    contact: { name: l.contactName, title: l.contactTitle, email: l.email },
    company: {
      name: l.company,
      industry: l.industry,
      size: l.companySize,
      location: l.location,
      funding: l.fundingStage,
      techStack: l.techStack,
    },
    buyingSignals: l.buyingSignals,
    notes: l.notes,
    status: l.status,
    scores: {
      fit: l.fitScore,
      intent: l.intentScore,
      priority: l.priorityScore,
      estimatedDealSize: l.estimatedDealSize,
      closeProbability: l.closeProbability,
    },
    crm: l.crm,
    recentActivity: l.activity.slice(-5).map((a) => ({
      when: a.timestamp,
      type: a.type,
      summary: a.summary,
    })),
  }));

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ORCHESTRATOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. Here is the full pipeline snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nRun one full operating loop cycle and produce the JSON report.`,
      },
    ],
  });

  return JSON.parse(response.choices[0]?.message?.content ?? "{}") as RawReport;
}

/**
 * Deterministic cycle so the orchestrator works without an API key.
 * Observes real pipeline state, scores every lead, executes the top actions.
 */
function demoCycle(leads: Lead[]): RawReport {
  const today = new Date();
  const isDue = (l: Lead) =>
    !!l.crm.followUpDate && new Date(l.crm.followUpDate) <= today;
  const isUnworked = (l: Lead) => l.priorityScore === null || l.status === "new";
  const isActive = (l: Lead) =>
    l.status !== "closed_won" && l.status !== "closed_lost";

  const active = leads.filter(isActive);

  // Analyze: score every active lead using the per-lead demo engine.
  const scored = active.map((lead) => {
    const run = demoRun(lead);
    const q = run.qualification;
    const urgency = Math.min(
      95,
      (isDue(lead) ? 40 : 0) +
        lead.buyingSignals.length * 12 +
        (lead.status === "engaged" ? 25 : 0) +
        10
    );
    const relationshipStrength =
      { new: 10, researching: 20, contacted: 35, engaged: 65, meeting_booked: 85, nurturing: 45, closed_won: 100, closed_lost: 0 }[
        lead.status
      ] ?? 10;
    const dealMidpoint = /\d{3,}/.test(lead.companySize)
      ? 115000
      : /series|seed|\$|funded|equity/i.test(lead.fundingStage)
        ? 45000
        : 17500;
    const expectedRevenue = Math.round(
      (dealMidpoint * q.closeProbability) / 100
    );
    const priorityScore = Math.round(
      q.fitScore * 0.3 + q.intentScore * 0.3 + urgency * 0.25 + relationshipStrength * 0.15
    );
    return { lead, run, urgency, relationshipStrength, expectedRevenue, priorityScore };
  });

  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  // Plan + Execute: work the highest-value leads that actually need action now.
  const toWork = scored
    .filter(({ lead }) => isUnworked(lead) || isDue(lead))
    .slice(0, 3);

  const actionsCompleted: CompletedAction[] = [];
  const crmChanges: string[] = [];
  const leadUpdates: LeadUpdate[] = [];

  for (const { lead, run, priorityScore } of toWork) {
    const agentUsed =
      run.recommendedNextAction.action === "book_meeting"
        ? "Meeting Scheduling Agent"
        : run.recommendedNextAction.action === "send_email"
          ? "Outreach Agent"
          : run.recommendedNextAction.action === "request_info"
            ? "Research Agent"
            : "Qualification Agent";
    actionsCompleted.push({
      leadId: lead.id,
      agent: agentUsed as CompletedAction["agent"],
      description: `${lead.contactName} (${lead.company}): ${run.recommendedNextAction.label}${run.outreachMessage ? " — message drafted and queued" : ""}`,
    });
    crmChanges.push(
      `${lead.company}: status → ${run.crmUpdate.leadStatus}, next action "${run.crmUpdate.nextAction}", follow-up ${run.crmUpdate.followUpDate ?? "n/a"}`
    );
    leadUpdates.push({
      leadId: lead.id,
      fitScore: run.qualification.fitScore,
      intentScore: run.qualification.intentScore,
      priorityScore,
      estimatedDealSize: run.qualification.estimatedDealSize,
      closeProbability: run.qualification.closeProbability,
      crmUpdate: run.crmUpdate,
    });
  }
  actionsCompleted.push({
    leadId: null,
    agent: "Analytics Agent",
    description: `Re-scored ${scored.length} active lead${scored.length === 1 ? "" : "s"} and recalculated pipeline priorities`,
  });

  const opportunities: OpportunityRow[] = scored.slice(0, 5).map((s) => ({
    leadId: s.lead.id,
    contactName: s.lead.contactName,
    company: s.lead.company,
    icpFit: s.run.qualification.fitScore,
    buyingIntent: s.run.qualification.intentScore,
    urgency: s.urgency,
    relationshipStrength: s.relationshipStrength,
    estimatedDealSize: s.run.qualification.estimatedDealSize,
    closeProbability: s.run.qualification.closeProbability,
    expectedRevenue: s.expectedRevenue,
    priorityScore: s.priorityScore,
    rationale: s.run.recommendedNextAction.reason,
  }));

  const overdue = active.filter(isDue);
  const singleThreaded = active.filter(
    (l) => l.crm.decisionMakers.length === 1 && l.priorityScore !== null && l.priorityScore >= 60
  );
  const dataGaps = active.filter(
    (l) => !l.industry || !l.contactTitle || l.buyingSignals.length === 0
  );

  const risks: string[] = [];
  if (overdue.length > 0)
    risks.push(
      `${overdue.length} follow-up${overdue.length === 1 ? " is" : "s are"} due or overdue (${overdue.map((l) => l.company).join(", ")}) — engagement decays fast after missed touchpoints.`
    );
  for (const l of singleThreaded)
    risks.push(
      `${l.company} is single-threaded through ${l.crm.decisionMakers[0]} — deal is at risk if that contact goes quiet.`
    );
  for (const l of dataGaps)
    risks.push(
      `${l.company} has research gaps (missing ${[!l.industry && "industry", !l.contactTitle && "contact title", l.buyingSignals.length === 0 && "buying signals"].filter(Boolean).join(", ")}) — personalization quality is limited until enriched.`
    );
  if (risks.length === 0) risks.push("No material pipeline risks detected this cycle.");

  const totalExpected = scored.reduce((sum, s) => sum + s.expectedRevenue, 0);
  const top = scored[0];

  const recommendedNextActions = scored
    .slice(0, 4)
    .map(
      (s) =>
        `${s.lead.company}: ${s.run.recommendedNextAction.label} (priority ${s.priorityScore}, expected revenue $${s.expectedRevenue.toLocaleString()})`
    );

  return {
    executiveSummary: `Pipeline holds ${active.length} active lead${active.length === 1 ? "" : "s"} with total expected revenue of $${totalExpected.toLocaleString()}. This cycle the orchestrator re-scored every lead, executed ${toWork.length} action${toWork.length === 1 ? "" : "s"} on the highest-value opportunities, and refreshed all CRM records. ${top ? `Top opportunity: ${top.lead.company} (priority ${top.priorityScore}, expected revenue $${top.expectedRevenue.toLocaleString()}).` : "No active opportunities in pipeline."} ${overdue.length > 0 ? `${overdue.length} overdue follow-up${overdue.length === 1 ? "" : "s"} were addressed first as they carry the highest decay risk.` : "No follow-ups are overdue."}`,
    highestPriorityOpportunities: opportunities,
    actionsCompleted,
    actionsInProgress: active
      .filter((l) => !toWork.some((w) => w.lead.id === l.id))
      .slice(0, 4)
      .map((l) => `${l.company}: ${l.crm.nextAction}${l.crm.followUpDate ? ` (follow-up ${l.crm.followUpDate.slice(0, 10)})` : ""}`),
    risks,
    recommendedNextActions,
    crmChanges: crmChanges.length > 0 ? crmChanges : ["No CRM changes required this cycle — all records current."],
    confidenceAssessment:
      dataGaps.length > 0
        ? `Medium confidence. Scores for ${dataGaps.map((l) => l.company).join(", ")} rest on incomplete data; enrichment would materially improve prioritization. (Demo engine — connect an OpenAI key for full reasoning.)`
        : "High confidence. All active leads have sufficient verified data for reliable prioritization. (Demo engine — connect an OpenAI key for full reasoning.)",
    leadUpdates,
  };
}
