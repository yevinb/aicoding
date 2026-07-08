import OpenAI from "openai";
import { runAgent } from "./agent";
import { getAnalyticsReports } from "./analytics-store";
import { getAudits } from "./crm-audit-store";
import { getLearningReports } from "./learning-store";
import { MISSION_CONTROL_PROMPT } from "./mission-control-prompt";
import {
  getMissionBriefings,
  saveMissionBriefing,
} from "./mission-control-store";
import { getActiveMissions, getMissions, upsertMission } from "./mission-store";
import { runOutreach } from "./outreach";
import { getPlaybook } from "./outreach-store";
import { runPlanning } from "./planning";
import { getPlan } from "./plan-store";
import { runResearch } from "./research";
import { getResearch } from "./research-store";
import { getReplyAnalyses } from "./reply-store";
import { getLead, getLeads, updateLead } from "./store";
import {
  ActivityEntry,
  Lead,
  Mission,
  MissionControlReport,
  RiskLevel,
} from "./types";

export { getMissionBriefings };

const MAX_EXECUTIONS = 3;

interface LeadContext {
  lead: Lead;
  hasResearch: boolean;
  hasPlan: boolean;
  hasPlaybook: boolean;
  replyCount: number;
}

interface MissionTemplate {
  leadId: string;
  company: string;
  name: string;
  objective: string;
  reason: string;
  priority: RiskLevel;
  expectedRevenueImpact: string;
  requiredAgents: string[];
  successCriteria: string;
  riskLevel: RiskLevel;
  confidence: Mission["confidence"];
  score: number;
}

export async function runMissionControl(): Promise<MissionControlReport> {
  const leads = await getLeads();
  const contexts = await buildContexts(leads);
  const [analytics, crmAudit, learning, existingMissions] = await Promise.all([
    getAnalyticsReports().then((r) => r[0] ?? null),
    getAudits().then((r) => r[0] ?? null),
    getLearningReports().then((r) => r[0] ?? null),
    getActiveMissions(),
  ]);

  const revenueSituation = buildRevenueSituation(contexts, analytics);
  const risks = buildRisks(contexts, analytics, crmAudit);
  const created = await createMissions(contexts, existingMissions);
  const allMissions = await getMissions();
  const active = allMissions.filter(
    (m) =>
      m.status === "assigned" ||
      m.status === "running" ||
      m.status === "created"
  );
  const blocked = allMissions.filter(
    (m) => m.status === "blocked" || m.status === "waiting_approval"
  );

  const { completed, failed } = await executeMissions(
    active.sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority)).slice(0, MAX_EXECUTIONS),
    contexts
  );

  const updatedMissions = await getMissions();
  const missionsActive = updatedMissions.filter(
    (m) => m.status === "assigned" || m.status === "running" || m.status === "created"
  );
  const missionsCompleted = updatedMissions.filter(
    (m) => completed.some((c) => c.id === m.id)
  );
  const missionsBlocked = updatedMissions.filter(
    (m) => m.status === "blocked" || m.status === "waiting_approval"
  );

  const recommendations = buildRecommendations(contexts, analytics, blocked);
  const learningOut = buildLearning(completed, failed, learning);

  const body: Omit<MissionControlReport, "id" | "timestamp" | "engine"> =
    process.env.OPENAI_API_KEY
      ? await openaiBriefing(
          contexts,
          revenueSituation,
          created,
          missionsActive,
          missionsCompleted,
          missionsBlocked,
          risks,
          recommendations,
          learningOut
        )
      : {
          revenueSituation,
          missionsCreated: created,
          missionsActive,
          missionsCompleted,
          blockedMissions: missionsBlocked,
          risks,
          recommendations,
          learning: learningOut,
          confidence: {
            level: completed.length > 0 ? "High" : "Medium",
            explanation:
              "Mission Control created and executed missions on live pipeline data. (Demo engine — connect OpenAI for full COO reasoning.)",
          },
        };

  if (process.env.OPENAI_API_KEY) {
    body.missionsCompleted = missionsCompleted;
    body.missionsActive = missionsActive;
    body.missionsCreated = created;
    body.blockedMissions = missionsBlocked;
  }

  const report: MissionControlReport = {
    ...body,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
  };

  await saveMissionBriefing(report);
  return report;
}

async function buildContexts(leads: Lead[]): Promise<LeadContext[]> {
  return Promise.all(
    leads.map(async (lead) => {
      const [research, plan, playbook, replies] = await Promise.all([
        getResearch(lead.id),
        getPlan(lead.id),
        getPlaybook(lead.id),
        getReplyAnalyses(lead.id),
      ]);
      return {
        lead,
        hasResearch: !!research,
        hasPlan: !!plan,
        hasPlaybook: !!playbook,
        replyCount: replies.length,
      };
    })
  );
}

function isActive(l: Lead): boolean {
  return l.status !== "closed_won" && l.status !== "closed_lost";
}

function isDue(l: Lead): boolean {
  return !!l.crm.followUpDate && new Date(l.crm.followUpDate) <= new Date();
}

function priorityScore(p: RiskLevel): number {
  return { Critical: 4, High: 3, Medium: 2, Low: 1 }[p];
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

function parseDealValue(size: string | null): number {
  if (!size) return 0;
  const m = size.match(/\$?\s*([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
}

function buildRevenueSituation(
  contexts: LeadContext[],
  analytics: Awaited<ReturnType<typeof getAnalyticsReports>>[0] | null
): MissionControlReport["revenueSituation"] {
  const active = contexts.filter((c) => isActive(c.lead));
  const pipelineValue = analytics
    ? `$${analytics.forecast.currentPipelineValue.toLocaleString()}`
    : `$${active.reduce((s, c) => s + parseDealValue(c.lead.estimatedDealSize), 0).toLocaleString()}`;
  const urgent = contexts
    .filter((c) => isActive(c.lead) && isDue(c.lead))
    .map((c) => `Overdue follow-up: ${c.lead.company}`);

  return {
    summary: analytics?.executiveSummary.currentSituation ??
      `${active.length} active accounts in pipeline.`,
    pipelineValue,
    activeAccounts: active.length,
    urgentItems: urgent.length ? urgent : ["No overdue follow-ups"],
    revenueGap:
      analytics && analytics.forecast.revenueGap > 0
        ? `$${analytics.forecast.revenueGap.toLocaleString()}`
        : null,
  };
}

function buildMissionTemplates(c: LeadContext): MissionTemplate[] {
  const l = c.lead;
  const pri = l.priorityScore ?? 0;
  const templates: MissionTemplate[] = [];
  const deal = l.estimatedDealSize ?? "Unsized";

  if (l.priorityScore === null || l.status === "new") {
    templates.push({
      leadId: l.id,
      company: l.company,
      name: `Qualify ${l.company}`,
      objective: "Score fit, intent, and priority; populate CRM record",
      reason: l.buyingSignals.length
        ? `${l.buyingSignals.length} buying signal(s) but lead is unqualified`
        : "New lead requires qualification before pipeline investment",
      priority: l.buyingSignals.length >= 2 ? "High" : "Medium",
      expectedRevenueImpact: deal,
      requiredAgents: ["Qualification Agent"],
      successCriteria: "Lead scored with next action and follow-up scheduled",
      riskLevel: "Low",
      confidence: "High",
      score: 800 + l.buyingSignals.length * 20,
    });
  }

  if (pri >= 50 && !c.hasResearch) {
    templates.push({
      leadId: l.id,
      company: l.company,
      name: `Build intelligence on ${l.company}`,
      objective: "Produce deep research profile with signals, pains, and strategy",
      reason: `Priority ${pri} account lacks research — personalization blocked`,
      priority: pri >= 70 ? "High" : "Medium",
      expectedRevenueImpact: deal,
      requiredAgents: ["Research Agent"],
      successCriteria: "Research profile saved with qualification scorecard",
      riskLevel: "Low",
      confidence: "High",
      score: 700 + pri,
    });
  }

  if (c.hasResearch && !c.hasPlan && pri >= 55) {
    templates.push({
      leadId: l.id,
      company: l.company,
      name: `Develop account strategy for ${l.company}`,
      objective: "Create account plan with stakeholder and engagement strategy",
      reason: "Research complete but no strategic plan for downstream agents",
      priority: "Medium",
      expectedRevenueImpact: deal,
      requiredAgents: ["Account Planning Agent"],
      successCriteria: "Account plan published with discovery plan and objection forecast",
      riskLevel: "Low",
      confidence: "High",
      score: 600 + pri,
    });
  }

  if (c.hasPlan && !c.hasPlaybook && l.status !== "nurturing") {
    templates.push({
      leadId: l.id,
      company: l.company,
      name: `Launch outreach for ${l.company}`,
      objective: "Build and activate personalized multi-touch sequence",
      reason: "Strategy exists but no executable outreach playbook",
      priority: pri >= 75 ? "High" : "Medium",
      expectedRevenueImpact: deal,
      requiredAgents: ["Outreach Agent"],
      successCriteria: "5-touch playbook ready with quality scores above bar",
      riskLevel: "Medium",
      confidence: "Medium",
      score: 500 + pri,
    });
  }

  if (
    (l.status === "engaged" || l.status === "meeting_booked") &&
    l.buyingSignals.length > 0
  ) {
    const signal = l.buyingSignals[0];
    templates.push({
      leadId: l.id,
      company: l.company,
      name: `Engage ${l.contactName || "decision maker"} at ${l.company}`,
      objective: "Advance to qualified discovery meeting",
      reason: signal.includes("SDR") || signal.includes("Hiring")
        ? `${signal} — matches ICP with active outbound build`
        : `Engaged account with signal: ${signal}`,
      priority: "Critical",
      expectedRevenueImpact: deal,
      requiredAgents: ["Research Agent", "Account Planning Agent", "Outreach Agent", "Meeting Agent"],
      successCriteria: "Book qualified discovery meeting",
      riskLevel: "Medium",
      confidence: "High",
      score: 900 + pri,
    });
  }

  if (isDue(l)) {
    templates.push({
      leadId: l.id,
      company: l.company,
      name: `Execute follow-up for ${l.company}`,
      objective: "Complete scheduled follow-up before engagement decays",
      reason: `Follow-up due ${l.crm.followUpDate?.slice(0, 10)}`,
      priority: "Critical",
      expectedRevenueImpact: deal,
      requiredAgents: ["Qualification Agent"],
      successCriteria: "Follow-up executed, next touch scheduled",
      riskLevel: "Low",
      confidence: "High",
      score: 1000,
    });
  }

  return templates;
}

async function createMissions(
  contexts: LeadContext[],
  existing: Mission[]
): Promise<Mission[]> {
  const created: Mission[] = [];
  const now = new Date().toISOString();

  const allTemplates = contexts
    .filter((c) => isActive(c.lead))
    .flatMap(buildMissionTemplates)
    .sort((a, b) => b.score - a.score);

  for (const t of allTemplates) {
    const dup = existing.find(
      (m) =>
        m.leadId === t.leadId &&
        m.objective === t.objective &&
        m.status !== "completed" &&
        m.status !== "failed"
    );
    if (dup) continue;

    const mission: Mission = {
      id: crypto.randomUUID(),
      name: t.name,
      objective: t.objective,
      reason: t.reason,
      priority: t.priority,
      expectedRevenueImpact: t.expectedRevenueImpact,
      requiredAgents: t.requiredAgents,
      deadline: daysFromNow(t.priority === "Critical" ? 2 : t.priority === "High" ? 5 : 10),
      successCriteria: t.successCriteria,
      riskLevel: t.riskLevel,
      confidence: t.confidence,
      leadId: t.leadId,
      company: t.company,
      status: "created",
      currentStep: 0,
      createdAt: now,
      updatedAt: now,
      actualOutcome: null,
      learningGenerated: null,
    };
    await upsertMission(mission);
    created.push(mission);
    if (created.length >= 6) break;
  }

  return created;
}

async function executeMissions(
  missions: Mission[],
  contexts: LeadContext[]
): Promise<{ completed: Mission[]; failed: Mission[] }> {
  const completed: Mission[] = [];
  const failed: Mission[] = [];

  for (const mission of missions) {
    const ctx = contexts.find((c) => c.lead.id === mission.leadId);
    const lead = await getLead(mission.leadId);
    if (!lead || !ctx) {
      mission.status = "failed";
      mission.actualOutcome = "Lead not found";
      await upsertMission(mission);
      failed.push(mission);
      continue;
    }

    const nextAgent = mission.requiredAgents[mission.currentStep];
    if (nextAgent?.includes("Meeting")) {
      mission.status = "waiting_approval";
      mission.learningGenerated = "Meeting booking requires human approval per autonomous decision rules";
      await upsertMission(mission);
      continue;
    }

    mission.status = "running";
    mission.updatedAt = new Date().toISOString();
    await upsertMission(mission);

    const agent = mission.requiredAgents[mission.currentStep];
    if (!agent) {
      mission.status = "completed";
      mission.actualOutcome = "All mission steps completed";
      mission.learningGenerated = "Mission cycle successful";
      await upsertMission(mission);
      completed.push(mission);
      continue;
    }

    try {
      const outcome = await executeAgentStep(agent, lead, ctx);
      mission.currentStep += 1;
      mission.status = mission.currentStep >= mission.requiredAgents.length ? "completed" : "assigned";
      mission.actualOutcome = outcome;
      mission.learningGenerated =
        mission.status === "completed"
          ? `Completed via ${agent}: ${outcome}`
          : `Step ${mission.currentStep}/${mission.requiredAgents.length} done`;
      mission.updatedAt = new Date().toISOString();
      await upsertMission(mission);
      if (mission.status === "completed") completed.push(mission);
    } catch {
      mission.status = "failed";
      mission.actualOutcome = `Failed at ${agent}`;
      await upsertMission(mission);
      failed.push(mission);
    }
  }

  return { completed, failed };
}

async function executeAgentStep(
  agent: string,
  lead: Lead,
  ctx: LeadContext
): Promise<string> {
  if (agent.includes("Qualification")) {
    const output = await runAgent(lead);
    const entry: ActivityEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: "agent_run",
      summary: `Mission Control — ${output.recommendedNextAction.label}`,
    };
    await updateLead(lead.id, {
      fitScore: output.qualification.fitScore,
      intentScore: output.qualification.intentScore,
      priorityScore: output.qualification.priorityScore,
      estimatedDealSize: output.qualification.estimatedDealSize,
      closeProbability: output.qualification.closeProbability,
      status: output.crmUpdate.leadStatus,
      crm: output.crmUpdate,
      activity: [...lead.activity, entry],
    });
    return output.recommendedNextAction.label;
  }
  if (agent.includes("Research")) {
    await runResearch(lead.id);
    await logActivity(lead.id, "Research profile created");
    return "Research profile created";
  }
  if (agent.includes("Planning")) {
    await runPlanning(lead.id);
    await logActivity(lead.id, "Account plan built");
    return "Account plan built";
  }
  if (agent.includes("Outreach")) {
    await runOutreach(lead.id);
    await logActivity(lead.id, "Outreach playbook ready");
    return "Outreach playbook ready";
  }
  if (agent.includes("Reply") && ctx.replyCount === 0) {
    throw new Error("No inbound reply to process");
  }
  if (agent.includes("Meeting")) {
    await logActivity(lead.id, "Meeting prep queued — human approval for booking");
    return "Meeting prep queued";
  }
  throw new Error(`Unsupported agent: ${agent}`);
}

async function logActivity(leadId: string, summary: string): Promise<void> {
  const lead = await getLead(leadId);
  if (!lead) return;
  await updateLead(leadId, {
    activity: [
      ...lead.activity,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "agent_run",
        summary: `Mission Control — ${summary}`,
      },
    ],
  });
}

function buildRisks(
  contexts: LeadContext[],
  analytics: Awaited<ReturnType<typeof getAnalyticsReports>>[0] | null,
  crmAudit: Awaited<ReturnType<typeof getAudits>>[0] | null
): MissionControlReport["risks"] {
  const risks: MissionControlReport["risks"] = [];
  if (analytics?.forecast.revenueGap && analytics.forecast.revenueGap > 0) {
    risks.push({
      description: `Revenue gap of $${analytics.forecast.revenueGap.toLocaleString()}`,
      level: "Critical",
      mitigation: "Create high-priority engagement missions on top weighted accounts",
    });
  }
  for (const c of contexts.filter((x) => isActive(x.lead) && isDue(x.lead))) {
    risks.push({
      description: `${c.lead.company}: overdue follow-up`,
      level: "High",
      mitigation: "Mission assigned — execute follow-up immediately",
    });
  }
  if (crmAudit && crmAudit.crmHealth.overall.score < 65) {
    risks.push({
      description: `CRM health ${crmAudit.crmHealth.overall.score}/100`,
      level: "Medium",
      mitigation: "Schedule CRM Intelligence audit mission",
    });
  }
  if (risks.length === 0) {
    risks.push({
      description: "No critical risks detected",
      level: "Low",
      mitigation: "Maintain mission cadence",
    });
  }
  return risks;
}

function buildRecommendations(
  contexts: LeadContext[],
  analytics: Awaited<ReturnType<typeof getAnalyticsReports>>[0] | null,
  blocked: Mission[]
): MissionControlReport["recommendations"] {
  const recs: MissionControlReport["recommendations"] = [];
  if (blocked.some((m) => m.status === "waiting_approval")) {
    recs.push({
      action: "Approve meeting-booking missions awaiting calendar confirmation",
      reason: "Autonomous rule: high-touch scheduling requires human approval",
      humanRequired: true,
      priority: "High",
    });
  }
  const top = contexts
    .filter((c) => isActive(c.lead) && (c.lead.priorityScore ?? 0) >= 70)
    .sort((a, b) => (b.lead.priorityScore ?? 0) - (a.lead.priorityScore ?? 0))[0];
  if (top) {
    recs.push({
      action: `Review ${top.lead.company} engagement progress after mission execution`,
      reason: "Highest-priority account — human judgment adds value on meeting timing",
      humanRequired: true,
      priority: "Medium",
    });
  }
  if (analytics?.forecast.revenueGap && analytics.forecast.revenueGap > 0) {
    recs.push({
      action: "Approve pipeline-generation budget for Discovery missions",
      reason: analytics.executiveSummary.revenueOutlook,
      humanRequired: true,
      priority: "Critical",
    });
  }
  if (recs.length === 0) {
    recs.push({
      action: "No human input required this cycle",
      reason: "All missions are low-risk and reversible",
      humanRequired: false,
      priority: "Low",
    });
  }
  return recs;
}

function buildLearning(
  completed: Mission[],
  failed: Mission[],
  learning: Awaited<ReturnType<typeof getLearningReports>>[0] | null
): MissionControlReport["learning"] {
  return {
    succeeded: completed.map(
      (m) => `${m.name}: ${m.actualOutcome ?? "completed"}`
    ),
    failed: failed.map((m) => `${m.name}: ${m.actualOutcome ?? "failed"}`),
    improvements: [
      ...(learning?.recommendations.slice(0, 2).map((r) => r.recommendedChange) ?? []),
      "Prioritize multi-agent engage missions on accounts with hiring/funding signals",
    ],
  };
}

async function openaiBriefing(
  contexts: LeadContext[],
  revenueSituation: MissionControlReport["revenueSituation"],
  created: Mission[],
  active: Mission[],
  completed: Mission[],
  blocked: Mission[],
  risks: MissionControlReport["risks"],
  recommendations: MissionControlReport["recommendations"],
  learning: MissionControlReport["learning"]
): Promise<Omit<MissionControlReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    revenueSituation,
    missionsCreated: created,
    missionsActive: active,
    missionsCompleted: completed,
    blockedMissions: blocked,
    risks,
    recommendations,
    learning,
    pipeline: contexts.map((c) => ({
      id: c.lead.id,
      company: c.lead.company,
      status: c.lead.status,
      priority: c.lead.priorityScore,
      signals: c.lead.buyingSignals,
    })),
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: MISSION_CONTROL_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. Runtime executed missions. Produce the Mission Control briefing JSON:\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ],
  });

  return JSON.parse(
    response.choices[0]?.message?.content ?? "{}"
  ) as Omit<MissionControlReport, "id" | "timestamp" | "engine">;
}
