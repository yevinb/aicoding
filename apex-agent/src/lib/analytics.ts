import OpenAI from "openai";
import { ANALYTICS_SYSTEM_PROMPT } from "./analytics-prompt";
import { getAnalyticsReports, saveAnalyticsReport } from "./analytics-store";
import { getMeetingReports } from "./meeting-store";
import { getPlaybook } from "./outreach-store";
import { getPlan } from "./plan-store";
import { getReplyAnalyses } from "./reply-store";
import { getResearch } from "./research-store";
import { getLeads } from "./store";
import {
  AnalyticsReport,
  Bottleneck,
  Lead,
  LeadStatus,
  VelocityEntry,
} from "./types";

export { getAnalyticsReports };

export const DEFAULT_REVENUE_TARGET = 250000;

interface LeadContext {
  lead: Lead;
  hasResearch: boolean;
  hasPlan: boolean;
  hasPlaybook: boolean;
  replyCount: number;
  meetingCount: number;
}

export async function runAnalytics(revenueTarget: number): Promise<AnalyticsReport> {
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
      };
    })
  );

  const body = process.env.OPENAI_API_KEY
    ? await openaiAnalytics(contexts, revenueTarget)
    : demoAnalytics(contexts, revenueTarget);

  const report: AnalyticsReport = {
    ...body,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    revenueTarget,
  };

  await saveAnalyticsReport(report);
  return report;
}

type AnalyticsBody = Omit<
  AnalyticsReport,
  "id" | "timestamp" | "engine" | "revenueTarget"
>;

async function openaiAnalytics(
  contexts: LeadContext[],
  revenueTarget: number
): Promise<AnalyticsBody> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = contexts.map((c) => ({
    id: c.lead.id,
    company: c.lead.company,
    contact: `${c.lead.contactName} (${c.lead.contactTitle})`,
    industry: c.lead.industry,
    companySize: c.lead.companySize,
    status: c.lead.status,
    scores: {
      fit: c.lead.fitScore,
      intent: c.lead.intentScore,
      priority: c.lead.priorityScore,
      estimatedDealSize: c.lead.estimatedDealSize,
      closeProbability: c.lead.closeProbability,
    },
    buyingSignals: c.lead.buyingSignals,
    crm: c.lead.crm,
    createdAt: c.lead.createdAt,
    updatedAt: c.lead.updatedAt,
    activity: c.lead.activity.map((a) => ({
      when: a.timestamp,
      type: a.type,
      summary: a.summary,
    })),
    artifacts: {
      research: c.hasResearch,
      accountPlan: c.hasPlan,
      outreachPlaybook: c.hasPlaybook,
      replyAnalyses: c.replyCount,
      meetings: c.meetingCount,
    },
  }));

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: ANALYTICS_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. Revenue target: $${revenueTarget.toLocaleString()}. Analyze this complete revenue system and produce the JSON report:\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ],
  });

  return JSON.parse(response.choices[0]?.message?.content ?? "{}") as AnalyticsBody;
}

/** Midpoint of a deal-size string like "$48,000 ARR" or "$80,000–$150,000 ARR". */
function parseDealValue(size: string | null): number | null {
  if (!size) return null;
  const matches = [...size.matchAll(/\$?\s*([\d,]+(?:\.\d+)?)\s*(k)?/gi)]
    .map((m) => parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1))
    .filter((n) => n >= 1000);
  if (matches.length === 0) return null;
  return Math.round(matches.reduce((a, b) => a + b, 0) / matches.length);
}

const STAGE_ORDER: Record<LeadStatus, number> = {
  new: 0,
  researching: 1,
  contacted: 2,
  engaged: 3,
  nurturing: 3,
  meeting_booked: 4,
  closed_won: 5,
  closed_lost: 5,
};

/**
 * Deterministic analytics: every figure is computed from record data.
 * Assumptions are listed explicitly; nothing is invented.
 */
function demoAnalytics(
  contexts: LeadContext[],
  revenueTarget: number
): AnalyticsBody {
  const now = Date.now();
  const daysSince = (iso: string) =>
    Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

  const active = contexts.filter(
    (c) => c.lead.status !== "closed_won" && c.lead.status !== "closed_lost"
  );
  const won = contexts.filter((c) => c.lead.status === "closed_won");
  const lost = contexts.filter((c) => c.lead.status === "closed_lost");

  // --- Forecast (facts: dealSize + closeProbability from records) ---
  const valued = active
    .map((c) => ({
      ctx: c,
      value: parseDealValue(c.lead.estimatedDealSize),
      prob: c.lead.closeProbability,
    }))
    .filter((v): v is { ctx: LeadContext; value: number; prob: number | null } => v.value !== null);

  const currentPipelineValue = valued.reduce((s, v) => s + v.value, 0);
  const weightedPipelineValue = Math.round(
    valued.reduce((s, v) => s + (v.value * (v.prob ?? 30)) / 100, 0)
  );
  const wonRevenue = won.reduce(
    (s, c) => s + (parseDealValue(c.lead.estimatedDealSize) ?? 0),
    0
  );
  const expectedRevenue = wonRevenue + weightedPipelineValue;
  const bestCase = wonRevenue + Math.round(currentPipelineValue * 0.85);
  const worstCase =
    wonRevenue +
    Math.round(
      valued
        .filter((v) => (v.prob ?? 0) >= 60)
        .reduce((s, v) => s + (v.value * (v.prob ?? 0)) / 100, 0)
    );
  const revenueGap = revenueTarget - expectedRevenue;
  const probabilityOfHittingTarget =
    revenueTarget <= 0
      ? 100
      : Math.max(2, Math.min(98, Math.round((expectedRevenue / revenueTarget) * 70 + (bestCase >= revenueTarget ? 15 : 0))));
  const unvalued = active.length - valued.length;

  // --- Funnel (stage reached = current status position; assumption stated) ---
  const qualified = contexts.filter((c) => c.lead.priorityScore !== null).length;
  const meetings = contexts.filter(
    (c) => c.meetingCount > 0 || STAGE_ORDER[c.lead.status] >= 4
  ).length;
  const opportunities = contexts.filter(
    (c) => (c.lead.closeProbability ?? 0) >= 40 || c.lead.status === "meeting_booked" || c.lead.status === "closed_won"
  ).length;
  const totalLeads = contexts.length;
  const stages = [
    { stage: "Lead → Qualified", entered: totalLeads, converted: qualified },
    { stage: "Qualified → Meeting", entered: qualified, converted: meetings },
    { stage: "Meeting → Opportunity", entered: meetings, converted: opportunities },
    { stage: "Opportunity → Closed Won", entered: opportunities, converted: won.length },
  ].map((s) => ({
    ...s,
    conversionRate: s.entered > 0 ? Math.round((s.converted / s.entered) * 100) : 0,
  }));
  const sortedByRate = [...stages].filter((s) => s.entered > 0).sort((a, b) => b.conversionRate - a.conversionRate);
  const strongestStage = sortedByRate[0]?.stage ?? "Insufficient data";
  const weakestStage = sortedByRate[sortedByRate.length - 1]?.stage ?? "Insufficient data";
  const weakest = sortedByRate[sortedByRate.length - 1];

  // --- Velocity ---
  const ages = active.map((c) => daysSince(c.lead.createdAt));
  const averageDealAgeDays = ages.length
    ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
    : 0;
  const lastActivityDays = (c: LeadContext) =>
    c.lead.activity.length
      ? daysSince(c.lead.activity[c.lead.activity.length - 1].timestamp)
      : daysSince(c.lead.createdAt);

  const stalled: VelocityEntry[] = active
    .filter((c) => lastActivityDays(c) > 14)
    .map((c) => ({
      leadId: c.lead.id,
      company: c.lead.company,
      note: `${lastActivityDays(c)} days without activity at status "${c.lead.status}".`,
    }));
  const fastMoving: VelocityEntry[] = active
    .filter((c) => STAGE_ORDER[c.lead.status] >= 3 && daysSince(c.lead.createdAt) <= 21)
    .map((c) => ({
      leadId: c.lead.id,
      company: c.lead.company,
      note: `Reached "${c.lead.status}" within ${daysSince(c.lead.createdAt)} days of entering the pipeline.`,
    }));
  const slowMoving: VelocityEntry[] = active
    .filter(
      (c) =>
        STAGE_ORDER[c.lead.status] <= 2 &&
        daysSince(c.lead.createdAt) > 21 &&
        lastActivityDays(c) <= 14
    )
    .map((c) => ({
      leadId: c.lead.id,
      company: c.lead.company,
      note: `Still at "${c.lead.status}" after ${daysSince(c.lead.createdAt)} days despite recent activity.`,
    }));

  const stageTimings = [
    {
      transition: "Created → first outreach",
      averageDays: avgDaysToActivity(active, /outreach|email|contacted|sequence|sent/i),
    },
    {
      transition: "First outreach → first reply",
      averageDays: avgDaysToActivity(active, /reply|responded|inbound/i),
    },
    {
      transition: "First reply → meeting",
      averageDays: avgDaysToActivity(active, /meeting|debrief|prep/i),
    },
  ];

  // --- Bottlenecks (each backed by counted evidence) ---
  const bottlenecks: Bottleneck[] = [];
  const noMeeting = active.filter((c) => c.meetingCount === 0 && STAGE_ORDER[c.lead.status] >= 3);
  if (noMeeting.length > 0)
    bottlenecks.push({
      problem: "Engaged opportunities without meetings",
      evidence: `${noMeeting.length} of ${active.length} active leads are engaged or beyond but have no meeting on record (${noMeeting.map((c) => c.lead.company).join(", ")}).`,
      businessImpact: "Engagement decays without a meeting; these deals cannot progress to opportunity stage.",
      solution: "Push a meeting CTA in the next touch for every engaged lead.",
      priority: "High",
    });
  const noNextStep = active.filter((c) => !c.lead.crm.nextAction);
  if (noNextStep.length > 0)
    bottlenecks.push({
      problem: "Deals without a next step",
      evidence: `${noNextStep.length} active record${noNextStep.length === 1 ? "" : "s"} have no next action set.`,
      businessImpact: "Deals with no next step statistically stall and silently die.",
      solution: "Run the per-lead agent or CRM audit to set a next action on every record.",
      priority: "Critical",
    });
  const singleThreaded = active.filter(
    (c) => c.lead.crm.decisionMakers.length <= 1 && (c.lead.priorityScore ?? 0) >= 60
  );
  if (singleThreaded.length > 0)
    bottlenecks.push({
      problem: "High-value deals are single-threaded",
      evidence: `${singleThreaded.length} high-priority deal${singleThreaded.length === 1 ? "" : "s"} (${singleThreaded.map((c) => c.lead.company).join(", ")}) have at most one mapped decision maker.`,
      businessImpact: "One contact going quiet kills the deal; forecast risk is concentrated.",
      solution: "Ask champions for introductions; map the buying committee via the Planning Agent.",
      priority: "High",
    });
  const unqualifiedOld = active.filter(
    (c) => c.lead.priorityScore === null && daysSince(c.lead.createdAt) > 7
  );
  if (unqualifiedOld.length > 0)
    bottlenecks.push({
      problem: "Leads sitting unqualified",
      evidence: `${unqualifiedOld.length} lead${unqualifiedOld.length === 1 ? "" : "s"} older than a week ${unqualifiedOld.length === 1 ? "has" : "have"} never been scored.`,
      businessImpact: "Unscored leads cannot be prioritized or forecast; effort allocation is blind.",
      solution: "Run qualification on every lead within 48 hours of creation.",
      priority: "Medium",
    });
  if (stalled.length > 0)
    bottlenecks.push({
      problem: "Stalled opportunities",
      evidence: `${stalled.length} active deal${stalled.length === 1 ? "" : "s"} with 14+ days of silence.`,
      businessImpact: "Stalled pipeline inflates the forecast without producing revenue.",
      solution: "Re-engage with a pattern-break touch or deliberately disqualify.",
      priority: "High",
    });

  // --- Hidden opportunities ---
  const opps: AnalyticsBody["opportunities"] = [];
  for (const c of active) {
    const l = c.lead;
    if ((l.fitScore ?? 0) >= 65 && !c.hasPlaybook && c.replyCount === 0 && STAGE_ORDER[l.status] <= 2)
      opps.push({
        leadId: l.id,
        company: l.company,
        type: "High-fit account with no outreach",
        whyItMatters: `Fit score ${l.fitScore} but no playbook or replies — qualified demand left on the table.`,
        recommendedAction: "Build the outreach playbook and start the sequence this week.",
        estimatedValue: l.estimatedDealSize ?? "Unscored",
      });
    if (l.buyingSignals.length >= 2 && STAGE_ORDER[l.status] <= 2)
      opps.push({
        leadId: l.id,
        company: l.company,
        type: "Strong buying signals, early stage",
        whyItMatters: `${l.buyingSignals.length} recorded signals (${l.buyingSignals[0]}…) with outreach not yet converted — timing window is open now.`,
        recommendedAction: "Prioritize above current sequence order; anchor outreach on the freshest signal.",
        estimatedValue: l.estimatedDealSize ?? "Unscored",
      });
    if (c.replyCount >= 2 || c.meetingCount >= 1)
      opps.push({
        leadId: l.id,
        company: l.company,
        type: "Increased engagement",
        whyItMatters: `${c.replyCount} repl${c.replyCount === 1 ? "y" : "ies"} and ${c.meetingCount} meeting record${c.meetingCount === 1 ? "" : "s"} — engagement momentum is real.`,
        recommendedAction: "Compress the cycle: propose concrete next step with a date while momentum holds.",
        estimatedValue: l.estimatedDealSize ?? "Unscored",
      });
    if (l.crm.competitors.length > 0 && STAGE_ORDER[l.status] >= 3)
      opps.push({
        leadId: l.id,
        company: l.company,
        type: "Competitor risk — defend and differentiate",
        whyItMatters: `Evaluating ${l.crm.competitors.join(", ")} — active deals with named competitors close for whoever shapes the criteria first.`,
        recommendedAction: "Deliver a differentiation asset (comparison, proof point) before the next meeting.",
        estimatedValue: l.estimatedDealSize ?? "Unscored",
      });
  }
  for (const c of contexts.filter((x) => x.lead.status === "closed_lost")) {
    if (daysSince(c.lead.updatedAt) > 60)
      opps.push({
        leadId: c.lead.id,
        company: c.lead.company,
        type: "Reactivation candidate",
        whyItMatters: `Closed lost ${daysSince(c.lead.updatedAt)} days ago — circumstances change; the original pain rarely disappears.`,
        recommendedAction: "Re-research for new signals before any re-engagement.",
        estimatedValue: c.lead.estimatedDealSize ?? "Unknown",
      });
  }

  // --- Risks ---
  const risks: AnalyticsBody["risks"] = [];
  for (const c of active) {
    const l = c.lead;
    if (l.crm.decisionMakers.length <= 1 && (l.priorityScore ?? 0) >= 60)
      risks.push({
        leadId: l.id,
        company: l.company,
        risk: "Single-threaded high-priority deal",
        level: "High",
        mitigation: "Multi-thread through champion introductions within two weeks.",
      });
    if (lastActivityDays(c) > 14)
      risks.push({
        leadId: l.id,
        company: l.company,
        risk: `Stale: ${lastActivityDays(c)} days without activity`,
        level: lastActivityDays(c) > 30 ? "Critical" : "High",
        mitigation: "Re-engage now or remove from the forecast.",
      });
    if (l.closeProbability !== null && l.closeProbability >= 50 && !l.crm.timeline)
      risks.push({
        leadId: l.id,
        company: l.company,
        risk: "High close probability with no confirmed timeline",
        level: "Medium",
        mitigation: "Confirm the compelling event; without one, discount the probability.",
      });
    if (!l.crm.nextAction)
      risks.push({
        leadId: l.id,
        company: l.company,
        risk: "No decision process / next step recorded",
        level: "High",
        mitigation: "Establish mutual next steps in the next interaction.",
      });
  }
  if (unvalued > 0)
    risks.push({
      leadId: "",
      company: "Pipeline",
      risk: `${unvalued} active lead${unvalued === 1 ? "" : "s"} carry no deal value — the forecast is understated or these are unqualified`,
      level: "Medium",
      mitigation: "Qualify and size every active lead so the forecast covers the whole pipeline.",
    });
  if (revenueGap > 0)
    risks.push({
      leadId: "",
      company: "Pipeline",
      risk: `Revenue gap of ${money(revenueGap)} against the ${money(revenueTarget)} target`,
      level: revenueGap > revenueTarget * 0.5 ? "Critical" : "High",
      mitigation: "Add qualified pipeline now — coverage below 3x target rarely closes the gap in-quarter.",
    });

  // --- Health scores ---
  const coverageRatio = revenueTarget > 0 ? currentPipelineValue / revenueTarget : 3;
  const pipelineCoverage = Math.min(100, Math.round((coverageRatio / 3) * 100));
  const scoredActive = active.filter((c) => c.lead.priorityScore !== null);
  const pipelineQuality = scoredActive.length
    ? Math.round(
        scoredActive.reduce((s, c) => s + (c.lead.priorityScore ?? 0), 0) / scoredActive.length -
          (active.length - scoredActive.length) * 5
      )
    : 30;
  const dealVelocity = Math.max(
    0,
    100 - stalled.length * 20 - Math.max(0, averageDealAgeDays - 30) * 2
  );
  const opportunityHealth = active.length
    ? Math.round(
        (active.filter((c) => c.lead.crm.nextAction).length / active.length) * 40 +
          (active.filter((c) => c.lead.crm.decisionMakers.length >= 2).length / active.length) * 30 +
          (active.filter((c) => c.lead.crm.followUpDate).length / active.length) * 30
      )
    : 100;
  const forecastReliability = active.length
    ? Math.round((valued.filter((v) => v.prob !== null).length / active.length) * 100)
    : 100;
  const activityHealth = active.length
    ? Math.round((active.filter((c) => lastActivityDays(c) <= 7).length / active.length) * 100)
    : 100;
  const overall = Math.round(
    pipelineCoverage * 0.2 +
      Math.max(0, pipelineQuality) * 0.2 +
      dealVelocity * 0.15 +
      opportunityHealth * 0.15 +
      forecastReliability * 0.15 +
      activityHealth * 0.15
  );

  // --- Team (agent) performance, from activity data ---
  const replyTotal = contexts.reduce((s, c) => s + c.replyCount, 0);
  const meetingTotal = contexts.reduce((s, c) => s + c.meetingCount, 0);
  const overdueFollowUps = active.filter(
    (c) => c.lead.crm.followUpDate && new Date(c.lead.crm.followUpDate).getTime() < now
  );
  const teamPerformance: AnalyticsBody["teamPerformance"] = {
    activityQuality: `${contexts.reduce((s, c) => s + c.lead.activity.length, 0)} logged activities across ${contexts.length} leads; ${active.filter((c) => lastActivityDays(c) <= 7).length}/${active.length} active leads touched in the last 7 days.`,
    responseTimes: replyTotal > 0 ? `${replyTotal} inbound repl${replyTotal === 1 ? "y" : "ies"} processed through Reply Intelligence — every reply received a same-day analyzed draft.` : "No inbound replies processed yet — response-time data unavailable.",
    meetingEffectiveness: meetingTotal > 0 ? `${meetingTotal} meeting record${meetingTotal === 1 ? "" : "s"}; debriefs captured structured intelligence and follow-ups.` : "No meetings recorded yet.",
    outreachPerformance: `${contexts.filter((c) => c.hasPlaybook).length}/${contexts.length} leads have outreach playbooks; ${contexts.filter((c) => STAGE_ORDER[c.lead.status] >= 3).length} reached engaged or beyond.`,
    conversionPerformance: `Lead → qualified ${stages[0].conversionRate}%, qualified → meeting ${stages[1].conversionRate}%, meeting → opportunity ${stages[2].conversionRate}%.`,
    followUpDiscipline: overdueFollowUps.length === 0 ? "No overdue follow-ups — discipline is holding." : `${overdueFollowUps.length} overdue follow-up${overdueFollowUps.length === 1 ? "" : "s"} (${overdueFollowUps.map((c) => c.lead.company).join(", ")}).`,
    whatWorks: [
      ...(fastMoving.length ? [`Signal-anchored engagement: ${fastMoving.map((f) => f.company).join(", ")} moved to engaged quickly.`] : []),
      ...(replyTotal > 0 ? ["Reply handling keeps conversations moving the same day."] : []),
    ],
    whatFails: [
      ...(stalled.length ? [`${stalled.length} deal${stalled.length === 1 ? "" : "s"} allowed to go silent for 14+ days.`] : []),
      ...(unvalued > 0 ? ["Leads left unsized, making the forecast incomplete."] : []),
      ...(lost.length ? [`${lost.length} closed-lost record${lost.length === 1 ? "" : "s"} — loss reasons should be reviewed.`] : []),
    ],
    whatShouldChange: [
      "Qualify and size every lead within 48 hours of creation.",
      "No active record without a next action and follow-up date.",
      ...(singleThreaded.length ? ["Multi-thread every deal above priority 60."] : []),
    ],
  };

  // --- Recommendations (ranked by expected value) ---
  const topDeal = valued.sort((a, b) => b.value * ((b.prob ?? 30) / 100) - a.value * ((a.prob ?? 30) / 100))[0];
  const recommendations: AnalyticsBody["recommendations"] = [];
  if (topDeal)
    recommendations.push({
      rank: 1,
      action: `Advance ${topDeal.ctx.lead.company} to the next stage — it carries the largest weighted value in the pipeline.`,
      expectedImpact: `Securing this deal alone covers ${Math.round(((topDeal.value * ((topDeal.prob ?? 30) / 100)) / Math.max(1, revenueTarget)) * 100)}% of target on a weighted basis.`,
      revenueOpportunity: money(topDeal.value),
      effort: "Medium",
      urgency: "High",
      confidence: "High",
    });
  if (revenueGap > 0)
    recommendations.push({
      rank: recommendations.length + 1,
      action: `Add qualified pipeline worth at least ${money(revenueGap * 3)} (3x the ${money(revenueGap)} gap).`,
      expectedImpact: "Restores realistic coverage for the revenue target.",
      revenueOpportunity: money(revenueGap),
      effort: "High",
      urgency: revenueGap > revenueTarget * 0.5 ? "Critical" : "High",
      confidence: "High",
    });
  if (stalled.length > 0)
    recommendations.push({
      rank: recommendations.length + 1,
      action: `Re-engage or disqualify the ${stalled.length} stalled deal${stalled.length === 1 ? "" : "s"} (${stalled.map((s) => s.company).join(", ")}).`,
      expectedImpact: "Recovers decaying pipeline or cleans the forecast — both improve reliability.",
      revenueOpportunity: money(
        stalled.reduce((s, st) => s + (parseDealValue(contexts.find((c) => c.lead.id === st.leadId)?.lead.estimatedDealSize ?? null) ?? 0), 0)
      ),
      effort: "Low",
      urgency: "High",
      confidence: "Medium",
    });
  if (noMeeting.length > 0)
    recommendations.push({
      rank: recommendations.length + 1,
      action: `Convert the ${noMeeting.length} engaged lead${noMeeting.length === 1 ? "" : "s"} without meetings into booked meetings.`,
      expectedImpact: `Meeting-stage conversion (${stages[2].conversionRate}%) is the pipeline's proven path to opportunity.`,
      revenueOpportunity: money(noMeeting.reduce((s, c) => s + (parseDealValue(c.lead.estimatedDealSize) ?? 0), 0)),
      effort: "Medium",
      urgency: "High",
      confidence: "Medium",
    });
  if (unvalued > 0)
    recommendations.push({
      rank: recommendations.length + 1,
      action: `Qualify and size the ${unvalued} unscored lead${unvalued === 1 ? "" : "s"}.`,
      expectedImpact: "Makes the forecast complete and prioritization possible.",
      revenueOpportunity: "Unknown until sized",
      effort: "Low",
      urgency: "Medium",
      confidence: "High",
    });

  // --- Scenario modeling (formulas stated) ---
  const meetingStageValue = active
    .filter((c) => c.meetingCount > 0 || STAGE_ORDER[c.lead.status] >= 4)
    .reduce((s, c) => s + (parseDealValue(c.lead.estimatedDealSize) ?? 0) * ((c.lead.closeProbability ?? 30) / 100), 0);
  const contactedValue = active
    .filter((c) => STAGE_ORDER[c.lead.status] >= 2)
    .reduce((s, c) => s + (parseDealValue(c.lead.estimatedDealSize) ?? 0) * ((c.lead.closeProbability ?? 30) / 100), 0);
  const cycleDays = Math.max(30, averageDealAgeDays * 2);
  const scenarioModels: AnalyticsBody["scenarioModels"] = [
    {
      scenario: "Increase meetings by 20%",
      assumption: "New meetings convert at the same rate as current meeting-stage deals.",
      estimatedRevenueImpact: `+${money(meetingStageValue * 0.2)}`,
      explanation: `Current meeting-stage weighted value is ${money(meetingStageValue)}; 20% more meetings adds a proportional 20% of that value.`,
    },
    {
      scenario: "Improve reply rate by 15%",
      assumption: "Additional replies progress at the same rate as current contacted-stage deals.",
      estimatedRevenueImpact: `+${money(contactedValue * 0.15)}`,
      explanation: `Contacted-and-beyond weighted value is ${money(contactedValue)}; 15% more conversations lifts it proportionally.`,
    },
    {
      scenario: "Reduce sales cycle by 10 days",
      assumption: `Estimated cycle of ~${cycleDays} days (2x average active deal age of ${averageDealAgeDays} days).`,
      estimatedRevenueImpact: `+${money(weightedPipelineValue * (10 / cycleDays))}`,
      explanation: "Shorter cycles pull revenue into the period; impact = weighted pipeline x (days saved / cycle length).",
    },
    {
      scenario: "Add 25% more qualified leads",
      assumption: "New leads mirror the current pipeline's average value and conversion.",
      estimatedRevenueImpact: `+${money(weightedPipelineValue * 0.25)}`,
      explanation: `Weighted pipeline of ${money(weightedPipelineValue)} scales roughly linearly with qualified lead volume at constant quality.`,
    },
  ];

  const topOpps = opps.slice(0, 3).map((o) => `${o.company}: ${o.type}`);
  const topRisks = risks
    .filter((r) => r.level === "Critical" || r.level === "High")
    .slice(0, 3)
    .map((r) => `${r.company}: ${r.risk}`);

  return {
    executiveSummary: {
      currentSituation: `${active.length} active lead${active.length === 1 ? "" : "s"} (${valued.length} sized), ${won.length} closed won, ${lost.length} closed lost. Pipeline value ${money(currentPipelineValue)}, weighted ${money(weightedPipelineValue)}, against a ${money(revenueTarget)} target.`,
      revenueOutlook:
        revenueGap <= 0
          ? `On track: expected revenue ${money(expectedRevenue)} meets the target with ${money(-revenueGap)} of headroom.`
          : `Behind: expected revenue ${money(expectedRevenue)} leaves a ${money(revenueGap)} gap (${Math.round((revenueGap / revenueTarget) * 100)}% of target). Probability of hitting target: ${probabilityOfHittingTarget}%.`,
      biggestOpportunities: topOpps.length ? topOpps : ["No hidden opportunities detected — pipeline is fully worked."],
      biggestRisks: topRisks.length ? topRisks : ["No high or critical risks detected."],
      topActionsNext7Days: recommendations.slice(0, 3).map((r) => r.action),
      topActionsNext30Days: [
        ...(revenueGap > 0 ? [`Build ${money(revenueGap * 3)} of new qualified pipeline (3x coverage on the gap).`] : []),
        "Multi-thread every deal above priority 60.",
        "Review closed-lost reasons and feed learnings into outreach messaging.",
      ],
    },
    forecast: {
      currentPipelineValue,
      weightedPipelineValue,
      expectedRevenue,
      bestCase,
      worstCase,
      revenueGap,
      probabilityOfHittingTarget,
      forecastConfidence:
        forecastReliability >= 75 ? "High" : forecastReliability >= 40 ? "Medium" : "Low",
      timeToCloseEstimate: `~${cycleDays} days for current active deals (derived from average deal age of ${averageDealAgeDays} days; assumes deals are mid-cycle).`,
      assumptions: [
        "Deal values use the midpoint of each recorded deal-size range; leads without a recorded size contribute zero (forecast may be understated).",
        "Unscored close probabilities default to 30% — the historical average for early-stage deals.",
        `Best case = 85% of unweighted pipeline closing; worst case = only deals at ≥60% probability closing.`,
        "Closed-won revenue is counted at full recorded value.",
        `${unvalued} active lead${unvalued === 1 ? "" : "s"} excluded from value calculations for lack of sizing.`,
      ],
    },
    pipelineHealth: {
      pipelineCoverage: {
        score: pipelineCoverage,
        explanation: `Pipeline of ${money(currentPipelineValue)} is ${coverageRatio.toFixed(1)}x the ${money(revenueTarget)} target; healthy coverage is 3x (=100).`,
      },
      pipelineQuality: {
        score: Math.max(0, pipelineQuality),
        explanation: `Average priority score of scored active leads, penalized 5 points per unscored lead (${active.length - scoredActive.length} unscored).`,
      },
      dealVelocity: {
        score: dealVelocity,
        explanation: `Penalized 20 per stalled deal (${stalled.length}) and 2 per day of average age above 30 (age: ${averageDealAgeDays}d).`,
      },
      opportunityHealth: {
        score: opportunityHealth,
        explanation: "Weighted: next action set (40%), multi-threaded (30%), follow-up scheduled (30%) across active deals.",
      },
      forecastReliability: {
        score: forecastReliability,
        explanation: `${valued.filter((v) => v.prob !== null).length}/${active.length} active deals have both a deal size and a close probability.`,
      },
      activityHealth: {
        score: activityHealth,
        explanation: `${active.filter((c) => lastActivityDays(c) <= 7).length}/${active.length} active deals touched within 7 days.`,
      },
      overall: {
        score: overall,
        explanation: "Weighted: coverage 20%, quality 20%, velocity 15%, opportunity health 15%, forecast reliability 15%, activity 15%.",
      },
      bottlenecks,
    },
    funnelAnalysis: {
      stages,
      strongestStage,
      weakestStage,
      biggestRevenueLeak: weakest
        ? `${weakest.stage} converts at ${weakest.conversionRate}% — ${weakest.entered - weakest.converted} lead${weakest.entered - weakest.converted === 1 ? "" : "s"} not (yet) converting at this stage.`
        : "Insufficient data.",
      expectedImprovementImpact:
        weakest && weakest.entered > 0
          ? (() => {
              const moved = Math.max(1, Math.round(weakest.entered * 0.1));
              return `Lifting ${weakest.stage} by 10 points would move ~${moved} more lead${moved === 1 ? "" : "s"} forward per cohort — the highest-leverage fix in the funnel.`;
            })()
          : "Insufficient data.",
    },
    velocityAnalysis: {
      averageDealAgeDays,
      stageTimings,
      fastMoving,
      slowMoving,
      stalled,
      reasonsForDelay: [
        ...(stalled.length ? ["Follow-up gaps: deals go silent after initial engagement."] : []),
        ...(noMeeting.length ? ["Meetings not being pushed at the engaged stage."] : []),
        ...(unvalued > 0 ? ["Late qualification delays prioritization."] : []),
      ],
      recommendedIntervention: stalled.length
        ? `Immediate re-engagement of ${stalled.map((s) => s.company).join(", ")} — stalled deals are the largest velocity drag.`
        : "Maintain current cadence; no systemic velocity problem detected.",
    },
    opportunities: opps,
    risks,
    teamPerformance,
    recommendations,
    scenarioModels,
    confidence: {
      level: valued.length >= Math.max(1, Math.round(active.length * 0.6)) ? "High" : "Medium",
      explanation:
        "All figures are computed from recorded deal sizes, probabilities, statuses, and activity timestamps. Confidence tracks how much of the pipeline is actually sized. (Demo engine — connect an OpenAI key for full reasoning.)",
      facts: [
        `${contexts.length} total leads: ${active.length} active, ${won.length} won, ${lost.length} lost.`,
        `${valued.length} active leads carry recorded deal sizes summing to ${money(currentPipelineValue)}.`,
        `${stalled.length} stalled deal${stalled.length === 1 ? "" : "s"}, ${overdueFollowUps.length} overdue follow-up${overdueFollowUps.length === 1 ? "" : "s"}.`,
      ],
      calculations: [
        "Weighted pipeline = Σ(deal midpoint × close probability).",
        "Expected revenue = closed-won revenue + weighted pipeline.",
        "Health scores are weighted composites with the weights disclosed per score.",
      ],
      assumptions: [
        "30% default probability for unscored deals.",
        "Deal-size range midpoints represent true value.",
        "Sales cycle ≈ 2× average active deal age.",
      ],
    },
  };
}

function avgDaysToActivity(contexts: LeadContext[], pattern: RegExp): string {
  const days: number[] = [];
  for (const c of contexts) {
    const created = new Date(c.lead.createdAt).getTime();
    const hit = c.lead.activity.find((a) => pattern.test(a.summary));
    if (hit) days.push(Math.max(0, (new Date(hit.timestamp).getTime() - created) / 86400000));
  }
  if (days.length === 0) return "No data yet";
  return `${(days.reduce((a, b) => a + b, 0) / days.length).toFixed(1)} days (n=${days.length})`;
}
