import OpenAI from "openai";
import { runAgent } from "./agent";
import { getAudits } from "./crm-audit-store";
import { EMPLOYEE_OS_PROMPT } from "./employee-os-prompt";
import { getEmployeeOsReports, saveEmployeeOsReport } from "./employee-os-store";
import { getLearningReports } from "./learning-store";
import { getMeetingReports } from "./meeting-store";
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
  EmployeeOsReport,
  Lead,
  OsBuyingSignal,
  OsDiscoveredOpportunity,
  OsPlannedTask,
  RiskLevel,
} from "./types";

export { getEmployeeOsReports };

const MAX_EXECUTIONS = 4;

interface LeadContext {
  lead: Lead;
  hasResearch: boolean;
  hasPlan: boolean;
  hasPlaybook: boolean;
  replyCount: number;
  meetingCount: number;
}

type WorkKind = "qualify" | "research" | "plan" | "outreach" | "follow_up";

interface WorkItem {
  kind: WorkKind;
  leadId: string;
  company: string;
  agent: string;
  task: string;
  reason: string;
  expectedOutcome: string;
  priority: RiskLevel;
  confidence: EmployeeOsReport["confidence"]["level"];
  riskLevel: RiskLevel;
  score: number;
}

const MARKET_DISCOVERIES: Omit<OsDiscoveredOpportunity, "leadId" | "source">[] = [
  {
    company: "Relay Financial",
    industry: "Fintech / Banking",
    fitScore: 85,
    signals: [
      {
        signal: "Raised $18M Series A (2 months ago)",
        rank: "Critical",
        whyItMatters: "Fresh capital + outbound build mandate — budget and urgency align.",
        contact: "VP Sales (to be identified)",
        messageAngle: "Scale outbound without doubling headcount post-Series A.",
      },
    ],
    recommendedAction: "Run Discovery → Research → qualify before first touch.",
  },
  {
    company: "Stackline Commerce",
    industry: "B2B SaaS / E-commerce",
    fitScore: 78,
    signals: [
      {
        signal: "Posted 8 AE roles + EMEA expansion",
        rank: "High",
        whyItMatters: "Hiring velocity signals GTM investment and process gaps at scale.",
        contact: "Head of Revenue (to be identified)",
        messageAngle: "Ramp new AEs faster with signal-based prioritization.",
      },
    ],
    recommendedAction: "Enrich contacts, score fit, build research profile.",
  },
];

export async function runEmployeeOs(): Promise<EmployeeOsReport> {
  const leads = await getLeads();
  const contexts = await buildContexts(leads);
  const [crmAudit, learning] = await Promise.all([
    getAudits().then((r) => r[0] ?? null),
    getLearningReports().then((r) => r[0] ?? null),
  ]);

  const observe = buildObservation(contexts, crmAudit, learning);
  const workQueue = buildWorkQueue(contexts);
  const think = buildThink(workQueue, contexts);
  const plannedTasks = buildPlan(workQueue);
  const { completed, artifactsCreated, delegatedAgents } = await executePlan(
    plannedTasks.slice(0, MAX_EXECUTIONS)
  );

  const discovery = buildDiscovery(leads, contexts);
  const memory = buildMemory(contexts, crmAudit, learning);
  const risks = buildRisks(contexts, observe);
  const learningOut = buildLearningSection(learning, completed);
  const pipelineImpact = buildPipelineImpact(completed, artifactsCreated, contexts);

  const body: Omit<EmployeeOsReport, "id" | "timestamp" | "engine"> =
    process.env.OPENAI_API_KEY
      ? await enrichWithOpenai(
          contexts,
          observe,
          think,
          plannedTasks,
          completed,
          discovery,
          memory,
          risks,
          learningOut,
          pipelineImpact
        )
      : {
          operatingLoop: {
            observe,
            think,
            plan: { tasks: plannedTasks },
            execute: {
              summary: `Delegated ${completed.length} task${completed.length === 1 ? "" : "s"} across ${[...new Set(delegatedAgents)].join(", ") || "no agents"}.`,
              delegatedAgents: [...new Set(delegatedAgents)],
            },
          },
          revenueBrief: buildRevenueBrief(contexts, completed, discovery),
          opportunityDiscovery: discovery,
          priorityActions: plannedTasks,
          completedWork: completed,
          pipelineImpact,
          risks,
          learning: learningOut,
          memorySnapshot: memory,
          performanceMetrics: buildMetrics(contexts, completed),
          confidence: {
            level: completed.length > 0 ? "High" : "Medium",
            explanation:
              "Autonomous cycle executed real agent delegation on live pipeline data. (Demo engine — connect OpenAI for full reasoning.)",
          },
        };

  // Sync execute summary if OpenAI path ran
  if (process.env.OPENAI_API_KEY) {
    body.completedWork = completed;
    body.operatingLoop.execute = {
      summary: `Delegated ${completed.length} task${completed.length === 1 ? "" : "s"} across ${[...new Set(delegatedAgents)].join(", ") || "no agents"}.`,
      delegatedAgents: [...new Set(delegatedAgents)],
    };
    body.pipelineImpact = pipelineImpact;
  }

  const report: EmployeeOsReport = {
    ...body,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
  };

  await saveEmployeeOsReport(report);
  return report;
}

async function buildContexts(leads: Lead[]): Promise<LeadContext[]> {
  return Promise.all(
    leads.map(async (lead) => {
      const [research, plan, playbook, replies, meetings] = await Promise.all([
        getResearch(lead.id),
        getPlan(lead.id),
        getPlaybook(lead.id),
        getReplyAnalyses(lead.id),
        getMeetingReports(lead.id),
      ]);
      return {
        lead,
        hasResearch: !!research,
        hasPlan: !!plan,
        hasPlaybook: !!playbook,
        replyCount: replies.length,
        meetingCount: meetings.length,
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

function rankSignal(signal: string): OsBuyingSignal["rank"] {
  if (/series|funding|raised|\$\d+m|hiring \d+|vp.*started|ceo|cro/i.test(signal))
    return "Critical";
  if (/hiring|expansion|transformation|new market/i.test(signal)) return "High";
  if (/posted|announced|struggle|challenge/i.test(signal)) return "Medium";
  return "Low";
}

function signalInsight(signal: string, lead: Lead): OsBuyingSignal {
  const rank = rankSignal(signal);
  return {
    signal,
    rank,
    whyItMatters:
      rank === "Critical"
        ? "Timing window is open — budget and change mandate likely in place."
        : rank === "High"
          ? "Indicates active investment or initiative worth anchoring outreach on."
          : "Supporting context for personalization.",
    contact: lead.contactName || "Primary contact TBD",
    messageAngle: lead.crm.painPoints[0]
      ? `Connect ${signal.toLowerCase()} to ${lead.crm.painPoints[0].slice(0, 60)}`
      : `Reference ${signal.toLowerCase()} and ask one specific question about their GTM priorities.`,
  };
}

function buildDiscovery(
  leads: Lead[],
  contexts: LeadContext[]
): OsDiscoveredOpportunity[] {
  const existing = new Set(leads.map((l) => l.company.toLowerCase()));
  const fromMarket = MARKET_DISCOVERIES.filter(
    (d) => !existing.has(d.company.toLowerCase())
  ).map((d) => ({ ...d, leadId: null, source: "market_discovery" as const }));

  const fromPipeline = contexts
    .filter(
      (c) =>
        isActive(c.lead) &&
        c.lead.buyingSignals.length >= 2 &&
        (!c.hasPlaybook || c.lead.priorityScore === null)
    )
    .map((c) => ({
      company: c.lead.company,
      industry: c.lead.industry || "Unknown",
      fitScore: c.lead.fitScore ?? 65,
      leadId: c.lead.id,
      signals: c.lead.buyingSignals.map((s) => signalInsight(s, c.lead)),
      recommendedAction:
        c.lead.priorityScore === null
          ? "Qualify immediately — multiple signals but unscored."
          : "Build outreach playbook and start sequence this week.",
      source: "pipeline" as const,
    }));

  return [...fromPipeline, ...fromMarket].slice(0, 6);
}

function buildWorkQueue(contexts: LeadContext[]): WorkItem[] {
  const items: WorkItem[] = [];
  const push = (item: Omit<WorkItem, "score"> & { score: number }) => items.push(item);

  for (const c of contexts.filter((x) => isActive(x.lead))) {
    const l = c.lead;
    const pri = l.priorityScore ?? 0;

    if (isDue(l)) {
      push({
        kind: "follow_up",
        leadId: l.id,
        company: l.company,
        agent: "Qualification Agent",
        task: `Execute overdue follow-up for ${l.company}`,
        reason: `Follow-up date ${l.crm.followUpDate?.slice(0, 10)} is due — engagement decays after missed touchpoints.`,
        expectedOutcome: "Status advanced, next action set, follow-up rescheduled.",
        priority: "Critical",
        confidence: "High",
        riskLevel: "High",
        score: 1000 + pri,
      });
    }

    if (l.priorityScore === null || l.status === "new") {
      push({
        kind: "qualify",
        leadId: l.id,
        company: l.company,
        agent: "Qualification Agent",
        task: `Qualify ${l.company}`,
        reason: l.buyingSignals.length
          ? `${l.buyingSignals.length} buying signal(s) recorded but lead is unworked.`
          : "New lead requires scoring before pipeline investment.",
        expectedOutcome: "Fit, intent, priority scores and CRM record populated.",
        priority: l.buyingSignals.length >= 2 ? "High" : "Medium",
        confidence: "High",
        riskLevel: "Low",
        score: 800 + l.buyingSignals.length * 20,
      });
    }

    if (pri >= 50 && !c.hasResearch) {
      push({
        kind: "research",
        leadId: l.id,
        company: l.company,
        agent: "Research Agent",
        task: `Deep research on ${l.company}`,
        reason: `Priority ${pri} account lacks research profile — personalization quality is limited.`,
        expectedOutcome: "Full research profile with signals, pains, and strategy.",
        priority: pri >= 70 ? "High" : "Medium",
        confidence: "High",
        riskLevel: "Low",
        score: 600 + pri,
      });
    }

    if (c.hasResearch && !c.hasPlan && pri >= 55) {
      push({
        kind: "plan",
        leadId: l.id,
        company: l.company,
        agent: "Account Planning Agent",
        task: `Build account plan for ${l.company}`,
        reason: "Research complete but no strategy document for downstream agents.",
        expectedOutcome: "Account plan with stakeholder strategy and discovery plan.",
        priority: "Medium",
        confidence: "High",
        riskLevel: "Low",
        score: 500 + pri,
      });
    }

    if (c.hasPlan && !c.hasPlaybook && pri >= 50 && l.status !== "nurturing") {
      push({
        kind: "outreach",
        leadId: l.id,
        company: l.company,
        agent: "Outreach Agent",
        task: `Build outreach playbook for ${l.company}`,
        reason: "Strategy exists but no executable sequence — pipeline cannot advance without touches.",
        expectedOutcome: "5-touch personalized sequence ready to send.",
        priority: pri >= 75 ? "High" : "Medium",
        confidence: "Medium",
        riskLevel: "Medium",
        score: 400 + pri,
      });
    }
  }

  items.sort((a, b) => b.score - a.score);
  return items;
}

function buildObservation(
  contexts: LeadContext[],
  crmAudit: Awaited<ReturnType<typeof getAudits>>[0] | null,
  learning: Awaited<ReturnType<typeof getLearningReports>>[0] | null
): EmployeeOsReport["operatingLoop"]["observe"] {
  const active = contexts.filter((c) => isActive(c.lead));
  const due = active.filter((c) => isDue(c.lead));
  const unworked = active.filter((c) => c.lead.priorityScore === null);
  const changes: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  if (due.length)
    changes.push(`${due.length} follow-up${due.length === 1 ? "" : "s"} became due.`);
  if (unworked.length)
    changes.push(`${unworked.length} active lead${unworked.length === 1 ? "" : "s"} still unqualified.`);
  const engaged = active.filter((c) => c.lead.status === "engaged");
  if (engaged.length)
    changes.push(`${engaged.length} account${engaged.length === 1 ? "" : "s"} in active engagement.`);

  if (due.length)
    risks.push(`Overdue follow-ups on ${due.map((c) => c.lead.company).join(", ")}.`);
  if (crmAudit && crmAudit.crmHealth.overall.score < 70)
    risks.push(`CRM health at ${crmAudit.crmHealth.overall.score} — data quality risk.`);
  const singleThreaded = active.filter(
    (c) => c.lead.crm.decisionMakers.length <= 1 && (c.lead.priorityScore ?? 0) >= 60
  );
  if (singleThreaded.length)
    risks.push(`Single-threaded: ${singleThreaded.map((c) => c.lead.company).join(", ")}.`);

  if (unworked.length)
    actions.push(`Qualify ${unworked.map((c) => c.lead.company).join(", ")}.`);
  if (active.filter((c) => !c.hasResearch && (c.lead.priorityScore ?? 0) >= 50).length)
    actions.push("Run research on scored accounts missing profiles.");

  return {
    summary: `Observed ${active.length} active accounts across CRM, ${contexts.reduce((s, c) => s + c.replyCount, 0)} replies, ${contexts.reduce((s, c) => s + c.meetingCount, 0)} meetings.${learning ? ` Learning memory: ${learning.recommendations.length} recommendations.` : ""}`,
    changesDetected: changes.length ? changes : ["No material state changes since last cycle."],
    risksIdentified: risks.length ? risks : ["No critical risks in observation window."],
    actionsRequired: actions.length ? actions : ["Maintain cadence on engaged accounts."],
  };
}

function buildThink(
  workQueue: WorkItem[],
  contexts: LeadContext[]
): EmployeeOsReport["operatingLoop"]["think"] {
  const top = workQueue[0];
  const engaged = contexts.find((c) => c.lead.status === "engaged" && c.lead.priorityScore !== null);

  return {
    highestImpactAction: top
      ? top.task
      : engaged
        ? `Advance ${engaged.lead.company} conversation to booked meeting`
        : "Prospect discovery — expand pipeline with ICP-matching accounts",
    reasoning: top
      ? `${top.reason} Score ${top.score} — highest expected revenue impact in queue.`
      : "No queued maintenance work; focus shifts to revenue creation.",
    alternativesConsidered: workQueue.slice(1, 4).map((w) => w.task),
  };
}

function buildPlan(workQueue: WorkItem[]): OsPlannedTask[] {
  return workQueue.slice(0, 6).map((w) => ({
    task: w.task,
    reason: w.reason,
    expectedOutcome: w.expectedOutcome,
    agent: w.agent,
    leadId: w.leadId,
    company: w.company,
    priority: w.priority,
    confidence: w.confidence,
    riskLevel: w.riskLevel,
    executed: false,
  }));
}

async function executePlan(
  tasks: OsPlannedTask[]
): Promise<{
  completed: EmployeeOsReport["completedWork"];
  artifactsCreated: number;
  delegatedAgents: string[];
}> {
  const completed: EmployeeOsReport["completedWork"] = [];
  const delegatedAgents: string[] = [];
  let artifactsCreated = 0;

  for (const task of tasks) {
    const lead = await getLead(task.leadId);
    if (!lead) continue;

    try {
      const work = taskFromPlan(task);
      if (!work) continue;

      let outcome = "";
      switch (work) {
        case "qualify":
        case "follow_up": {
          const output = await runAgent(lead);
          await applyAgentOutput(lead, output, task.task);
          outcome = `${output.recommendedNextAction.label} — priority ${output.qualification.priorityScore}`;
          break;
        }
        case "research": {
          await runResearch(lead.id);
          artifactsCreated++;
          outcome = "Research profile created";
          await logOsActivity(lead.id, task.task);
          break;
        }
        case "plan": {
          await runPlanning(lead.id);
          artifactsCreated++;
          outcome = "Account plan built";
          await logOsActivity(lead.id, task.task);
          break;
        }
        case "outreach": {
          await runOutreach(lead.id);
          artifactsCreated++;
          outcome = "Outreach playbook ready";
          await logOsActivity(lead.id, task.task);
          break;
        }
      }

      task.executed = true;
      delegatedAgents.push(task.agent);
      completed.push({
        agent: task.agent,
        action: task.task,
        leadId: task.leadId,
        company: task.company,
        outcome,
      });
    } catch {
      completed.push({
        agent: task.agent,
        action: task.task,
        leadId: task.leadId,
        company: task.company,
        outcome: "Failed — will retry next cycle",
      });
    }
  }

  return { completed, artifactsCreated, delegatedAgents };
}

function taskFromPlan(task: OsPlannedTask): WorkKind | null {
  if (task.agent.includes("Qualification")) return task.task.includes("follow") ? "follow_up" : "qualify";
  if (task.agent.includes("Research")) return "research";
  if (task.agent.includes("Planning")) return "plan";
  if (task.agent.includes("Outreach")) return "outreach";
  return null;
}

async function applyAgentOutput(
  lead: Lead,
  output: Awaited<ReturnType<typeof runAgent>>,
  summary: string
): Promise<void> {
  const entry: ActivityEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: "agent_run",
    summary: `Revenue OS — ${summary}`,
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
}

async function logOsActivity(leadId: string, summary: string): Promise<void> {
  const lead = await getLead(leadId);
  if (!lead) return;
  const entry: ActivityEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type: "agent_run",
    summary: `Revenue OS — ${summary}`,
  };
  await updateLead(leadId, { activity: [...lead.activity, entry] });
}

function buildRevenueBrief(
  contexts: LeadContext[],
  completed: EmployeeOsReport["completedWork"],
  discovery: OsDiscoveredOpportunity[]
): EmployeeOsReport["revenueBrief"] {
  const active = contexts.filter((c) => isActive(c.lead));
  const signals = contexts
    .flatMap((c) => c.lead.buyingSignals.map((s) => `${c.lead.company}: ${s}`))
    .slice(0, 5);

  return {
    whatChanged: [
      ...completed.map((c) => `${c.company}: ${c.outcome}`),
      ...(completed.length === 0 ? ["No executions this cycle — queue was empty or blocked."] : []),
    ],
    marketSignals: [
      ...signals,
      ...discovery
        .filter((d) => d.source === "market_discovery")
        .map((d) => `Discovery: ${d.company} — ${d.signals[0]?.signal ?? "ICP match"}`),
    ],
    pipelineSnapshot: `${active.length} active · ${contexts.filter((c) => c.lead.status === "engaged").length} engaged · ${discovery.length} opportunities flagged`,
  };
}

function buildMemory(
  contexts: LeadContext[],
  crmAudit: Awaited<ReturnType<typeof getAudits>>[0] | null,
  learning: Awaited<ReturnType<typeof getLearningReports>>[0] | null
): EmployeeOsReport["memorySnapshot"] {
  const fromAudit = crmAudit?.memoryUpdates.customerMemory ?? [];
  const accountFacts =
    fromAudit.length > 0
      ? fromAudit
      : contexts
          .filter((c) => c.lead.crm.goals.length || c.lead.crm.painPoints.length)
          .map((c) => ({
            leadId: c.lead.id,
            company: c.lead.company,
            facts: [
              ...c.lead.crm.goals.map((g) => `Goal: ${g}`),
              ...c.lead.crm.painPoints.slice(0, 2).map((p) => `Pain: ${p}`),
            ],
          }));

  const salesPatterns = [
    ...(learning?.knowledgeUpdates.winningPatterns.messages.slice(0, 2) ?? []),
    ...(learning?.executiveSummary.whatApexLearned.slice(0, 2) ?? []),
  ];

  return { accountFacts, salesPatterns };
}

function buildRisks(
  contexts: LeadContext[],
  observe: EmployeeOsReport["operatingLoop"]["observe"]
): EmployeeOsReport["risks"] {
  return observe.risksIdentified.map((r) => ({
    description: r,
    level: (/overdue|single-thread|critical/i.test(r) ? "High" : "Medium") as RiskLevel,
    mitigation: /overdue/i.test(r)
      ? "Execute follow-up in this cycle"
      : /single-thread/i.test(r)
        ? "Multi-thread via champion introduction"
        : /CRM/i.test(r)
          ? "Run CRM audit and resolve Critical issues"
          : "Monitor and address in next cycle",
  }));
}

function buildLearningSection(
  learning: Awaited<ReturnType<typeof getLearningReports>>[0] | null,
  completed: EmployeeOsReport["completedWork"]
): EmployeeOsReport["learning"] {
  return {
    whatImproved: completed.length
      ? [`Executed ${completed.length} high-value task${completed.length === 1 ? "" : "s"} autonomously.`]
      : ["Cycle completed — observation baseline refreshed."],
    whatToChange: learning?.recommendations.slice(0, 2).map((r) => r.recommendedChange) ?? [
      "Run Learning cycle for pattern-based improvements.",
    ],
    patternsApplied: learning?.messageInsights.themesToContinue.slice(0, 2) ?? [
      "Signal-first personalization on qualified accounts.",
    ],
  };
}

function buildPipelineImpact(
  completed: EmployeeOsReport["completedWork"],
  artifactsCreated: number,
  contexts: LeadContext[]
): EmployeeOsReport["pipelineImpact"] {
  const qualified = contexts.filter((c) => c.lead.priorityScore !== null).length;
  return {
    expectedRevenueDelta:
      completed.length > 0
        ? `+${completed.length} account${completed.length === 1 ? "" : "s"} advanced through agent stack`
        : "No delta — maintenance cycle only",
    leadsWorked: completed.length,
    artifactsCreated,
    explanation: `${artifactsCreated} research/plan/playbook artifact${artifactsCreated === 1 ? "" : "s"} created; ${qualified} leads now qualified in pipeline.`,
  };
}

function buildMetrics(
  contexts: LeadContext[],
  completed: EmployeeOsReport["completedWork"]
): EmployeeOsReport["performanceMetrics"] {
  const active = contexts.filter((c) => isActive(c.lead));
  const qualified = active.filter((c) => c.lead.priorityScore !== null).length;
  return {
    qualifiedOpportunities: qualified,
    actionsExecuted: completed.length,
    activePipeline: active.length,
    summary: `${completed.length} actions executed on ${active.length} active accounts (${qualified} qualified).`,
  };
}

async function enrichWithOpenai(
  contexts: LeadContext[],
  observe: EmployeeOsReport["operatingLoop"]["observe"],
  think: EmployeeOsReport["operatingLoop"]["think"],
  plannedTasks: OsPlannedTask[],
  completed: EmployeeOsReport["completedWork"],
  discovery: OsDiscoveredOpportunity[],
  memory: EmployeeOsReport["memorySnapshot"],
  risks: EmployeeOsReport["risks"],
  learning: EmployeeOsReport["learning"],
  pipelineImpact: EmployeeOsReport["pipelineImpact"]
): Promise<Omit<EmployeeOsReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    observe,
    think,
    plannedTasks,
    completed,
    leads: contexts.map((c) => ({
      id: c.lead.id,
      company: c.lead.company,
      status: c.lead.status,
      priority: c.lead.priorityScore,
      signals: c.lead.buyingSignals,
      artifacts: {
        research: c.hasResearch,
        plan: c.hasPlan,
        playbook: c.hasPlaybook,
      },
    })),
    discovery,
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: EMPLOYEE_OS_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. The runtime already executed ${completed.length} planned tasks. Produce the full Revenue Employee OS workday JSON report incorporating these results:\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ],
  });

  const parsed = JSON.parse(
    response.choices[0]?.message?.content ?? "{}"
  ) as Omit<EmployeeOsReport, "id" | "timestamp" | "engine">;

  return {
    ...parsed,
    completedWork: completed,
    pipelineImpact,
    memorySnapshot: parsed.memorySnapshot ?? memory,
    opportunityDiscovery: parsed.opportunityDiscovery?.length
      ? parsed.opportunityDiscovery
      : discovery,
    risks: parsed.risks?.length ? parsed.risks : risks,
    learning: parsed.learning ?? learning,
    priorityActions: parsed.priorityActions?.length ? parsed.priorityActions : plannedTasks,
  };
}
