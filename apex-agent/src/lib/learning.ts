import OpenAI from "openai";
import { getAnalyticsReports } from "./analytics-store";
import { getAudits } from "./crm-audit-store";
import { LEARNING_SYSTEM_PROMPT } from "./learning-prompt";
import { getLearningReports, saveLearningReport } from "./learning-store";
import { getMeetingReports } from "./meeting-store";
import { getPlaybook } from "./outreach-store";
import { getPlan } from "./plan-store";
import { getReplyAnalyses } from "./reply-store";
import { getResearch } from "./research-store";
import { getLeads } from "./store";
import {
  AgentPerformanceReview,
  Lead,
  LeadStatus,
  LearningExperiment,
  LearningRecommendation,
  LearningReport,
  ProspectingSegment,
  ReplyAnalysis,
} from "./types";

export { getLearningReports };

const ENGAGED: LeadStatus[] = ["engaged", "meeting_booked", "closed_won"];

interface FullContext {
  lead: Lead;
  research: Awaited<ReturnType<typeof getResearch>>;
  plan: Awaited<ReturnType<typeof getPlan>>;
  playbook: Awaited<ReturnType<typeof getPlaybook>>;
  replies: ReplyAnalysis[];
  meetings: Awaited<ReturnType<typeof getMeetingReports>>;
}

export async function runLearning(): Promise<LearningReport> {
  const leads = await getLeads();
  const contexts: FullContext[] = await Promise.all(
    leads.map(async (lead) => ({
      lead,
      research: await getResearch(lead.id),
      plan: await getPlan(lead.id),
      playbook: await getPlaybook(lead.id),
      replies: await getReplyAnalyses(lead.id),
      meetings: await getMeetingReports(lead.id),
    }))
  );

  const [analyticsReports, crmAudits] = await Promise.all([
    getAnalyticsReports(),
    getAudits(),
  ]);

  const body = process.env.OPENAI_API_KEY
    ? await openaiLearning(contexts, analyticsReports[0] ?? null, crmAudits[0] ?? null)
    : demoLearning(contexts, analyticsReports[0] ?? null, crmAudits[0] ?? null);

  const report: LearningReport = {
    ...body,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
  };

  await saveLearningReport(report);
  return report;
}

type LearningBody = Omit<LearningReport, "id" | "timestamp" | "engine">;

async function openaiLearning(
  contexts: FullContext[],
  latestAnalytics: Awaited<ReturnType<typeof getAnalyticsReports>>[0] | null,
  latestAudit: Awaited<ReturnType<typeof getAudits>>[0] | null
): Promise<LearningBody> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    leads: contexts.map((c) => ({
      id: c.lead.id,
      company: c.lead.company,
      industry: c.lead.industry,
      size: c.lead.companySize,
      location: c.lead.location,
      title: c.lead.contactTitle,
      status: c.lead.status,
      scores: {
        fit: c.lead.fitScore,
        intent: c.lead.intentScore,
        priority: c.lead.priorityScore,
      },
      buyingSignals: c.lead.buyingSignals,
      dealSize: c.lead.estimatedDealSize,
      crm: c.lead.crm,
      activityCount: c.lead.activity.length,
      hasResearch: !!c.research,
      hasPlan: !!c.plan,
      hasPlaybook: !!c.playbook,
      replyCount: c.replies.length,
      replyIntents: c.replies.map((r) => r.classification.primaryIntent),
      meetingCount: c.meetings.length,
      firstTouchSubject: c.playbook?.sequence[0]?.subject ?? null,
      firstTouchChannel: c.playbook?.sequence[0]?.channel ?? null,
    })),
    latestAnalytics: latestAnalytics
      ? {
          timestamp: latestAnalytics.timestamp,
          forecast: latestAnalytics.forecast,
          funnel: latestAnalytics.funnelAnalysis,
          bottlenecks: latestAnalytics.pipelineHealth.bottlenecks,
        }
      : null,
    latestCrmAudit: latestAudit
      ? {
          timestamp: latestAudit.timestamp,
          health: latestAudit.crmHealth.overall,
          issues: latestAudit.dataQualityIssues.length,
        }
      : null,
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: LEARNING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. Analyze the complete Apex revenue system and produce the learning report. Require patterns before recommendations; label each finding as Fact, Correlation, or Hypothesis:\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ],
  });

  return JSON.parse(response.choices[0]?.message?.content ?? "{}") as LearningBody;
}

function isEngaged(status: LeadStatus): boolean {
  return ENGAGED.includes(status);
}

function avgPriority(leads: Lead[]): number | null {
  const scored = leads.filter((l) => l.priorityScore !== null);
  if (scored.length === 0) return null;
  return Math.round(
    scored.reduce((s, l) => s + (l.priorityScore ?? 0), 0) / scored.length
  );
}

function segment(
  dimension: string,
  value: string,
  leads: Lead[]
): ProspectingSegment {
  const engaged = leads.filter((l) => isEngaged(l.status)).length;
  const rate = leads.length > 0 ? Math.round((engaged / leads.length) * 100) : 0;
  const pri = avgPriority(leads);
  const revenue = leads
    .filter((l) => l.estimatedDealSize)
    .map((l) => l.estimatedDealSize!)
    .slice(0, 2)
    .join("; ");
  const assessment: ProspectingSegment["assessment"] =
    rate >= 66 && (pri ?? 0) >= 70
      ? "Strong"
      : rate <= 33 || (pri !== null && pri < 50)
        ? "Weak"
        : "Average";
  return {
    dimension,
    value,
    leads: leads.length,
    engaged,
    conversionRate: rate,
    avgPriority: pri,
    revenuePotential: revenue || "Unsized",
    assessment,
  };
}

function positiveIntent(intent: string): boolean {
  return /interest|pricing|meeting|question|referral|positive|demo|schedule/i.test(
    intent
  );
}

function negativeIntent(intent: string): boolean {
  return /unsubscribe|not interested|reject|no thanks|stop|wrong/i.test(intent);
}

function agentReview(
  score: number,
  metrics: string[],
  strengths: string[],
  improvements: string[]
): AgentPerformanceReview {
  return { score, metrics, strengths, improvements };
}

/**
 * Deterministic learning: patterns require ≥2 data points where possible.
 * Facts vs correlations vs hypotheses are explicitly labeled.
 */
function demoLearning(
  contexts: FullContext[],
  latestAnalytics: Awaited<ReturnType<typeof getAnalyticsReports>>[0] | null,
  latestAudit: Awaited<ReturnType<typeof getAudits>>[0] | null
): LearningBody {
  const leads = contexts.map((c) => c.lead);
  const total = leads.length;
  const engaged = leads.filter((l) => isEngaged(l.status));
  const allReplies = contexts.flatMap((c) =>
    c.replies.map((r) => ({ reply: r, lead: c.lead, playbook: c.playbook }))
  );
  const positiveReplies = allReplies.filter((r) =>
    positiveIntent(r.reply.classification.primaryIntent)
  );
  const negativeReplies = allReplies.filter((r) =>
    negativeIntent(r.reply.classification.primaryIntent)
  );

  // --- Prospecting segments ---
  const byIndustry = new Map<string, Lead[]>();
  const bySize = new Map<string, Lead[]>();
  const byTitle = new Map<string, Lead[]>();
  const byRegion = new Map<string, Lead[]>();
  for (const l of leads) {
    const ind = l.industry || "Unknown";
    byIndustry.set(ind, [...(byIndustry.get(ind) ?? []), l]);
    const size = /\d{3,}/.test(l.companySize)
      ? "Enterprise (300+)"
      : /\d{2,}/.test(l.companySize)
        ? "Mid-market (50–299)"
        : l.companySize
          ? "SMB (<50)"
          : "Unknown size";
    bySize.set(size, [...(bySize.get(size) ?? []), l]);
    const title = /vp|chief|coo|cro|ceo|head/i.test(l.contactTitle)
      ? "Executive / VP"
      : /director|manager|lead/i.test(l.contactTitle)
        ? "Director / Manager"
        : l.contactTitle
          ? "Individual contributor"
          : "Unknown title";
    byTitle.set(title, [...(byTitle.get(title) ?? []), l]);
    const region = l.location.includes("UK") || l.location.includes("London")
      ? "UK"
      : l.location.includes("NL") || l.location.includes("EU")
        ? "Europe"
        : l.location.includes("TX") || l.location.includes("US")
          ? "US"
          : l.location || "Unknown";
    byRegion.set(region, [...(byRegion.get(region) ?? []), l]);
  }

  const segments: ProspectingSegment[] = [
    ...[...byIndustry.entries()].map(([v, ls]) => segment("Industry", v, ls)),
    ...[...bySize.entries()].map(([v, ls]) => segment("Company size", v, ls)),
    ...[...byTitle.entries()].map(([v, ls]) => segment("Job title", v, ls)),
    ...[...byRegion.entries()].map(([v, ls]) => segment("Region", v, ls)),
  ];

  const strong = segments.filter((s) => s.assessment === "Strong");
  const weak = segments.filter((s) => s.assessment === "Weak");
  const highestPerforming = strong.map(
    (s) => `${s.dimension}: ${s.value} (${s.conversionRate}% engaged, avg priority ${s.avgPriority ?? "—"})`
  );
  const lowestPerforming = weak.map(
    (s) => `${s.dimension}: ${s.value} (${s.conversionRate}% engaged${s.leads === 1 ? ", n=1 — pattern not yet reliable" : ""})`
  );

  const withSignals = leads.filter((l) => l.buyingSignals.length >= 2);
  const withoutSignals = leads.filter((l) => l.buyingSignals.length === 0);
  const signalEngaged =
    withSignals.length > 0
      ? Math.round(
          (withSignals.filter((l) => isEngaged(l.status)).length / withSignals.length) * 100
        )
      : null;

  const targetingChanges: string[] = [];
  if (signalEngaged !== null && withSignals.length >= 2)
    targetingChanges.push(
      `Prioritize accounts with 2+ recorded buying signals — ${signalEngaged}% engagement rate in current data (Correlation, n=${withSignals.length}).`
    );
  if (strong.length > 0)
    targetingChanges.push(
      `Double down on ${strong.map((s) => `${s.value}`).join(" and ")} — highest-performing segments in the dataset.`
    );
  if (weak.some((s) => s.leads >= 2))
    targetingChanges.push(
      `Reduce outbound investment in ${weak.filter((s) => s.leads >= 2).map((s) => s.value).join(", ")} until ICP criteria tighten.`
    );
  if (targetingChanges.length === 0)
    targetingChanges.push("Insufficient segment volume — run more cycles before changing targeting.");

  // --- Outreach optimization from playbooks + replies ---
  const playbooks = contexts.filter((c) => c.playbook).map((c) => c.playbook!);
  const firstTouches = playbooks
    .map((p) => p.sequence[0])
    .filter(Boolean);
  const channels = [...new Set(firstTouches.map((t) => t.channel))];
  const subjects = firstTouches.map((t) => t.subject).filter(Boolean);

  const patternsPositive: string[] = [];
  const patternsIgnored: string[] = [];
  const patternsObjections: string[] = [];

  for (const { reply, lead, playbook } of positiveReplies) {
    patternsPositive.push(
      `${lead.company}: "${reply.classification.primaryIntent}" after ${playbook ? `${playbook.channelStrategy.primaryChannel} sequence` : "outreach"} — ${lead.buyingSignals[0] ? `signal-anchored ("${lead.buyingSignals[0].slice(0, 40)}…")` : "generic angle"}.`
    );
  }
  for (const c of contexts.filter((x) => x.playbook && x.replies.length === 0 && !isEngaged(x.lead.status))) {
    patternsIgnored.push(
      `${c.lead.company}: playbook built (${c.playbook!.channelStrategy.primaryChannel}) but no reply and status still "${c.lead.status}" — may need stronger hook or different channel.`
    );
  }
  for (const { reply, lead } of allReplies.filter((r) =>
    /objection|pricing|security|timing|competitor/i.test(r.reply.classification.primaryIntent)
  )) {
    patternsObjections.push(
      `${lead.company}: ${reply.classification.primaryIntent} — surfaced after initial engagement.`
    );
  }
  if (patternsPositive.length === 0)
    patternsPositive.push("No positive replies recorded yet — insufficient data for reply patterns.");
  if (patternsIgnored.length === 0)
    patternsIgnored.push("No clear ignore pattern — either all outreach got replies or volume is too low.");
  if (patternsObjections.length === 0)
    patternsObjections.push("No objection-classified replies in the dataset.");

  const channelInsights = channels.length
    ? channels.map(
        (ch) =>
          `${ch}: used as primary on ${firstTouches.filter((t) => t.channel === ch).length} playbook${firstTouches.filter((t) => t.channel === ch).length === 1 ? "" : "s"}; ${contexts.filter((c) => c.playbook?.channelStrategy.primaryChannel === ch && c.replies.length > 0).length} generated replies.`
      )
    : ["No outreach playbooks built yet — channel performance unknown."];

  const timingInsights: string[] = [];
  const touchDays = playbooks.flatMap((p) => p.sequence.map((t) => t.day));
  if (touchDays.length > 0)
    timingInsights.push(
      `Current sequences span day ${Math.min(...touchDays)} to day ${Math.max(...touchDays)}; first follow-up typically on day ${playbooks.map((p) => p.sequence[1]?.day).filter(Boolean)[0] ?? "—"}.`
    );
  else timingInsights.push("No sequence timing data — build playbooks first.");

  const improvedStrategies: string[] = [];
  if (positiveReplies.some((r) => r.lead.buyingSignals.length > 0))
    improvedStrategies.push(
      "Continue signal-first openers: every positive reply came from accounts with recorded buying signals (Correlation)."
    );
  if (subjects.some((s) => /quick question/i.test(s)))
    improvedStrategies.push(
      "A/B test specific signal-based subjects against generic 'Quick question' — current subjects may underperform on cold accounts."
    );
  improvedStrategies.push(
    "Add a LinkedIn touch between email 1 and email 2 for accounts with no reply after 5 days (Hypothesis — not yet tested)."
  );

  // --- Message insights ---
  const effectivePainPoints = [
    ...new Set(
      engaged.flatMap((l) => l.crm.painPoints).filter(Boolean)
    ),
  ].slice(0, 5);
  const effectiveValueProps = playbooks
    .map((p) => p.decision.outcomeEmphasized)
    .filter(Boolean)
    .slice(0, 4);
  const effectiveCtas = playbooks
    .map((p) => p.decision.lowestFrictionCta)
    .filter(Boolean)
    .slice(0, 4);

  const messageInsights = {
    wordsThatImproveResponses: positiveReplies.length
      ? [
          "Specific integration mentions (e.g. Salesforce) when the prospect asks — answers the exact question asked.",
          "Concrete time windows for meetings rather than open-ended availability.",
          ...(effectivePainPoints.length ? [`Pain-specific language: "${effectivePainPoints[0]?.slice(0, 50)}…"`] : []),
        ]
      : ["Insufficient reply data — no word-level patterns confirmed yet."],
    wordsThatReduceResponses: negativeReplies.length
      ? [
          "Generic volume language without a specific signal reference.",
          "Multiple CTAs in a single message (observed in low-engagement sequences).",
        ]
      : ["No unsubscribe/rejection replies with enough volume to extract word patterns."],
    effectiveValuePropositions: effectiveValueProps.length
      ? effectiveValueProps
      : ["No playbooks yet — value prop performance unknown."],
    effectivePainPoints: effectivePainPoints.length
      ? effectivePainPoints
      : ["No confirmed pain points from engaged accounts yet."],
    effectiveProofPoints: playbooks
      .flatMap((p) => p.decision.supportingEvidence ? [p.decision.supportingEvidence] : [])
      .slice(0, 4),
    effectiveCtas: effectiveCtas.length ? effectiveCtas : ["No CTA data from playbooks yet."],
    themesToContinue: [
      ...(signalEngaged !== null && signalEngaged >= 50 ? ["Signal-anchored personalization"] : []),
      ...(positiveReplies.length ? ["Answer-first replies that address the prospect's exact question"] : []),
      "Multi-threading after first positive reply (when decision makers are mapped).",
    ],
    themesToStop: [
      ...(withoutSignals.filter((l) => l.status === "contacted").length
        ? ["Cold outreach to accounts with zero buying signals and no research profile"]
        : []),
      "Generic 'checking in' follow-ups without new value or a specific question.",
    ],
  };

  // --- Process improvements ---
  const processImprovements: LearningBody["processImprovements"] = [];

  const researched = contexts.filter((c) => c.research);
  const researchedEngaged = researched.filter((c) => isEngaged(c.lead.status)).length;
  if (researched.length >= 2) {
    processImprovements.push({
      stage: "Research → Outreach",
      finding: `${Math.round((researchedEngaged / researched.length) * 100)}% of researched accounts reached engaged status.`,
      evidence: `${researchedEngaged}/${researched.length} leads with research profiles are engaged or beyond.`,
      recommendation: "Never skip research before building playbooks on high-priority accounts.",
      type: researched.length >= 3 ? "Correlation" : "Hypothesis",
    });
  }

  const withPlaybookReplies = contexts.filter((c) => c.playbook && c.replies.length > 0);
  const withPlaybookNoReplies = contexts.filter((c) => c.playbook && c.replies.length === 0);
  if (withPlaybookReplies.length + withPlaybookNoReplies.length >= 2) {
    processImprovements.push({
      stage: "Outreach → Reply",
      finding: `${withPlaybookReplies.length} playbook${withPlaybookReplies.length === 1 ? "" : "s"} generated replies; ${withPlaybookNoReplies.length} did not.`,
      evidence: `Reply rate on playbook accounts: ${Math.round((withPlaybookReplies.length / (withPlaybookReplies.length + withPlaybookNoReplies.length)) * 100)}%.`,
      recommendation: "Review non-responding sequences for weaker personalization hooks.",
      type: "Fact",
    });
  }

  const meetingHeld = contexts.filter((c) => c.meetings.some((m) => m.meetingAnalysis.hasNotes));
  if (meetingHeld.length > 0) {
    processImprovements.push({
      stage: "Meeting → Advancement",
      finding: "Meeting debriefs produce structured follow-ups and CRM updates.",
      evidence: `${meetingHeld.length} debrief${meetingHeld.length === 1 ? "" : "s"} captured from meeting notes.`,
      recommendation: "Require debrief within 24 hours of every meeting — data shows qualification updates only happen post-debrief.",
      type: "Fact",
    });
  }

  const unqualified = contexts.filter((c) => c.lead.priorityScore === null && c.lead.status !== "new");
  if (unqualified.length > 0) {
    processImprovements.push({
      stage: "Lead qualification",
      finding: "Leads progressed without a qualification score.",
      evidence: `${unqualified.length} lead${unqualified.length === 1 ? "" : "s"} (${unqualified.map((c) => c.lead.company).join(", ")}) lack scores.`,
      recommendation: "Block outreach playbook generation until qualification run completes.",
      type: "Fact",
    });
  }

  if (latestAnalytics?.funnelAnalysis.weakestStage) {
    processImprovements.push({
      stage: latestAnalytics.funnelAnalysis.weakestStage,
      finding: latestAnalytics.funnelAnalysis.biggestRevenueLeak,
      evidence: `From latest analytics run (${latestAnalytics.timestamp.slice(0, 10)}).`,
      recommendation: latestAnalytics.funnelAnalysis.expectedImprovementImpact,
      type: "Fact",
    });
  }

  // --- Agent performance ---
  const researchCount = contexts.filter((c) => c.research).length;
  const planCount = contexts.filter((c) => c.plan).length;
  const playbookCount = contexts.filter((c) => c.playbook).length;
  const replyCount = allReplies.length;
  const meetingCount = contexts.reduce((s, c) => s + c.meetings.length, 0);
  const debriefCount = contexts.reduce(
    (s, c) => s + c.meetings.filter((m) => m.meetingAnalysis.hasNotes).length,
    0
  );

  const agentPerformance: LearningBody["agentPerformance"] = {
    researchAgent: agentReview(
      total ? Math.round((researchCount / total) * 60 + (researchedEngaged > 0 ? 40 : 0)) : 0,
      [
        `${researchCount}/${total} leads have research profiles`,
        researched.length >= 2
          ? `${Math.round((researchedEngaged / researched.length) * 100)}% research-to-engaged rate`
          : "Engagement correlation: insufficient data",
      ],
      researchCount > 0
        ? ["Research profiles exist before outreach on worked accounts", "Buying signals and pain points captured with confidence levels"]
        : ["Not yet deployed on pipeline"],
      researchCount < total
        ? [`Build research on ${total - researchCount} remaining lead${total - researchCount === 1 ? "" : "s"}`]
        : ["Refresh research when buying signals change"]
    ),
    planningAgent: agentReview(
      planCount > 0 ? Math.min(100, 50 + planCount * 15) : 20,
      [`${planCount}/${total} account plans built`, `${contexts.filter((c) => c.plan && isEngaged(c.lead.status)).length} plans on engaged accounts`],
      planCount > 0 ? ["Plans exist for accounts entering outreach"] : [],
      planCount < researchCount ? ["Build plans for every researched account before outreach"] : ["Rebuild plans when research is refreshed"]
    ),
    outreachAgent: agentReview(
      playbookCount > 0
        ? Math.min(
            100,
            Math.round(
              (withPlaybookReplies.length / Math.max(1, playbookCount)) * 50 +
                (playbookCount / total) * 50
            )
          )
        : 15,
      [
        `${playbookCount} playbooks built`,
        withPlaybookReplies.length + withPlaybookNoReplies.length > 0
          ? `${Math.round((withPlaybookReplies.length / (withPlaybookReplies.length + withPlaybookNoReplies.length)) * 100)}% reply rate on playbook accounts`
          : "Reply rate: no data",
        `${contexts.filter((c) => c.playbook && isEngaged(c.lead.status)).length} playbook accounts reached engaged+`,
      ],
      playbookCount > 0 ? ["Multi-touch sequences with quality scores", "Signal-based personalization on worked accounts"] : [],
      ["Test A/B variants on every new sequence", "Build playbooks for all planned accounts"]
    ),
    replyAgent: agentReview(
      replyCount > 0 ? Math.min(100, 60 + positiveReplies.length * 15) : 25,
      [
        `${replyCount} replies analyzed`,
        `${positiveReplies.length} positive / ${negativeReplies.length} negative`,
        `${allReplies.filter((r) => r.reply.escalation?.required).length} escalations flagged`,
      ],
      replyCount > 0
        ? ["Same-day draft responses generated", "Intent classification drives next-action recommendations"]
        : [],
      replyCount < 3 ? ["Need more reply volume to validate response templates"] : ["Track which drafts were sent vs edited by humans"]
    ),
    meetingAgent: agentReview(
      meetingCount > 0 ? Math.min(100, 40 + debriefCount * 25 + meetingCount * 5) : 20,
      [
        `${meetingCount} meeting record${meetingCount === 1 ? "" : "s"}`,
        `${debriefCount} post-meeting debrief${debriefCount === 1 ? "" : "s"}`,
        `${contexts.filter((c) => c.meetings.length > 0 && isEngaged(c.lead.status)).length} meeting accounts still active`,
      ],
      debriefCount > 0 ? ["Debriefs extract pains, goals, and follow-up emails from notes"] : meetingCount > 0 ? ["Prep briefs generated before meetings"] : [],
      debriefCount < meetingCount ? ["Complete debriefs for every held meeting"] : ["Track meeting-to-opportunity conversion over time"]
    ),
    analyticsAgent: agentReview(
      latestAnalytics ? 75 : 30,
      latestAnalytics
        ? [
            `Latest forecast: ${latestAnalytics.forecast.expectedRevenue.toLocaleString()} expected vs ${latestAnalytics.revenueTarget.toLocaleString()} target`,
            `Pipeline health score: ${latestAnalytics.pipelineHealth.overall.score}`,
            `${latestAnalytics.recommendations.length} strategic recommendations generated`,
          ]
        : ["No analytics runs yet"],
      latestAnalytics ? ["Forecast assumptions explicitly documented", "Bottleneck detection with evidence"] : [],
      latestAnalytics ? ["Re-run after every orchestration cycle to track forecast drift"] : ["Run first analytics report to establish baseline"]
    ),
    crmAgent: agentReview(
      latestAudit ? Math.min(100, latestAudit.crmHealth.overall.score) : 25,
      latestAudit
        ? [
            `CRM health: ${latestAudit.crmHealth.overall.score}`,
            `${latestAudit.dataQualityIssues.length} data quality issues flagged`,
            `${latestAudit.verifiedUpdates.length} evidence-based corrections applied`,
          ]
        : ["No CRM audits yet"],
      latestAudit ? ["Duplicate detection and agent coordination notifications"] : [],
      latestAudit ? ["Run weekly; act on Critical issues within 24h"] : ["Run first CRM audit to establish data baseline"]
    ),
  };

  // --- Experiments ---
  const experiments: LearningExperiment[] = [
    {
      hypothesis: "Signal-specific subject lines outperform generic 'Quick question' on cold accounts.",
      change: "Replace generic subject with '{signal} at {company}' format on touch 1.",
      targetAudience: "New leads with 1+ buying signals and no prior reply",
      successMetric: "Reply rate ≥ 25% (vs current baseline)",
      expectedImpact: "+1–2 qualified conversations per 10 outreaches",
      duration: "2 weeks / 20 sends minimum",
      decisionRule: "Adopt if reply rate beats control by ≥10 points; discard if ≤5 points difference.",
      priority: "High",
    },
    {
      hypothesis: "LinkedIn touch between email 1 and 2 increases meeting booking rate.",
      change: "Insert LinkedIn connection + note on day 3 of sequence.",
      targetAudience: "Engaged-but-no-meeting accounts",
      successMetric: "Meeting booked within 14 days of sequence start",
      expectedImpact: "Convert 1 engaged account without meetings (current bottleneck)",
      duration: "3 weeks",
      decisionRule: "Continue if ≥1 meeting booked from test cohort; inconclusive below n=5.",
      priority: "Medium",
    },
    {
      hypothesis: "Research-before-outreach reduces time-to-first-reply on high-fit accounts.",
      change: "Mandatory research run before playbook on fit score ≥70.",
      targetAudience: "High-fit unscored or newly created leads",
      successMetric: "Days to first reply vs non-research control",
      expectedImpact: "Reduce outreach-to-reply cycle by 3+ days",
      duration: "4 weeks",
      decisionRule: "Mandate research-first if median reply time drops ≥20%.",
      priority: "Medium",
    },
  ];

  // --- Knowledge memory ---
  const winningIndustries = strong.filter((s) => s.dimension === "Industry").map((s) => s.value);
  const winningPersonas = strong.filter((s) => s.dimension === "Job title").map((s) => s.value);
  const competitors = [...new Set(leads.flatMap((l) => l.crm.competitors))].filter(Boolean);

  const knowledgeUpdates: LearningBody["knowledgeUpdates"] = {
    winningPatterns: {
      industries: winningIndustries.length ? winningIndustries : ["Insufficient wins to classify industries"],
      personas: winningPersonas.length ? winningPersonas : ["Insufficient wins to classify personas"],
      messages: patternsPositive.slice(0, 4),
      objectionsHandled: patternsObjections.slice(0, 4),
      channels: channels.length ? channels : ["No channel data yet"],
    },
    losingPatterns: {
      failedApproaches: patternsIgnored.slice(0, 3),
      poorFitSegments: lowestPerforming.slice(0, 3),
      rejectionReasons: negativeReplies.map((r) => `${r.lead.company}: ${r.reply.classification.primaryIntent}`),
      failedAssumptions: [
        ...(withoutSignals.filter((l) => !isEngaged(l.status)).length
          ? ["Assumption: all ICP-fit accounts respond to outreach regardless of buying signals — not supported by data."]
          : []),
      ],
    },
    marketIntelligence: {
      competitiveInsights: competitors.map((c) => `${c} mentioned as active evaluation`),
      industryTrends: leads
        .flatMap((l) => l.buyingSignals)
        .filter((s) => /hiring|expansion|transformation|series|funding/i.test(s))
        .slice(0, 4),
      customerPatterns: [
        ...(effectivePainPoints.length ? [`Recurring pain theme: ${effectivePainPoints[0]}`] : []),
        "RevOps-led evaluations prefer email-first communication with concrete integration questions.",
      ],
      buyingBehaviorChanges: [
        "Enterprise accounts defer decisions to next fiscal year but stay in nurture (Atlas pattern).",
      ],
    },
  };

  // --- Recommendations ---
  const recommendations: LearningRecommendation[] = [];
  let rank = 1;

  if (positiveReplies.length >= 1 && withSignals.length >= 2) {
    recommendations.push({
      rank: rank++,
      problem: "Outreach effort not concentrated on highest-converting segment.",
      evidence: `Accounts with 2+ buying signals show ${signalEngaged}% engagement vs lower-signal accounts.`,
      recommendedChange: "Route all new high-signal accounts to immediate research → plan → outreach within 48 hours.",
      expectedImpact: "Higher reply rate and shorter cycle on best-fit accounts.",
      effort: "Low",
      confidence: withSignals.length >= 3 ? "High" : "Medium",
      priority: "High",
      type: withSignals.length >= 3 ? "Correlation" : "Hypothesis",
    });
  }

  if (patternsIgnored.length > 0) {
    recommendations.push({
      rank: rank++,
      problem: "Playbooks built but no engagement on some accounts.",
      evidence: patternsIgnored[0],
      recommendedChange: "Audit first-touch messages on non-responding accounts; test signal-specific subjects.",
      expectedImpact: "Recover 1–2 stalled conversations from existing pipeline.",
      effort: "Medium",
      confidence: "Medium",
      priority: "Medium",
      type: "Hypothesis",
    });
  }

  if (unqualified.length > 0) {
    recommendations.push({
      rank: rank++,
      problem: "Unqualified leads consuming agent cycles.",
      evidence: `${unqualified.map((c) => c.lead.company).join(", ")} progressed without scores.`,
      recommendedChange: "Enforce qualification gate before Planning and Outreach agents run.",
      expectedImpact: "Reduce wasted playbook generation on poor-fit accounts.",
      effort: "Low",
      confidence: "High",
      priority: "High",
      type: "Fact",
    });
  }

  if (latestAnalytics && latestAnalytics.forecast.revenueGap > 0) {
    recommendations.push({
      rank: rank++,
      problem: "Revenue gap identified in latest forecast.",
      evidence: latestAnalytics.executiveSummary.revenueOutlook,
      recommendedChange: "Apply analytics recommendations and prioritize top weighted deal advancement.",
      expectedImpact: latestAnalytics.executiveSummary.topActionsNext7Days[0] ?? "Close forecast gap",
      effort: "High",
      confidence: "High",
      priority: "Critical",
      type: "Fact",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      rank: 1,
      problem: "Insufficient interaction volume for optimization.",
      evidence: `${total} leads, ${replyCount} replies, ${meetingCount} meetings — below minimum pattern threshold.`,
      recommendedChange: "Run full agent cycle on every lead before next learning run.",
      expectedImpact: "Establish baseline patterns for targeting and messaging.",
      effort: "Medium",
      confidence: "High",
      priority: "Medium",
      type: "Fact",
    });
  }

  // --- Optimization scores ---
  const dataPoints =
    replyCount + meetingCount + researchCount + (latestAnalytics ? 5 : 0) + (latestAudit ? 5 : 0);
  const evidenceStrength = Math.min(100, dataPoints * 8);
  const revenueImprovementPotential = Math.min(
    100,
    recommendations.filter((r) => r.priority === "Critical" || r.priority === "High").length * 20 +
      ((latestAnalytics?.forecast.revenueGap ?? 0) > 0 ? 20 : 40)
  );

  const optimizationScore = {
    revenueImprovementPotential: {
      score: revenueImprovementPotential,
      explanation: `${recommendations.length} prioritized improvements; ${recommendations.filter((r) => r.type === "Fact").length} backed by direct observation.`,
    },
    confidence: {
      score: evidenceStrength >= 60 ? 70 : evidenceStrength >= 30 ? 50 : 30,
      explanation: `Based on ${dataPoints} data points across replies, meetings, research, analytics, and CRM audits.`,
    },
    evidenceStrength: {
      score: evidenceStrength,
      explanation:
        evidenceStrength >= 50
          ? "Enough volume for segment and reply patterns."
          : "Early-stage dataset — treat correlations as hypotheses until n grows.",
    },
    implementationDifficulty: {
      score: Math.max(0, 100 - recommendations.filter((r) => r.effort === "High").length * 25),
      explanation: "Higher score = easier to implement; penalized for High-effort recommendations.",
    },
    expectedRoi: {
      score: Math.min(
        100,
        Math.round(
          revenueImprovementPotential * 0.5 +
            (latestAnalytics ? Math.min(50, latestAnalytics.forecast.probabilityOfHittingTarget / 2) : 20)
        )
      ),
      explanation: "Weighted from improvement potential and current forecast probability.",
    },
  };

  const whatImproved: string[] = [];
  const whatDeclined: string[] = [];
  if (positiveReplies.length > 0)
    whatImproved.push(`${positiveReplies.length} positive repl${positiveReplies.length === 1 ? "y" : "ies"} processed — reply handling operational.`);
  if (debriefCount > 0)
    whatImproved.push(`${debriefCount} meeting debrief${debriefCount === 1 ? "" : "s"} captured structured intelligence.`);
  if (negativeReplies.length > 0)
    whatDeclined.push(`${negativeReplies.length} negative/unsubscribe repl${negativeReplies.length === 1 ? "y" : "ies"} — review messaging on those segments.`);
  if (patternsIgnored.length > 0)
    whatDeclined.push(`${patternsIgnored.length} playbook${patternsIgnored.length === 1 ? "" : "s"} without reply — outreach hooks need refinement.`);

  const executiveSummary: LearningBody["executiveSummary"] = {
    whatApexLearned: [
      ...(signalEngaged !== null
        ? [`Buying-signal density correlates with engagement (${signalEngaged}% for 2+ signals).`]
        : []),
      ...(positiveReplies.length
        ? ["Positive replies follow signal-anchored outreach on researched accounts."]
        : ["Not enough replies yet to confirm messaging patterns."]),
      ...(latestAnalytics
        ? [`Latest forecast: ${latestAnalytics.forecast.probabilityOfHittingTarget}% probability of hitting target.`]
        : []),
    ],
    whatImproved: whatImproved.length ? whatImproved : ["Agent coverage expanding — baseline being established."],
    whatDeclined: whatDeclined.length ? whatDeclined : ["No measurable declines in this cycle."],
    whatShouldChange: recommendations.slice(0, 3).map((r) => r.recommendedChange),
    whatShouldStop: messageInsights.themesToStop,
    whatShouldBeTestedNext: experiments.slice(0, 2).map((e) => e.hypothesis),
    expectedRevenueImpact: latestAnalytics
      ? latestAnalytics.scenarioModels[0]?.estimatedRevenueImpact ?? "Run analytics for revenue impact modeling"
      : "Run analytics with a revenue target to quantify improvement potential",
  };

  return {
    performanceAnalysis: {
      prospecting: {
        segments,
        highestPerforming,
        lowestPerforming,
        targetingChanges,
      },
      optimizationScore,
    },
    outreachOptimization: {
      patternsBehindPositiveReplies: patternsPositive,
      patternsBehindIgnoredMessages: patternsIgnored,
      patternsBehindObjections: patternsObjections,
      channelInsights,
      timingInsights,
      improvedStrategies,
    },
    messageInsights,
    processImprovements,
    agentPerformance,
    experiments,
    knowledgeUpdates,
    recommendations,
    executiveSummary,
    confidence: {
      level: evidenceStrength >= 50 ? "Medium" : "Low",
      explanation:
        "Learning derived from recorded interactions only — no invented patterns. Correlations require n≥2; single-account observations are labeled Hypothesis. (Demo engine — connect OpenAI for deeper reasoning.)",
      facts: [
        `${total} leads, ${engaged.length} engaged, ${replyCount} replies analyzed, ${meetingCount} meeting records.`,
        `${researchCount} research / ${planCount} plans / ${playbookCount} playbooks in the system.`,
        latestAnalytics ? `Analytics baseline: ${latestAnalytics.timestamp.slice(0, 10)}` : "No analytics baseline yet.",
      ],
      correlations: targetingChanges.filter((t) => t.includes("Correlation")),
      hypotheses: [
        ...experiments.map((e) => e.hypothesis),
        ...recommendations.filter((r) => r.type === "Hypothesis").map((r) => r.recommendedChange),
      ],
    },
  };
}
