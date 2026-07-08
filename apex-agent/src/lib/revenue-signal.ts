import OpenAI from "openai";
import { getAnalyticsReports } from "./analytics-store";
import { getMeetingReports } from "./meeting-store";
import { getMissions, upsertMission } from "./mission-store";
import { getProspectIntelligenceReports } from "./prospect-intelligence-store";
import { getReplyAnalyses } from "./reply-store";
import { REVENUE_SIGNAL_PROMPT } from "./revenue-signal-prompt";
import {
  getRevenueSignalReports,
  saveRevenueSignalReport,
} from "./revenue-signal-store";
import { getReports } from "./report-store";
import { getLeads } from "./store";
import {
  Lead,
  Mission,
  RevenueOpportunityCandidate,
  RevenueSignal,
  RevenueSignalAlert,
  RevenueSignalMissionTrigger,
  RevenueSignalReport,
  RevenueSignalCategory,
  RiskLevel,
} from "./types";

export { getRevenueSignalReports };

interface SignalInput {
  event: string;
  source: string;
  date: string;
  company: string;
  contact: string | null;
  signalType: RevenueSignalCategory;
  strength: RevenueSignal["strength"];
  confidence: number;
  urgency: number;
  revenueImpact: number;
  businessMeaning: string;
  recommendedAction: string;
  leadId: string | null;
}

export async function runRevenueSignalEngine(): Promise<RevenueSignalReport> {
  const leads = await getLeads();
  const [orchestrator, analytics, prospectIntel, existingMissions] =
    await Promise.all([
      getReports().then((r) => r[0] ?? null),
      getAnalyticsReports().then((r) => r[0] ?? null),
      getProspectIntelligenceReports().then((r) => r[0] ?? null),
      getMissions(),
    ]);

  const signalInputs = await collectSignals(
    leads,
    orchestrator?.timestamp ?? null,
    analytics?.timestamp ?? null,
    prospectIntel?.timestamp ?? null
  );
  const signalsDetected = signalInputs
    .map(toSignal)
    .sort((a, b) => b.priority - a.priority);

  const highPriorityAlerts = buildAlerts(signalsDetected);
  const opportunitiesCreated = buildOpportunities(signalsDetected);
  const missionPrep = buildMissionTriggers(signalsDetected);
  const missionsTriggered = await triggerMissions(missionPrep, existingMissions);
  const marketTrends = buildMarketTrends(signalsDetected);
  const signalPerformance = buildPerformance(signalsDetected);
  const learning = buildLearning(signalsDetected, highPriorityAlerts);

  const body: Omit<RevenueSignalReport, "id" | "timestamp" | "engine"> =
    process.env.OPENAI_API_KEY
      ? await enrichWithOpenAI({
          signalsDetected,
          highPriorityAlerts,
          opportunitiesCreated,
          missionsTriggered,
          marketTrends,
          signalPerformance,
          learning,
        })
      : {
          signalsDetected,
          highPriorityAlerts,
          opportunitiesCreated,
          missionsTriggered,
          marketTrends,
          signalPerformance,
          learning,
          confidence: {
            level: highPriorityAlerts.length > 0 ? "High" : "Medium",
            explanation:
              "Signal engine scored live pipeline and market events with deterministic trigger rules.",
          },
        };

  const report: RevenueSignalReport = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    ...body,
  };

  await saveRevenueSignalReport(report);
  return report;
}

async function collectSignals(
  leads: Lead[],
  orchestratorTs: string | null,
  analyticsTs: string | null,
  prospectTs: string | null
): Promise<SignalInput[]> {
  const inputs: SignalInput[] = [];

  for (const lead of leads) {
    if (["closed_won", "closed_lost"].includes(lead.status)) continue;

    const replies = await getReplyAnalyses(lead.id);
    const meetings = await getMeetingReports(lead.id);
    const due = isFollowupDue(lead);

    for (const rawSignal of lead.buyingSignals) {
      const text = rawSignal.toLowerCase();
      const companyGrowth = /(series|funding|raised|hiring|expansion|office|launch|acquisition|vp|chief)/.test(
        text
      );
      inputs.push({
        event: rawSignal,
        source: "CRM buying signals",
        date: lead.updatedAt,
        company: lead.company,
        contact: lead.contactName,
        signalType: companyGrowth ? "company_growth" : "buying_intent",
        strength: companyGrowth ? "High" : "Medium",
        confidence: 82,
        urgency: companyGrowth ? 72 : 64,
        revenueImpact: (lead.priorityScore ?? 60) + (companyGrowth ? 12 : 5),
        businessMeaning: `${lead.company} is showing active change with potential buying window.`,
        recommendedAction: companyGrowth
          ? "Create research + account strategy refresh mission"
          : "Create intent follow-up mission",
        leadId: lead.id,
      });
    }

    if (replies.length > 0) {
      inputs.push({
        event: "New inbound reply detected",
        source: "Reply Intelligence",
        date: replies[0].timestamp,
        company: lead.company,
        contact: lead.contactName,
        signalType: "sales_activity",
        strength: "High",
        confidence: 90,
        urgency: 92,
        revenueImpact: (lead.priorityScore ?? 55) + 18,
        businessMeaning: "Active conversation is a time-sensitive revenue moment.",
        recommendedAction: "Trigger follow-up mission within 24h",
        leadId: lead.id,
      });
    }

    if (meetings.length > 0) {
      inputs.push({
        event: "Recent meeting activity",
        source: "Meeting Intelligence",
        date: meetings[0].timestamp,
        company: lead.company,
        contact: lead.contactName,
        signalType: "sales_activity",
        strength: "Medium",
        confidence: 84,
        urgency: 68,
        revenueImpact: (lead.priorityScore ?? 55) + 10,
        businessMeaning: "Meeting momentum can accelerate deal progression if acted on quickly.",
        recommendedAction: "Trigger post-meeting advancement mission",
        leadId: lead.id,
      });
    }

    if (due) {
      inputs.push({
        event: "Missed follow-up date",
        source: "CRM",
        date: lead.crm.followUpDate ?? lead.updatedAt,
        company: lead.company,
        contact: lead.contactName,
        signalType: "sales_activity",
        strength: "High",
        confidence: 95,
        urgency: 96,
        revenueImpact: (lead.priorityScore ?? 50) + 14,
        businessMeaning: "Follow-up delay risks deal decay and competitor capture.",
        recommendedAction: "Trigger immediate recovery mission",
        leadId: lead.id,
      });
    }

    if (
      /chief|vp|head/i.test(lead.contactTitle) &&
      Date.now() - new Date(lead.updatedAt).getTime() < 10 * 24 * 60 * 60 * 1000
    ) {
      inputs.push({
        event: "Executive-level contact engagement",
        source: "CRM contact activity",
        date: lead.updatedAt,
        company: lead.company,
        contact: lead.contactName,
        signalType: "contact_change",
        strength: "Medium",
        confidence: 74,
        urgency: 70,
        revenueImpact: (lead.priorityScore ?? 60) + 12,
        businessMeaning: "Executive access improves deal velocity and strategic value.",
        recommendedAction: "Update account strategy for executive persona",
        leadId: lead.id,
      });
    }
  }

  if (orchestratorTs) {
    inputs.push({
      event: "New orchestration cycle completed",
      source: "Revenue Orchestrator",
      date: orchestratorTs,
      company: "Portfolio",
      contact: null,
      signalType: "sales_activity",
      strength: "Medium",
      confidence: 88,
      urgency: 60,
      revenueImpact: 62,
      businessMeaning: "Portfolio-level priorities changed and may require signal-driven mission updates.",
      recommendedAction: "Re-score high-priority signals across active accounts",
      leadId: null,
    });
  }

  if (analyticsTs) {
    inputs.push({
      event: "Analytics refresh available",
      source: "Analytics Agent",
      date: analyticsTs,
      company: "Portfolio",
      contact: null,
      signalType: "buying_intent",
      strength: "Medium",
      confidence: 80,
      urgency: 58,
      revenueImpact: 64,
      businessMeaning: "Updated forecast and bottleneck findings can reveal hidden timing opportunities.",
      recommendedAction: "Trigger targeted signals on bottleneck accounts",
      leadId: null,
    });
  }

  if (prospectTs) {
    inputs.push({
      event: "New prospect intelligence cycle",
      source: "Prospect Intelligence",
      date: prospectTs,
      company: "Market",
      contact: null,
      signalType: "company_growth",
      strength: "High",
      confidence: 86,
      urgency: 75,
      revenueImpact: 78,
      businessMeaning: "Fresh market accounts with intent signals create near-term pipeline opportunities.",
      recommendedAction: "Trigger research missions for top discovered accounts",
      leadId: null,
    });
  }

  return inputs.slice(0, 60);
}

function toSignal(input: SignalInput): RevenueSignal {
  const revenueImpact = clamp(input.revenueImpact);
  const urgency = clamp(input.urgency);
  const confidence = clamp(input.confidence);
  const priority = Math.round((revenueImpact * urgency * confidence) / 10000);
  return {
    id: crypto.randomUUID(),
    ...input,
    confidence,
    urgency,
    revenueImpact,
    priority,
  };
}

function buildAlerts(signals: RevenueSignal[]): RevenueSignalAlert[] {
  return signals
    .filter((s) => s.priority >= 55)
    .slice(0, 10)
    .map((s) => ({
      id: crypto.randomUUID(),
      level: s.priority >= 78 ? "Critical" : s.priority >= 62 ? "High" : "Medium",
      signalId: s.id,
      title: `${s.company}: ${s.event}`,
      reason: `${s.businessMeaning} (impact ${s.revenueImpact}, urgency ${s.urgency}, confidence ${s.confidence}).`,
      actionWindow:
        s.priority >= 78
          ? "Immediate"
          : s.priority >= 62
            ? "Within 24 hours"
            : "Monitor this week",
    }));
}

function buildOpportunities(signals: RevenueSignal[]): RevenueOpportunityCandidate[] {
  return signals
    .filter((s) => s.signalType !== "sales_activity" || s.priority >= 50)
    .slice(0, 8)
    .map((s) => ({
      id: crypto.randomUUID(),
      company: s.company,
      contact: s.contact,
      reason: s.businessMeaning,
      signalEvidence: [`${s.event} (${s.source})`],
      estimatedValue:
        s.revenueImpact >= 80
          ? "$80,000–$150,000 ARR"
          : s.revenueImpact >= 65
            ? "$48,000–$80,000 ARR"
            : "$24,000–$48,000 ARR",
      recommendedApproach: s.recommendedAction,
      priority: s.priority >= 78 ? "Critical" : s.priority >= 62 ? "High" : "Medium",
      leadId: s.leadId,
    }));
}

function buildMissionTriggers(signals: RevenueSignal[]): RevenueSignalMissionTrigger[] {
  return signals
    .filter((s) => s.priority >= 60)
    .slice(0, 8)
    .map((s) => ({
      id: crypto.randomUUID(),
      name: missionNameFromSignal(s),
      reason: s.businessMeaning,
      recommendedWorkflow: workflowFromSignal(s),
      priority: s.priority >= 78 ? "Critical" : "High",
      leadId: s.leadId,
      missionId: null,
    }));
}

async function triggerMissions(
  triggers: RevenueSignalMissionTrigger[],
  existingMissions: Mission[]
): Promise<RevenueSignalMissionTrigger[]> {
  const out: RevenueSignalMissionTrigger[] = [];

  for (const t of triggers) {
    if (!t.leadId) {
      out.push(t);
      continue;
    }

    const duplicate = existingMissions.find(
      (m) =>
        m.leadId === t.leadId &&
        m.name.toLowerCase() === t.name.toLowerCase() &&
        (m.status === "created" || m.status === "assigned" || m.status === "running")
    );

    if (duplicate) {
      out.push({ ...t, missionId: duplicate.id });
      continue;
    }

    const now = new Date().toISOString();
    const mission: Mission = {
      id: crypto.randomUUID(),
      name: t.name,
      objective: t.recommendedWorkflow,
      reason: t.reason,
      priority: t.priority,
      expectedRevenueImpact:
        t.priority === "Critical" ? "$80,000–$150,000 ARR" : "$48,000–$80,000 ARR",
      requiredAgents: requiredAgentsForWorkflow(t.recommendedWorkflow),
      deadline: daysFromNow(t.priority === "Critical" ? 1 : 2),
      successCriteria: "Signal-informed action launched with updated account context",
      riskLevel: t.priority,
      confidence: t.priority === "Critical" ? "High" : "Medium",
      leadId: t.leadId,
      company: t.name.split(":")[0] ?? "Account",
      status: "created",
      currentStep: 0,
      createdAt: now,
      updatedAt: now,
      actualOutcome: null,
      learningGenerated: "Triggered by Revenue Signal Engine",
    };

    await upsertMission(mission);
    out.push({ ...t, missionId: mission.id });
  }

  return out;
}

function buildMarketTrends(signals: RevenueSignal[]): RevenueSignalReport["marketTrends"] {
  const byType = countBy(signals.map((s) => s.signalType));
  const industries = signals
    .map((s) => s.company)
    .filter((c) => c !== "Portfolio" && c !== "Market")
    .slice(0, 3);

  return {
    summary: `${signals.length} signals detected; highest concentration in ${Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => k.replace("_", " "))
      .join(" and ")}.`,
    trendingSignals: signals.slice(0, 5).map((s) => `${s.company}: ${s.event}`),
    industriesHeatingUp: [...new Set(industries)],
    notableChanges: [
      `${byType.company_growth ?? 0} growth signals`,
      `${byType.buying_intent ?? 0} intent signals`,
      `${byType.sales_activity ?? 0} sales activity signals`,
    ],
  };
}

function buildPerformance(
  signals: RevenueSignal[]
): RevenueSignalReport["signalPerformance"] {
  const highPriority = signals.filter((s) => s.priority >= 62).length;
  const avgUrgency = Math.round(
    signals.reduce((sum, s) => sum + s.urgency, 0) / Math.max(signals.length, 1)
  );
  const avgImpact = Math.round(
    signals.reduce((sum, s) => sum + s.revenueImpact, 0) /
      Math.max(signals.length, 1)
  );
  const byType = countBy(signals.map((s) => s.signalType));

  return {
    totalSignals: signals.length,
    highPriorityCount: highPriority,
    falsePositiveRate: signals.length ? `${Math.max(5, 25 - highPriority)}%` : "0%",
    avgUrgency,
    avgImpact,
    byCategory: (Object.keys(byType) as RevenueSignalCategory[]).map((category) => ({
      category,
      count: byType[category] ?? 0,
    })),
  };
}

function buildLearning(
  signals: RevenueSignal[],
  alerts: RevenueSignalAlert[]
): RevenueSignalReport["learning"] {
  const strongest = signals
    .filter((s) => s.priority >= 70)
    .slice(0, 4)
    .map((s) => `${s.event} (${s.company})`);
  const weak = signals
    .filter((s) => s.priority < 40)
    .slice(0, 3)
    .map((s) => `${s.event} (${s.company})`);

  return {
    strongestSignals: strongest.length ? strongest : ["No high-confidence winners yet"],
    weakSignals: weak.length ? weak : ["No weak signals detected this cycle"],
    timingPatterns: [
      alerts.some((a) => a.level === "Critical")
        ? "Reply + follow-up breach combinations convert best when acted on same day"
        : "Monitor 24h response windows for new interaction signals",
      "Hiring and funding signals show strongest impact within first 14 days",
    ],
    improvements: [
      "Increase external source coverage for technology-change signals",
      "Link website intent events to account-level urgency scoring when available",
    ],
  };
}

async function enrichWithOpenAI(
  data: Omit<RevenueSignalReport, "id" | "timestamp" | "engine" | "confidence">
): Promise<Omit<RevenueSignalReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    totals: {
      signals: data.signalsDetected.length,
      alerts: data.highPriorityAlerts.length,
      opportunities: data.opportunitiesCreated.length,
      missions: data.missionsTriggered.length,
    },
    topSignals: data.signalsDetected.slice(0, 8),
    performance: data.signalPerformance,
  };

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: REVENUE_SIGNAL_PROMPT },
      {
        role: "user",
        content: `Signal cycle snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn report JSON, preserving factual counts and IDs.`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty OpenAI response");
  const parsed = JSON.parse(raw) as Partial<
    Omit<RevenueSignalReport, "id" | "timestamp" | "engine">
  >;

  return {
    signalsDetected: data.signalsDetected,
    highPriorityAlerts: data.highPriorityAlerts,
    opportunitiesCreated: data.opportunitiesCreated,
    missionsTriggered: data.missionsTriggered,
    marketTrends: parsed.marketTrends ?? data.marketTrends,
    signalPerformance: data.signalPerformance,
    learning: parsed.learning ?? data.learning,
    confidence: parsed.confidence ?? {
      level: "High",
      explanation: "OpenAI enriched trend and learning narratives on scored signals.",
    },
  };
}

function missionNameFromSignal(signal: RevenueSignal): string {
  if (signal.signalType === "company_growth") {
    return `${signal.company}: Growth signal response`;
  }
  if (signal.signalType === "buying_intent") {
    return `${signal.company}: Buying intent activation`;
  }
  if (signal.signalType === "contact_change") {
    return `${signal.company}: Stakeholder strategy refresh`;
  }
  return `${signal.company}: Revenue momentum action`;
}

function workflowFromSignal(signal: RevenueSignal): string {
  if (signal.signalType === "company_growth") {
    return "Research Agent -> Account Planning Agent -> Outreach Agent";
  }
  if (signal.signalType === "buying_intent") {
    return "Prospect Intelligence -> Research Agent -> Outreach Agent";
  }
  if (signal.signalType === "contact_change") {
    return "Research Agent -> Account Planning Agent";
  }
  return "Reply Agent -> Meeting Agent -> CRM Agent";
}

function requiredAgentsForWorkflow(workflow: string): string[] {
  if (workflow.includes("Prospect Intelligence")) {
    return ["Research Agent", "Account Planning Agent", "Outreach Agent"];
  }
  if (workflow.includes("Meeting Agent")) {
    return ["Reply Agent", "Meeting Agent", "CRM Agent"];
  }
  if (workflow.includes("Account Planning Agent")) {
    return ["Research Agent", "Account Planning Agent", "Outreach Agent"];
  }
  return ["Qualification Agent", "Outreach Agent"];
}

function isFollowupDue(lead: Lead): boolean {
  if (!lead.crm.followUpDate) return false;
  return new Date(lead.crm.followUpDate).getTime() <= Date.now();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countBy<T extends string>(items: T[]): Record<T, number> {
  return items.reduce(
    (acc, item) => {
      acc[item] = (acc[item] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>
  );
}
