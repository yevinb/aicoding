import OpenAI from "openai";
import { MEETING_SYSTEM_PROMPT } from "./meeting-prompt";
import { saveMeetingReport } from "./meeting-store";
import { getPlaybook } from "./outreach-store";
import { getPlan } from "./plan-store";
import { getReplyAnalyses } from "./reply-store";
import { getResearch } from "./research-store";
import { getLead, updateLead } from "./store";
import {
  AccountPlan,
  ConfidenceLevel,
  Lead,
  MeetingAttendee,
  MeetingReport,
  ResearchProfile,
} from "./types";

export async function runMeeting(
  leadId: string,
  meetingNotes?: string
): Promise<MeetingReport> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const [research, plan, playbook, replies] = await Promise.all([
    getResearch(leadId),
    getPlan(leadId),
    getPlaybook(leadId),
    getReplyAnalyses(leadId),
  ]);

  const notes = meetingNotes?.trim() || null;
  const body = process.env.OPENAI_API_KEY
    ? await openaiMeeting(lead, notes, { research, plan, playbook, replies })
    : demoMeeting(lead, notes, research, plan);

  const report: MeetingReport = {
    ...body,
    id: crypto.randomUUID(),
    leadId: lead.id,
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    meetingNotes: notes,
  };

  await saveMeetingReport(report);
  await applyMeetingCrm(lead, report);
  return report;
}

async function applyMeetingCrm(
  lead: Lead,
  report: MeetingReport
): Promise<void> {
  const u = report.crmUpdates;
  const crm = { ...lead.crm };
  if (u.painPoints?.length)
    crm.painPoints = [...new Set([...crm.painPoints, ...u.painPoints])];
  if (u.goals?.length) crm.goals = [...new Set([...crm.goals, ...u.goals])];
  if (u.stakeholders?.length)
    crm.decisionMakers = [...new Set([...crm.decisionMakers, ...u.stakeholders])];
  if (u.timeline) crm.timeline = u.timeline;
  if (u.nextAction) crm.nextAction = u.nextAction;
  if (u.followUpDate) crm.followUpDate = u.followUpDate;
  if (u.dealNotes) crm.notes = u.dealNotes;

  const hasNotes = report.meetingAnalysis.hasNotes;
  await updateLead(lead.id, {
    crm,
    ...(hasNotes
      ? {
          status: "engaged",
          closeProbability: report.qualificationUpdate.dealProbability.value,
          intentScore: report.qualificationUpdate.buyingIntent.value,
        }
      : {}),
    activity: [
      ...lead.activity,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "agent_run",
        summary: hasNotes
          ? `Meeting Intelligence Agent — meeting debrief (deal probability ${report.qualificationUpdate.dealProbability.value}%, effectiveness ${report.qualityAnalysis.meetingEffectiveness.score}/100)`
          : "Meeting Intelligence Agent — pre-meeting brief prepared",
      },
    ],
  });
}

type ReportBody = Omit<
  MeetingReport,
  "id" | "leadId" | "timestamp" | "engine" | "meetingNotes"
>;

async function openaiMeeting(
  lead: Lead,
  notes: string | null,
  context: {
    research: unknown;
    plan: unknown;
    playbook: unknown;
    replies: unknown[];
  }
): Promise<ReportBody> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input = {
    meetingNotes: notes ?? "NO MEETING NOTES PROVIDED — produce pre-meeting preparation only; post-meeting sections must be marked pending.",
    crmRecord: {
      contact: { name: lead.contactName, title: lead.contactTitle },
      company: {
        name: lead.company,
        industry: lead.industry,
        size: lead.companySize,
        location: lead.location,
        funding: lead.fundingStage,
        techStack: lead.techStack,
      },
      buyingSignals: lead.buyingSignals,
      status: lead.status,
      scores: {
        fit: lead.fitScore,
        intent: lead.intentScore,
        priority: lead.priorityScore,
        estimatedDealSize: lead.estimatedDealSize,
        closeProbability: lead.closeProbability,
      },
      crm: lead.crm,
      recentActivity: lead.activity.slice(-10).map((a) => ({
        when: a.timestamp,
        type: a.type,
        summary: a.summary,
        detail: a.detail,
      })),
    },
    researchProfile: context.research ?? "Not available",
    accountPlan: context.plan ?? "Not available",
    outreachPlaybook: context.playbook ?? "Not available",
    recentReplyAnalyses: context.replies.slice(0, 3),
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: MEETING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. Produce the meeting intelligence report:\n${JSON.stringify(input, null, 2)}`,
      },
    ],
  });

  return JSON.parse(
    response.choices[0]?.message?.content ?? "{}"
  ) as ReportBody;
}

/**
 * Deterministic meeting report. Prep sections come from CRM/research/plan.
 * Post-meeting sections are extracted only from the provided notes text —
 * nothing is claimed that does not appear in the notes.
 */
function demoMeeting(
  lead: Lead,
  notes: string | null,
  research: ResearchProfile | null,
  plan: AccountPlan | null
): ReportBody {
  const firstName = lead.contactName.split(" ")[0];
  const signal = lead.buyingSignals[0];
  const pains = research?.painPoints.confirmed.length
    ? research.painPoints.confirmed
    : lead.crm.painPoints.filter((p) => !/unknown/i.test(p));
  const dealSize =
    research?.qualification.expectedDealSize ??
    lead.estimatedDealSize ??
    "Unknown";
  const prevProb = lead.closeProbability ?? 30;
  const inDays = (n: number) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  // ---------- Pre-meeting prep (always produced) ----------
  const attendees: MeetingAttendee[] = (
    plan?.stakeholders ?? []
  ).map((s) => ({
    name: s.name,
    role: s.role,
    department: "Unknown",
    influenceLevel: s.influence,
    decisionAuthority: s.authority,
    likelyPriorities: s.likelyPriorities,
    potentialConcerns: s.likelyConcerns,
    communicationStyle: s.communicationStyle,
    personalSuccessMetrics: s.outcomesTheyCareAbout,
    recommendedApproach:
      s.engagementOrder === 1
        ? "Lead the conversation through them; validate the problem in their words before presenting anything."
        : "Address their function's specific stake directly; don't assume the champion has briefed them.",
  }));
  if (attendees.length === 0) {
    attendees.push({
      name: lead.contactName,
      role: lead.contactTitle || "Unknown",
      department: "Unknown",
      influenceLevel: "High",
      decisionAuthority: "Medium",
      likelyPriorities: ["Solving the problem that earned this meeting"],
      potentialConcerns: ["Wasting time on a vendor pitch"],
      communicationStyle: "Unknown — mirror their pace and formality",
      personalSuccessMetrics: ["Unknown — ask directly"],
      recommendedApproach: "Discovery-first; earn the right to present by understanding before proposing.",
    });
  }

  const prep = {
    meetingBrief: {
      companyOverview:
        research?.company.description ??
        `${lead.company}${lead.industry ? ` — ${lead.industry}` : ""}${lead.companySize ? `, ${lead.companySize}` : ""}${lead.location ? `, ${lead.location}` : ""}.`,
      businessSituation: signal
        ? `Active initiatives: ${lead.buyingSignals.join("; ")}.`
        : "No verified initiatives on record.",
      industryContext: lead.industry
        ? `${lead.industry} — competitive pressure typically centers on efficiency and speed to result.`
        : "Unknown",
      recentEvents: lead.buyingSignals,
      buyingSignals: lead.buyingSignals,
      knownPainPoints: pains,
      businessObjectives: lead.crm.goals,
      relationshipStatus: `Status: ${lead.status}. ${lead.crm.conversationSummary || "No conversation history."}`,
      previousConversations: lead.activity
        .slice(-4)
        .map((a) => a.summary)
        .join(" · "),
      knownObjections: plan?.objectionForecast.map((o) => o.objection) ?? [],
      competitiveSituation: lead.crm.competitors.length
        ? `Known: ${lead.crm.competitors.join(", ")}. Never disparage; position on gaps.`
        : "Unknown — probe during the meeting.",
      opportunitySize: dealSize,
      dealProbability: prevProb,
    },
    attendeeAnalysis: attendees,
    meetingObjective: {
      primaryObjective:
        plan?.engagementStrategy.meetingObjective ??
        "Validate the problem, quantify its impact, and map the buying committee.",
      secondaryObjectives: [
        "Identify the compelling event and its date",
        "Earn an introduction to a second stakeholder",
        "Understand the decision and budget process",
      ],
      desiredOutcome: "A scoped next step with a date and a second stakeholder committed to attend.",
      minimumAcceptableOutcome: "Clear mutual understanding of whether the problem is worth solving now, even if the answer is no.",
      nextStepGoal: "Working session with the operational owner within two weeks.",
      successCriteria: [
        "Problem confirmed in the customer's own words and numbers",
        "At least one new stakeholder identified by name",
        "A dated, mutually agreed next step before the meeting ends",
      ],
    },
    meetingStrategy: {
      openingStrategy: signal
        ? `Open with their initiative ("${signal}") and ask what it changes for their team — their agenda first, never ours.`
        : "Open by asking what prompted them to take the meeting — let them set the agenda.",
      relationshipApproach: "Peer-level, curious, zero pitch in the first half. Take visible notes; play back what you hear.",
      discoveryApproach: "Funnel: business goals → current approach → where it breaks → cost of that → who else feels it.",
      valueDiscussionStrategy: "Only after the problem is quantified. Anchor value to the number they gave, not our claims.",
      proofPointsToUse: plan?.salesStrategy.proofPointsRequired ?? [
        `One ${lead.industry || "relevant"} customer story with a measured outcome`,
      ],
      topicsToAvoid: [
        "Feature tours before the problem is established",
        "Pricing specifics before value is quantified (give ranges honestly if asked directly)",
        ...(lead.crm.competitors.length ? [`Disparaging ${lead.crm.competitors.join(" or ")}`] : []),
      ],
      potentialRisks: [
        "Meeting becomes a demo request without discovery — redirect to one clarifying question first",
        "Single-threaded outcome: no new stakeholders identified",
        ...(plan ? plan.riskAssessment.filter((r) => r.level === "High" || r.level === "Critical").map((r) => `${r.area}: ${r.risk}`) : []),
      ],
      recommendedPositioning:
        plan?.salesStrategy.competitivePositioning ??
        "Position against the cost of the status quo, not against other vendors.",
    },
    discoveryQuestions: [
      {
        category: "Business Goals",
        questions: [
          signal
            ? `What does success on "${signal.toLowerCase()}" look like at the end of the year?`
            : "What are the top two outcomes your team is accountable for this year?",
        ],
      },
      {
        category: "Current Challenges",
        questions: [
          pains[0]
            ? `Last time we spoke, ${pains[0].toLowerCase()} came up — what's the latest?`
            : "Where does your current approach break down first as volume grows?",
        ],
      },
      { category: "Impact", questions: ["When that breaks, what does it cost — in time, money, or missed targets?"] },
      { category: "Processes", questions: ["Walk me through how this works today, start to finish — who touches it?"] },
      {
        category: "Technology",
        questions: [
          lead.techStack.length
            ? `How well are ${lead.techStack.slice(0, 2).join(" and ")} serving this workflow today?`
            : "What tools are involved in this workflow today?",
        ],
      },
      { category: "Budget", questions: ["How do initiatives like this usually get funded here — existing line or new approval?"] },
      { category: "Decision Process", questions: ["If you decided this was worth doing, what happens next internally — who's involved?"] },
      { category: "Timeline", questions: ["Is there a date this needs to be working by, and what sets it?"] },
      { category: "Success Metrics", questions: ["Which number on your dashboard would this most credibly move, and by how much?"] },
      { category: "Competition", questions: ["What else have you looked at — including doing it in-house?"] },
      { category: "Risks", questions: ["What would make this fail internally even with the right solution?"] },
    ],
    objectionPreparation: (plan?.objectionForecast ?? []).map((o) => ({
      objection: o.objection,
      probability: o.probability,
      whyItMayHappen: o.rootCause,
      recommendedResponse: o.recommendedResponse,
      evidenceNeeded: o.evidenceNeeded,
      followUpQuestion: "What would you need to see for this concern to be fully resolved?",
    })),
  };
  if (prep.objectionPreparation.length === 0) {
    prep.objectionPreparation.push({
      objection: "We don't have time to evaluate this properly",
      probability: "Medium",
      whyItMayHappen: "Busy teams protect their calendars from vendor processes",
      recommendedResponse: "Agree, and propose the smallest possible evaluation that still proves the point — one metric, 30 days.",
      evidenceNeeded: "A one-page evaluation plan with their time cost stated in hours",
      followUpQuestion: "If the evaluation took under four hours of your team's time, would it be worth running?",
    });
  }

  // ---------- Post-meeting analysis (only from notes) ----------
  const hasNotes = !!notes;
  const sentences = hasNotes
    ? notes
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 8)
    : [];
  const pick = (re: RegExp) => sentences.filter((s) => re.test(s.toLowerCase()));

  const notedPains = pick(/problem|challenge|struggl|pain|frustrat|slow|manual|bottleneck|break|issue/);
  const notedGoals = pick(/goal|target|want to|aim|objective|plan to|by (q[1-4]|end of)/);
  const notedBudget = pick(/budget|\$|\b\d+k\b|price|spend|per (year|month|seat)|annual/);
  const notedTimeline = pick(/q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december|next (month|quarter|year)|weeks?|deadline/);
  const notedCommitments = pick(/we('| wi)ll|i('| wi)ll|agreed|will send|will share|will intro|next step/);
  const notedCompetitors = pick(/competitor|vendor|already use|currently use|evaluat|comparing|gong|clari|salesforce|hubspot/);
  const notedStakeholders = pick(/cfo|ceo|cto|coo|vp|director|head of|my (boss|team|colleague)|procurement|finance|legal|it team/);
  const notedSignals = pick(/interest(ed|ing)|makes sense|like (this|that|it)|impress|excited|keen|useful|exactly|good point|need(s)? this|loved?/);
  const notedObjections = pick(/concern|worried|not sure|hesitant|too (expensive|complex|early)|risk|but /);
  const notedRequirements = pick(/need(s)? to|must|require|has to|integrat|sso|gdpr|soc ?2|compliance/);

  const escalationHits = hasNotes
    ? [
        ...(/legal|contract|msa|terms/i.test(notes) ? ["Legal/contract discussion began"] : []),
        ...(/procurement|vendor onboarding|purchasing/i.test(notes) ? ["Procurement process starting"] : []),
        ...(/security (review|questionnaire)|soc ?2|iso ?27001|pen ?test/i.test(notes) ? ["Security review beginning"] : []),
        ...(/discount|negotiat|better price|pricing approval/i.test(notes) ? ["Pricing negotiation in play"] : []),
        ...(/ceo|board|executive sponsor/i.test(notes) ? ["Executive alignment needed"] : []),
      ]
    : [];

  const positiveMeeting = notedSignals.length > notedObjections.length;
  const probDelta = hasNotes
    ? Math.min(20, notedSignals.length * 5 + notedCommitments.length * 5) -
      notedObjections.length * 4
    : 0;
  const clamp = (n: number) => Math.max(5, Math.min(95, n));
  const newProb = clamp(prevProb + probDelta);
  const fmt = (d: number) => (d === 0 ? "unchanged" : d > 0 ? `+${d}` : `${d}`);
  const pending = { value: 0, change: "pending", reason: "No meeting notes provided yet." };

  const followUpEmailBody = hasNotes
    ? [
        `Hi ${firstName},`,
        "",
        `Thanks for the time today. Three things stood out to me:`,
        "",
        ...[
          ...new Set(
            [notedPains[0], notedGoals[0], notedTimeline[0], notedBudget[0]]
              .filter((s): s is string => !!s)
              .map((s) => `— ${trimQuote(s)}`)
          ),
        ].slice(0, 3),
        "",
        notedCommitments.length > 0
          ? `On next steps: ${trimQuote(notedCommitments[0])} — I'll hold up my end${notedCommitments.length > 1 ? ", and the rest of what we agreed is noted below" : ""}.`
          : `We didn't lock a next step, and I'd rather fix that now than let this drift.`,
        "",
        notedCommitments.length > 0
          ? `Does the timing we discussed still work on your side?`
          : `Would a 30-minute working session next week with ${notedStakeholders.length > 0 ? "the colleague you mentioned" : "whoever owns this day-to-day"} be the right next move?`,
        "",
        `Best,`,
        `Apex`,
      ].join("\n")
    : "";

  return {
    ...prep,
    meetingAnalysis: {
      hasNotes,
      importantStatements: sentences.slice(0, 5),
      painPoints: notedPains.slice(0, 5),
      goals: notedGoals.slice(0, 5),
      requirements: notedRequirements.slice(0, 5),
      stakeholders: notedStakeholders.slice(0, 5),
      buyingSignals: notedSignals.slice(0, 5),
      objections: notedObjections.slice(0, 5),
      competitorMentions: notedCompetitors.slice(0, 5),
      budgetInformation: notedBudget[0] ?? (hasNotes ? "Not discussed" : ""),
      timeline: notedTimeline[0] ?? (hasNotes ? "Not discussed" : ""),
      commitments: notedCommitments.slice(0, 5),
      actionItems: notedCommitments.slice(0, 5),
      summary: hasNotes
        ? {
            whatHappened: `Meeting held with ${lead.contactName} (${lead.company}). ${notedSignals.length} positive signal${notedSignals.length === 1 ? "" : "s"}, ${notedObjections.length} concern${notedObjections.length === 1 ? "" : "s"}, ${notedCommitments.length} commitment${notedCommitments.length === 1 ? "" : "s"} captured from the notes.`,
            whatWasLearned: [
              notedPains[0] && `Pain confirmed: ${trimQuote(notedPains[0])}`,
              notedBudget[0] && `Budget context: ${trimQuote(notedBudget[0])}`,
              notedStakeholders[0] && `Stakeholder mentioned: ${trimQuote(notedStakeholders[0])}`,
            ]
              .filter(Boolean)
              .join(" · ") || "Notes contained limited extractable detail — capture richer notes next time.",
            customerPriorities: notedGoals.slice(0, 3),
            businessImpact: notedPains.length > 0
              ? "The confirmed pain connects directly to measurable cost — quantify it in the follow-up cycle."
              : "Impact not yet quantified — top priority for the next conversation.",
            opportunityChanges: positiveMeeting
              ? "Opportunity strengthened; signals outweighed concerns."
              : notedObjections.length > 0
                ? "Concerns surfaced that need resolution before advancing."
                : "Neutral — insufficient signal either way.",
          }
        : {
            whatHappened: "Pending — no meeting notes provided.",
            whatWasLearned: "Pending",
            customerPriorities: [],
            businessImpact: "Pending",
            opportunityChanges: "Pending",
          },
    },
    qualificationUpdate: hasNotes
      ? {
          icpFit: {
            value: lead.fitScore ?? 60,
            change: "unchanged",
            reason: "Fit is structural; the meeting confirmed rather than changed it.",
          },
          buyingIntent: {
            value: clamp((lead.intentScore ?? 40) + (positiveMeeting ? 12 : -5)),
            change: fmt(positiveMeeting ? 12 : -5),
            reason: positiveMeeting
              ? "Positive signals and commitments recorded in the meeting."
              : "Concerns outweighed positive signals in the notes.",
          },
          urgency: {
            value: notedTimeline.length > 0 ? 70 : 45,
            change: notedTimeline.length > 0 ? "+" : "unchanged",
            reason: notedTimeline.length > 0
              ? `Timeline referenced in meeting: ${trimQuote(notedTimeline[0])}`
              : "No timeline surfaced — urgency unproven.",
          },
          dealProbability: {
            value: newProb,
            change: fmt(newProb - prevProb),
            reason: `Derived from ${notedSignals.length} positive signals, ${notedCommitments.length} commitments, ${notedObjections.length} concerns in the notes.`,
          },
          expectedRevenue: dealSize,
          opportunityStage: notedCommitments.length > 0 ? "Discovery — next step committed" : "Discovery — next step pending",
          confidence: sentences.length > 5 ? "Medium" : "Low",
        }
      : {
          icpFit: pending,
          buyingIntent: pending,
          urgency: pending,
          dealProbability: pending,
          expectedRevenue: dealSize,
          opportunityStage: "Pre-meeting",
          confidence: "Medium",
        },
    followUpPlan: {
      nextAction: hasNotes
        ? notedCommitments.length > 0
          ? `Deliver on recorded commitment: ${trimQuote(notedCommitments[0])}`
          : "Send follow-up email proposing a concrete next step (none was agreed in the meeting)"
        : "Hold the meeting using this brief; capture notes for the debrief run",
      responsiblePerson: "Account owner (Apex-assisted)",
      deadline: hasNotes ? inDays(1) : inDays(3),
      customerCommitment: hasNotes
        ? notedCommitments[0]
          ? trimQuote(notedCommitments[0])
          : "None recorded — securing one is the next objective"
        : "Pending",
      internalCommitment: hasNotes
        ? "Follow-up email within 24 hours; all promised materials same-week"
        : "Complete preparation review before the meeting",
      riskIfDelayed: "Momentum decays fastest in the 48 hours after a meeting; a late follow-up signals low priority.",
      followUpEmail: {
        subject: hasNotes ? `Following up — ${lead.company} next steps` : "",
        body: followUpEmailBody,
        cta: hasNotes
          ? notedCommitments.length > 0
            ? "Confirm the agreed timing still works"
            : "Propose a 30-minute working session next week"
          : "",
      },
    },
    crmUpdates: hasNotes
      ? {
          opportunityStage: notedCommitments.length > 0 ? "Discovery — next step committed" : "Discovery",
          dealNotes: `Meeting debrief ${new Date().toISOString().slice(0, 10)}: ${notedSignals.length} signals, ${notedObjections.length} concerns, ${notedCommitments.length} commitments.`,
          ...(notedPains.length > 0 ? { painPoints: notedPains.slice(0, 3).map(trimQuote) } : {}),
          ...(notedGoals.length > 0 ? { goals: notedGoals.slice(0, 3).map(trimQuote) } : {}),
          ...(notedStakeholders.length > 0
            ? { stakeholders: [`Mentioned in meeting: ${trimQuote(notedStakeholders[0])}`] }
            : {}),
          ...(notedTimeline.length > 0 ? { timeline: trimQuote(notedTimeline[0]) } : {}),
          nextAction: notedCommitments.length > 0 ? `Deliver: ${trimQuote(notedCommitments[0])}` : "Send follow-up proposing next step",
          followUpDate: inDays(1),
          ...(notedObjections.length > 0
            ? { risks: notedObjections.slice(0, 3).map(trimQuote) }
            : {}),
        }
      : {
          nextAction: "Hold meeting using prepared brief",
          followUpDate: inDays(3),
        },
    qualityAnalysis: hasNotes
      ? {
          preparationQuality: {
            score: plan && research ? 90 : plan || research ? 78 : 60,
            explanation: plan && research
              ? "Full research profile and account plan were available before the meeting."
              : "Preparation was partial — run research and planning before the next meeting.",
          },
          discoveryDepth: {
            score: Math.min(90, 40 + notedPains.length * 10 + notedBudget.length * 10 + notedTimeline.length * 10),
            explanation: `Notes captured ${notedPains.length} pains, ${notedBudget.length} budget references, ${notedTimeline.length} timeline references.`,
          },
          customerEngagement: {
            score: Math.min(90, 40 + notedSignals.length * 12),
            explanation: `${notedSignals.length} positive engagement signal${notedSignals.length === 1 ? "" : "s"} recorded.`,
          },
          valueAlignment: {
            score: notedGoals.length > 0 ? 80 : 55,
            explanation: notedGoals.length > 0
              ? "Customer goals were surfaced and can anchor the value narrative."
              : "No goals captured — value discussion lacks an anchor.",
          },
          qualificationQuality: {
            score: Math.min(90, 30 + (notedBudget.length ? 20 : 0) + (notedTimeline.length ? 20 : 0) + (notedStakeholders.length ? 20 : 0)),
            explanation: `Budget ${notedBudget.length ? "surfaced" : "missing"}, timeline ${notedTimeline.length ? "surfaced" : "missing"}, stakeholders ${notedStakeholders.length ? "surfaced" : "missing"}.`,
          },
          nextStepClarity: {
            score: notedCommitments.length > 0 ? 85 : 40,
            explanation: notedCommitments.length > 0
              ? "Explicit commitments recorded."
              : "No committed next step — the single biggest gap from this meeting.",
          },
          meetingEffectiveness: {
            score: Math.min(
              90,
              Math.round(
                (notedPains.length * 8 + notedSignals.length * 8 + notedCommitments.length * 15 + 30)
              )
            ),
            explanation: "Composite of discovery depth, engagement, and next-step clarity.",
          },
          improvements: [
            ...(notedBudget.length === 0 ? ["Budget was not discussed — raise the funding question next time."] : []),
            ...(notedStakeholders.length === 0 ? ["No new stakeholders surfaced — ask the multi-threading question explicitly."] : []),
            ...(notedCommitments.length === 0 ? ["End every meeting with a dated, mutual next step before leaving the room."] : []),
            ...(notedBudget.length && notedStakeholders.length && notedCommitments.length ? ["Strong meeting — replicate this structure."] : []),
          ],
        }
      : {
          preparationQuality: {
            score: plan && research ? 92 : plan || research ? 75 : 55,
            explanation: plan && research
              ? "Brief built from full research profile and account plan."
              : "Brief built from partial inputs — run research and planning for a stronger prep pack.",
          },
          discoveryDepth: { score: 0, explanation: "Pending — meeting not yet held." },
          customerEngagement: { score: 0, explanation: "Pending" },
          valueAlignment: { score: 0, explanation: "Pending" },
          qualificationQuality: { score: 0, explanation: "Pending" },
          nextStepClarity: { score: 0, explanation: "Pending" },
          meetingEffectiveness: { score: 0, explanation: "Pending" },
          improvements: ["After the meeting, paste your notes here to generate the debrief, follow-up email, and CRM updates."],
        },
    escalation: {
      required: escalationHits.length > 0,
      reasons: escalationHits,
      urgency: escalationHits.length > 1 ? "High" : escalationHits.length === 1 ? "Medium" : "Low",
    },
    confidence: {
      level: (hasNotes
        ? sentences.length > 5
          ? "Medium"
          : "Low"
        : plan && research
          ? "High"
          : "Medium") as ConfidenceLevel,
      explanation: hasNotes
        ? "Post-meeting extraction is only as good as the notes provided; nothing outside the notes was claimed. (Demo engine — connect an OpenAI key for full reasoning.)"
        : "Preparation quality tracks input completeness: research and plan coverage determine brief depth. (Demo engine — connect an OpenAI key for full reasoning.)",
    },
  };
}

function trimQuote(s: string): string {
  const t = s.trim().replace(/^[-—•*]\s*/, "");
  return t.length > 140 ? t.slice(0, 137) + "…" : t;
}
