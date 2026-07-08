import OpenAI from "openai";
import { DEFAULT_REVENUE_TARGET } from "./analytics";
import { getAnalyticsReports } from "./analytics-store";
import { getAudits } from "./crm-audit-store";
import { CRO_SYSTEM_PROMPT } from "./cro-prompt";
import { getCroReviews, saveCroReview } from "./cro-store";
import { getLearningReports } from "./learning-store";
import { getMeetingReports } from "./meeting-store";
import { getPlaybook } from "./outreach-store";
import { getPlan } from "./plan-store";
import { getReports } from "./report-store";
import { getReplyAnalyses } from "./reply-store";
import { getResearch } from "./research-store";
import { getLeads } from "./store";
import {
  CroAgentDirective,
  CroPriorityAction,
  CroReport,
  CroStrategicDecision,
  Lead,
  LeadStatus,
  RiskLevel,
} from "./types";

export { getCroReviews };

const ENGAGED: LeadStatus[] = ["engaged", "meeting_booked", "closed_won"];

interface LeadContext {
  lead: Lead;
  hasResearch: boolean;
  hasPlan: boolean;
  hasPlaybook: boolean;
  replyCount: number;
  meetingCount: number;
  hasDebrief: boolean;
}

interface SystemIntel {
  orchestrator: Awaited<ReturnType<typeof getReports>>[0] | null;
  analytics: Awaited<ReturnType<typeof getAnalyticsReports>>[0] | null;
  crmAudit: Awaited<ReturnType<typeof getAudits>>[0] | null;
  learning: Awaited<ReturnType<typeof getLearningReports>>[0] | null;
}

export async function runCroReview(revenueTarget: number): Promise<CroReport> {
  const leads = await getLeads();
  const contexts: LeadContext[] = await Promise.all(
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
        hasDebrief: meetings.some((m) => m.meetingAnalysis.hasNotes),
      };
    })
  );

  const [orchestratorReports, analyticsReports, crmAudits, learningReports] =
    await Promise.all([
      getReports(),
      getAnalyticsReports(),
      getAudits(),
      getLearningReports(),
    ]);

  const intel: SystemIntel = {
    orchestrator: orchestratorReports[0] ?? null,
    analytics: analyticsReports[0] ?? null,
    crmAudit: crmAudits[0] ?? null,
    learning: learningReports[0] ?? null,
  };

  const body = process.env.OPENAI_API_KEY
    ? await openaiCro(contexts, intel, revenueTarget)
    : demoCro(contexts, intel, revenueTarget);

  const report: CroReport = {
    ...body,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    revenueTarget,
  };

  await saveCroReview(report);
  return report;
}

type CroBody = Omit<CroReport, "id" | "timestamp" | "engine" | "revenueTarget">;

function parseDealValue(size: string | null): number | null {
  if (!size) return null;
  const matches = [...size.matchAll(/\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?/gi)]
    .map((m) => parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1))
    .filter((n) => n >= 1000);
  if (matches.length === 0) return null;
  return Math.round(matches.reduce((a, b) => a + b, 0) / matches.length);
}

function weightedValue(lead: Lead): number {
  const v = parseDealValue(lead.estimatedDealSize);
  if (!v) return 0;
  return Math.round((v * (lead.closeProbability ?? 30)) / 100);
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

function lastActivityDays(c: LeadContext): number {
  const acts = c.lead.activity;
  return acts.length
    ? daysSince(acts[acts.length - 1].timestamp)
    : daysSince(c.lead.createdAt);
}

function agentFromPerf(
  name: string,
  review: { score: number; metrics: string[]; improvements: string[] } | undefined,
  defaultActivate: boolean
): CroAgentDirective {
  const score = review?.score ?? 0;
  return {
    agent: name,
    assessment: review
      ? `Score ${score}/100. ${review.metrics[0] ?? ""}`
      : "Not yet evaluated — run Learning cycle.",
    producingValue: score >= 50,
    priorityChange:
      score < 50
        ? `Elevate priority — ${review?.improvements[0] ?? "deploy on all active accounts"}`
        : "Maintain current priority",
    behaviorChange: review?.improvements[0] ?? "No change required",
    activate: defaultActivate || score < 70,
  };
}

async function openaiCro(
  contexts: LeadContext[],
  intel: SystemIntel,
  revenueTarget: number
): Promise<CroBody> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    revenueTarget,
    leads: contexts.map((c) => ({
      id: c.lead.id,
      company: c.lead.company,
      status: c.lead.status,
      priority: c.lead.priorityScore,
      fit: c.lead.fitScore,
      dealSize: c.lead.estimatedDealSize,
      closeProbability: c.lead.closeProbability,
      weightedValue: weightedValue(c.lead),
      buyingSignals: c.lead.buyingSignals,
      nextAction: c.lead.crm.nextAction,
      artifacts: {
        research: c.hasResearch,
        plan: c.hasPlan,
        playbook: c.hasPlaybook,
        replies: c.replyCount,
        meetings: c.meetingCount,
        debrief: c.hasDebrief,
      },
    })),
    orchestrator: intel.orchestrator?.executiveSummary ?? null,
    analytics: intel.analytics
      ? {
          forecast: intel.analytics.forecast,
          health: intel.analytics.pipelineHealth.overall,
          topRisks: intel.analytics.executiveSummary.biggestRisks,
          recommendations: intel.analytics.recommendations.slice(0, 5),
        }
      : null,
    crmAudit: intel.crmAudit
      ? {
          health: intel.crmAudit.crmHealth.overall,
          issues: intel.crmAudit.dataQualityIssues.length,
          critical: intel.crmAudit.dataQualityIssues.filter(
            (i) => i.priority === "Critical"
          ).length,
        }
      : null,
    learning: intel.learning
      ? {
          topRecommendations: intel.learning.recommendations.slice(0, 5),
          experiments: intel.learning.experiments.slice(0, 3),
          executive: intel.learning.executiveSummary,
        }
      : null,
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CRO_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. Run the executive operating loop (observe → diagnose → prioritize → direct) and produce the CRO JSON report:\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ],
  });

  return JSON.parse(response.choices[0]?.message?.content ?? "{}") as CroBody;
}

/**
 * Deterministic CRO review: synthesizes intelligence from every agent layer.
 * Directives are evidence-backed; emergencies flagged from real thresholds.
 */
function demoCro(
  contexts: LeadContext[],
  intel: SystemIntel,
  revenueTarget: number
): CroBody {
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
  const active = contexts.filter(
    (c) =>
      c.lead.status !== "closed_won" && c.lead.status !== "closed_lost"
  );
  const engaged = contexts.filter((c) => ENGAGED.includes(c.lead.status));

  const analytics = intel.analytics;
  const expectedRevenue = analytics?.forecast.expectedRevenue ?? active.reduce(
    (s, c) => s + weightedValue(c.lead),
    0
  );
  const weightedPipeline =
    analytics?.forecast.weightedPipelineValue ??
    active.reduce((s, c) => s + weightedValue(c.lead), 0);
  const revenueGap = revenueTarget - expectedRevenue;
  const probHit =
    analytics?.forecast.probabilityOfHittingTarget ??
    Math.max(2, Math.min(98, Math.round((expectedRevenue / revenueTarget) * 70)));
  const forecastConf: CroBody["revenueStatus"]["forecastConfidence"] =
    analytics?.forecast.forecastConfidence ?? (probHit >= 70 ? "High" : probHit >= 40 ? "Medium" : "Low");

  const coverageRatio =
    revenueTarget > 0
      ? (analytics?.forecast.currentPipelineValue ?? 0) / revenueTarget
      : 0;
  const coverageStr = analytics
    ? analytics.pipelineHealth.pipelineCoverage.explanation
    : `${coverageRatio.toFixed(1)}x target coverage`;

  // Rank accounts by weighted value
  const ranked = [...active].sort(
    (a, b) => weightedValue(b.lead) - weightedValue(a.lead)
  );
  const topAccount = ranked[0];

  // --- Strategic diagnosis ---
  const revenueGaps: string[] = [];
  const pipelineProblems: string[] = [];
  const conversionProblems: string[] = [];
  const processFailures: string[] = [];
  const marketOpportunities: string[] = [];
  const agentInefficiencies: string[] = [];
  const strategicRisks: string[] = [];

  if (revenueGap > 0)
    revenueGaps.push(
      `${money(revenueGap)} short of the ${money(revenueTarget)} target at ${probHit}% probability of closing the gap this period.`
    );
  if (coverageRatio < 2 && revenueTarget > 0)
    pipelineProblems.push(
      `Pipeline coverage at ${coverageRatio.toFixed(1)}x — below the 3x healthy benchmark.`
    );
  if (analytics?.pipelineHealth.bottlenecks.length)
    pipelineProblems.push(
      ...analytics.pipelineHealth.bottlenecks.slice(0, 2).map((b) => b.problem)
    );

  const noMeetingEngaged = active.filter(
    (c) => ENGAGED.includes(c.lead.status) && c.meetingCount === 0
  );
  if (noMeetingEngaged.length)
    conversionProblems.push(
      `${noMeetingEngaged.length} engaged account${noMeetingEngaged.length === 1 ? "" : "s"} without a meeting on record.`
    );
  if (analytics?.funnelAnalysis.weakestStage)
    conversionProblems.push(
      `Weakest funnel stage: ${analytics.funnelAnalysis.weakestStage} (${analytics.funnelAnalysis.stages.find((s) => s.stage === analytics.funnelAnalysis.weakestStage)?.conversionRate ?? "—"}%).`
    );

  const unqualified = contexts.filter(
    (c) => c.lead.priorityScore === null && c.lead.status !== "new"
  );
  if (unqualified.length)
    processFailures.push(
      `${unqualified.map((c) => c.lead.company).join(", ")} progressed without qualification scores.`
    );
  const noResearch = active.filter((c) => !c.hasResearch);
  if (noResearch.length)
    processFailures.push(
      `${noResearch.length} active account${noResearch.length === 1 ? "" : "s"} lack research profiles.`
    );

  if (intel.learning?.executiveSummary.whatApexLearned.length)
    marketOpportunities.push(...intel.learning.executiveSummary.whatApexLearned.slice(0, 2));
  if (analytics?.opportunities.length)
    marketOpportunities.push(
      ...analytics.opportunities.slice(0, 2).map((o) => `${o.company}: ${o.type}`)
    );

  if (intel.learning) {
    const lowAgents = Object.entries(intel.learning.agentPerformance)
      .filter(([, a]) => a.score < 50)
      .map(([k]) => k.replace("Agent", ""));
    if (lowAgents.length)
      agentInefficiencies.push(
        `Underperforming agents (score <50): ${lowAgents.join(", ")}.`
      );
  }
  if (!intel.analytics)
    agentInefficiencies.push("Analytics Agent has not run — forecast is unverified.");
  if (!intel.crmAudit)
    agentInefficiencies.push("CRM Agent has not run — data integrity unknown.");

  if (analytics?.executiveSummary.biggestRisks.length)
    strategicRisks.push(...analytics.executiveSummary.biggestRisks.slice(0, 3));

  // --- Pipeline direction ---
  const focusAccounts = ranked.slice(0, 3).map((c) => ({
    leadId: c.lead.id,
    company: c.lead.company,
    reason: `Priority ${c.lead.priorityScore ?? "—"}, weighted value ${money(weightedValue(c.lead))}, status ${c.lead.status}.`,
    action:
      c.lead.status === "engaged"
        ? "Advance to meeting or proposal — compress the cycle now."
        : c.lead.status === "meeting_booked"
          ? "Ensure debrief completes and follow-up sends within 24h."
          : "Run full agent stack: research → plan → outreach.",
  }));

  const interventionRequired: CroBody["pipelineDirection"]["interventionRequired"] = [];
  for (const c of active) {
    if (lastActivityDays(c) > 14)
      interventionRequired.push({
        leadId: c.lead.id,
        company: c.lead.company,
        risk: `Stalled ${lastActivityDays(c)} days`,
        directive: "Re-engage with executive touch or remove from forecast.",
      });
    if (
      c.lead.crm.decisionMakers.length <= 1 &&
      (c.lead.priorityScore ?? 0) >= 60
    )
      interventionRequired.push({
        leadId: c.lead.id,
        company: c.lead.company,
        risk: "Single-threaded high-value deal",
        directive: "Multi-thread through champion within 2 weeks.",
      });
  }

  const abandonOrNurture = contexts
    .filter(
      (c) =>
        c.lead.status === "nurturing" ||
        (c.lead.status === "new" && daysSince(c.lead.createdAt) > 14 && !c.hasPlaybook)
    )
    .map((c) => ({
      leadId: c.lead.id,
      company: c.lead.company,
      reason:
        c.lead.status === "nurturing"
          ? `Explicitly in nurture — ${c.lead.crm.timeline || "no near-term timeline"}.`
          : "New lead with no outreach after 14+ days — qualify or deprioritize.",
    }));

  // --- Priority actions ---
  const priorityActions: CroPriorityAction[] = [];
  let rank = 1;
  const pushAction = (
    action: string,
    agent: string,
    impact: string,
    urgency: RiskLevel,
    confidence: CroPriorityAction["confidence"],
    effort: CroPriorityAction["effort"],
    importance: RiskLevel
  ) => {
    priorityActions.push({
      rank: rank++,
      action,
      responsibleAgent: agent,
      expectedImpact: impact,
      urgency,
      confidence,
      effort,
      strategicImportance: importance,
    });
  };

  if (topAccount) {
    pushAction(
      `All resources on ${topAccount.lead.company} until next stage advance.`,
      "Revenue Orchestrator",
      `Largest weighted value in pipeline (${money(weightedValue(topAccount.lead))}).`,
      "Critical",
      "High",
      "Medium",
      "Critical"
    );
  }
  if (revenueGap > 0) {
    pushAction(
      `Close the ${money(revenueGap)} revenue gap — add pipeline or advance existing deals.`,
      "Analytics Agent + Revenue Orchestrator",
      analytics?.executiveSummary.topActionsNext7Days[0] ?? "Restore forecast credibility",
      revenueGap > revenueTarget * 0.5 ? "Critical" : "High",
      "High",
      "High",
      "Critical"
    );
  }
  for (const c of noMeetingEngaged.slice(0, 2)) {
    pushAction(
      `Book a meeting with ${c.lead.company} — engaged without meeting record.`,
      "Meeting Agent + Outreach Agent",
      "Unlock opportunity-stage conversion",
      "High",
      "Medium",
      "Low",
      "High"
    );
  }
  if (noResearch.length > 0) {
    pushAction(
      `Research ${noResearch.map((c) => c.lead.company).join(", ")} before further investment.`,
      "Research Agent",
      "Research-to-engaged correlation is positive in learning data",
      "Medium",
      intel.learning ? "Medium" : "Low",
      "Low",
      "Medium"
    );
  }
  if (!intel.orchestrator) {
    pushAction(
      "Run first orchestration cycle to establish baseline execution.",
      "Revenue Orchestrator",
      "Activates the autonomous operating loop",
      "High",
      "High",
      "Low",
      "High"
    );
  }
  if (priorityActions.length === 0) {
    pushAction(
      "Maintain current cadence — no critical gaps detected.",
      "Revenue Orchestrator",
      "Sustain momentum",
      "Low",
      "High",
      "Low",
      "Medium"
    );
  }

  // --- Agent management ---
  const perf = intel.learning?.agentPerformance;

  const agents: CroAgentDirective[] = [
    {
      agent: "Revenue Orchestrator",
      assessment: intel.orchestrator
        ? `Last cycle ${intel.orchestrator.timestamp.slice(0, 10)}: ${intel.orchestrator.actionsCompleted.length} actions completed.`
        : "No cycles run — the operating loop is idle.",
      producingValue: !!intel.orchestrator,
      priorityChange: revenueGap > 0 ? "Increase cycle frequency to daily" : "Maintain weekly cadence",
      behaviorChange: topAccount
        ? `Prioritize ${topAccount.lead.company} every cycle until stage advance`
        : "Score and work all unworked leads",
      activate: true,
    },
    agentFromPerf("Research Intelligence", perf?.researchAgent, true),
    agentFromPerf("Account Planning", perf?.planningAgent, true),
    agentFromPerf("Outreach Intelligence", perf?.outreachAgent, true),
    agentFromPerf("Reply Intelligence", perf?.replyAgent, true),
    agentFromPerf("Meeting Intelligence", perf?.meetingAgent, true),
    agentFromPerf("CRM Intelligence", perf?.crmAgent, true),
    agentFromPerf("Revenue Analytics", perf?.analyticsAgent, true),
    {
      agent: "Learning & Optimization",
      assessment: intel.learning
        ? `Improvement potential ${intel.learning.performanceAnalysis.optimizationScore.revenueImprovementPotential.score}/100; ${intel.learning.recommendations.length} recommendations.`
        : "Not yet run — schedule weekly learning cycles.",
      producingValue: !!intel.learning,
      priorityChange: "Run after every orchestration cycle",
      behaviorChange: intel.learning?.recommendations[0]?.recommendedChange ?? "Establish baseline patterns",
      activate: true,
    },
  ];

  const orchestratorDirective = revenueGap > 0
    ? `Execute daily cycles focused on closing the ${money(revenueGap)} gap. Work top 2 weighted accounts first, then address stalled deals.`
    : `Maintain weekly cycles. Protect forecast surplus and advance ${topAccount?.lead.company ?? "top accounts"} to closed-won.`;

  // --- Resource allocation ---
  const moreResearch = noResearch.map((c) => c.lead.company);
  const moreOutreach = active
    .filter((c) => c.hasPlan && !c.hasPlaybook)
    .map((c) => c.lead.company);
  const moreFollowUp = active
    .filter((c) => lastActivityDays(c) > 7 && lastActivityDays(c) <= 14)
    .map((c) => c.lead.company);
  const moreMeetings = noMeetingEngaged.map((c) => c.lead.company);
  const reduceEffort = [
    ...contexts
      .filter((c) => c.lead.status === "closed_lost")
      .map((c) => c.lead.company),
    ...abandonOrNurture.filter((a) => contexts.find((c) => c.lead.id === a.leadId)?.lead.status === "nurturing").map((a) => a.company),
  ];

  // --- Strategic decisions ---
  const strategicDecisions: CroStrategicDecision[] = [];
  if (revenueGap > revenueTarget * 0.3) {
    strategicDecisions.push({
      decision: "Shift to pipeline-generation mode",
      reason: `Revenue gap exceeds 30% of target (${money(revenueGap)}).`,
      evidence: analytics?.executiveSummary.revenueOutlook ?? `Expected ${money(expectedRevenue)} vs target ${money(revenueTarget)}`,
      expectedImpact: "Restore 3x coverage within 30 days",
      risk: "Existing deals may stall if all effort goes to top-of-funnel",
      confidence: "High",
      timeframe: "30 days",
    });
  }
  if (intel.learning?.performanceAnalysis.prospecting.highestPerforming.length) {
    strategicDecisions.push({
      decision: "Concentrate outbound on highest-performing segments",
      reason: "Learning data shows segment-level conversion differences.",
      evidence: intel.learning.performanceAnalysis.prospecting.highestPerforming[0],
      expectedImpact: "Higher reply and meeting rates on same effort",
      risk: "Over-indexing on small sample — validate with experiments",
      confidence: "Medium",
      timeframe: "2 weeks",
    });
  }
  if (strategicDecisions.length === 0) {
    strategicDecisions.push({
      decision: "Continue current sales motion",
      reason: "No material strategic shift required this period.",
      evidence: `${engaged.length} engaged accounts, forecast confidence ${forecastConf}.`,
      expectedImpact: "Steady progress toward target",
      risk: "Complacency if market shifts",
      confidence: "Medium",
      timeframe: "Ongoing",
    });
  }

  // --- Risks & emergencies ---
  const risks: CroBody["risks"] = [];
  const addRisk = (
    category: CroBody["risks"][0]["category"],
    description: string,
    level: RiskLevel,
    mitigation: string,
    emergency: boolean
  ) => risks.push({ category, description, level, mitigation, emergency });

  if (revenueGap > revenueTarget * 0.5)
    addRisk(
      "Forecast",
      `Forecast collapse risk: ${money(revenueGap)} gap (${Math.round((revenueGap / revenueTarget) * 100)}% of target)`,
      "Critical",
      "Emergency pipeline generation + advance top 2 deals this week",
      true
    );
  if (coverageRatio < 1.5 && revenueTarget > 0)
    addRisk(
      "Pipeline",
      `Pipeline shortage: ${coverageRatio.toFixed(1)}x coverage vs 3x benchmark`,
      "High",
      "Add qualified pipeline worth 3x the revenue gap",
      coverageRatio < 1
    );
  for (const c of interventionRequired.filter((i) => i.risk.startsWith("Stalled")))
    addRisk("Deal", `${c.company}: ${c.risk}`, "High", c.directive, lastActivityDays(contexts.find((x) => x.lead.id === c.leadId)!) > 30);
  if (intel.crmAudit && intel.crmAudit.crmHealth.overall.score < 60)
    addRisk(
      "Data",
      `CRM health at ${intel.crmAudit.crmHealth.overall.score} — decisions may be based on unreliable data`,
      "High",
      "Run CRM audit and resolve Critical issues within 24h",
      intel.crmAudit.dataQualityIssues.some((i) => i.priority === "Critical")
    );
  const competitorDeals = active.filter((c) => c.lead.crm.competitors.length > 0);
  if (competitorDeals.length)
    addRisk(
      "Competitive",
      `${competitorDeals.map((c) => c.lead.company).join(", ")} evaluating competitors`,
      "Medium",
      "Deliver differentiation assets before next interaction",
      false
    );
  if (risks.length === 0)
    addRisk("Pipeline", "No critical risks detected", "Low", "Maintain discipline", false);

  // --- Weekly operating review ---
  const wins: string[] = [];
  if (engaged.length)
    wins.push(`${engaged.length} account${engaged.length === 1 ? "" : "s"} at engaged or beyond.`);
  if (contexts.some((c) => c.replyCount > 0))
    wins.push("Inbound replies processed and advanced through Reply Agent.");
  if (contexts.some((c) => c.hasDebrief))
    wins.push("Meeting debriefs captured structured intelligence.");
  if (intel.orchestrator)
    wins.push(`Orchestrator completed ${intel.orchestrator.actionsCompleted.length} actions in last cycle.`);

  const problems = [
    ...revenueGaps,
    ...pipelineProblems.slice(0, 2),
    ...conversionProblems.slice(0, 1),
  ];
  if (problems.length === 0) problems.push("No material problems this period.");

  const nextWeekPriorities = priorityActions.slice(0, 5).map((a) => ({
    action: a.action,
    expectedOutcome: a.expectedImpact,
    responsibleAgent: a.responsibleAgent,
    priority: a.urgency,
  }));

  const doNothingRisk =
    revenueGap > 0
      ? `Gap widens to ${money(revenueGap * 1.2)} as deals decay and quarter-end pressure increases.`
      : "Top accounts stall without executive attention; competitors shape buying criteria.";

  const biggestUpside = topAccount
    ? `Close ${topAccount.lead.company} (${money(weightedValue(topAccount.lead))} weighted) — covers ${Math.round((weightedValue(topAccount.lead) / Math.max(1, revenueTarget)) * 100)}% of target.`
    : analytics?.scenarioModels[0]?.estimatedRevenueImpact ?? "Advance engaged accounts to meeting stage";

  const greatestThreat =
    risks.find((r) => r.emergency)?.description ??
    risks.find((r) => r.level === "Critical")?.description ??
    strategicRisks[0] ??
    "No critical threat identified";

  return {
    executiveSummary: {
      situation: `${active.length} active accounts, ${money(expectedRevenue)} expected vs ${money(revenueTarget)} target (${probHit}% probability). ${engaged.length} engaged. CRM health ${intel.crmAudit?.crmHealth.overall.score ?? "—"}, pipeline health ${analytics?.pipelineHealth.overall.score ?? "—"}.`,
      primaryQuestion:
        revenueGap > 0
          ? `How do we close the ${money(revenueGap)} gap with highest-confidence actions this week?`
          : "How do we convert forecast surplus into closed revenue fastest?",
      topPriority: priorityActions[0]?.action ?? "Run orchestration cycle",
      doNothingRisk,
      biggestUpside,
      greatestThreat,
    },
    revenueStatus: {
      progressToGoal:
        revenueGap <= 0
          ? `Ahead of target by ${money(-revenueGap)} (${Math.round((expectedRevenue / revenueTarget) * 100)}% of goal).`
          : `${Math.round((expectedRevenue / revenueTarget) * 100)}% of target — ${money(revenueGap)} remaining.`,
      forecast: analytics?.executiveSummary.revenueOutlook ?? `Expected revenue ${money(expectedRevenue)}.`,
      forecastConfidence: forecastConf,
      pipelineCoverage: coverageStr,
      weightedPipeline,
      expectedRevenue,
      revenueGap,
      probabilityOfHittingTarget: probHit,
    },
    strategicDiagnosis: {
      revenueGaps,
      pipelineProblems,
      conversionProblems,
      processFailures,
      marketOpportunities,
      agentInefficiencies,
      strategicRisks,
    },
    priorityActions,
    pipelineDirection: {
      focusAccounts,
      interventionRequired,
      abandonOrNurture,
      coverageAssessment: analytics?.pipelineHealth.pipelineCoverage.explanation ?? coverageStr,
      qualityAssessment: analytics?.pipelineHealth.pipelineQuality.explanation ?? "Run analytics for quality score.",
      velocityAssessment: analytics?.pipelineHealth.dealVelocity.explanation ?? "Run analytics for velocity score.",
    },
    agentManagement: { agents, orchestratorDirective },
    resourceAllocation: {
      moreResearch,
      moreOutreach,
      moreFollowUp,
      moreMeetings,
      reduceEffort,
      rationale: `Concentrate effort on ${focusAccounts.map((f) => f.company).join(", ") || "top accounts"}; reduce spend on ${reduceEffort.join(", ") || "none"}.`,
    },
    strategicDecisions,
    weeklyOperatingReview: {
      revenueSummary: `${money(expectedRevenue)} expected against ${money(revenueTarget)} target. Forecast confidence: ${forecastConf}.`,
      wins: wins.length ? wins : ["Baseline establishment in progress."],
      problems,
      strategicDecisions: strategicDecisions.map((d) => `${d.decision}: ${d.reason}`),
      nextWeekPriorities,
    },
    risks,
    confidence: {
      level:
        intel.analytics && intel.crmAudit && intel.learning
          ? "High"
          : intel.analytics
            ? "Medium"
            : "Low",
      explanation:
        "CRO synthesis from Orchestrator, Analytics, CRM, and Learning layers plus live pipeline data. (Demo engine — connect OpenAI for full executive reasoning.)",
      evidenceUsed: [
        `${contexts.length} leads with full artifact scan`,
        intel.orchestrator ? `Orchestrator: ${intel.orchestrator.timestamp.slice(0, 10)}` : "No orchestrator baseline",
        intel.analytics ? `Analytics: ${intel.analytics.timestamp.slice(0, 10)}` : "No analytics baseline",
        intel.crmAudit ? `CRM audit: ${intel.crmAudit.timestamp.slice(0, 10)}` : "No CRM audit",
        intel.learning ? `Learning: ${intel.learning.timestamp.slice(0, 10)}` : "No learning cycle",
      ],
      assumptions: [
        "Revenue figures from latest Analytics run when available.",
        "Agent scores from latest Learning cycle when available.",
        "Weighted deal values use recorded close probabilities.",
      ],
    },
  };
}
