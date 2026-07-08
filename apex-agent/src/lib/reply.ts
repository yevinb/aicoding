import OpenAI from "openai";
import { getPlaybook } from "./outreach-store";
import { getPlan } from "./plan-store";
import { REPLY_SYSTEM_PROMPT } from "./reply-prompt";
import { saveReplyAnalysis } from "./reply-store";
import { getResearch } from "./research-store";
import { getLead, updateLead } from "./store";
import {
  AccountPlan,
  ConfidenceLevel,
  Lead,
  LeadStatus,
  ReplyAnalysis,
  RiskLevel,
} from "./types";

export async function runReplyAnalysis(
  leadId: string,
  incomingMessage: string
): Promise<ReplyAnalysis> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const [research, plan, playbook] = await Promise.all([
    getResearch(leadId),
    getPlan(leadId),
    getPlaybook(leadId),
  ]);

  const body = process.env.OPENAI_API_KEY
    ? await openaiReply(lead, incomingMessage, { research, plan, playbook })
    : demoReply(lead, incomingMessage, plan);

  const analysis: ReplyAnalysis = {
    ...body,
    id: crypto.randomUUID(),
    leadId: lead.id,
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    incomingMessage,
  };

  await saveReplyAnalysis(analysis);
  await applyCrmUpdates(lead, analysis);
  return analysis;
}

const VALID_STATUSES: LeadStatus[] = [
  "new",
  "researching",
  "contacted",
  "engaged",
  "meeting_booked",
  "nurturing",
  "closed_won",
  "closed_lost",
];

async function applyCrmUpdates(
  lead: Lead,
  analysis: ReplyAnalysis
): Promise<void> {
  const u = analysis.crmUpdates;
  const crm = { ...lead.crm };
  if (u.latestSummary) crm.conversationSummary = u.latestSummary;
  if (u.painPoints?.length)
    crm.painPoints = [...new Set([...crm.painPoints, ...u.painPoints])];
  if (u.goals?.length) crm.goals = [...new Set([...crm.goals, ...u.goals])];
  if (u.decisionMakers?.length)
    crm.decisionMakers = [...new Set([...crm.decisionMakers, ...u.decisionMakers])];
  if (u.competitors?.length)
    crm.competitors = [...new Set([...crm.competitors, ...u.competitors])];
  if (u.timeline) crm.timeline = u.timeline;
  if (u.followUpDate) crm.followUpDate = u.followUpDate;
  if (u.nextAction) crm.nextAction = u.nextAction;
  if (u.leadStatus && VALID_STATUSES.includes(u.leadStatus as LeadStatus))
    crm.leadStatus = u.leadStatus as LeadStatus;

  await updateLead(lead.id, {
    status: crm.leadStatus,
    crm,
    closeProbability: analysis.opportunityAssessment.dealProbability.value,
    intentScore: analysis.opportunityAssessment.buyingIntent.value,
    priorityScore: analysis.opportunityAssessment.priority.value,
    activity: [
      ...lead.activity,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "objection",
        summary: `Inbound reply — ${analysis.classification.primaryIntent}`,
        detail: analysis.incomingMessage.slice(0, 300),
      },
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "agent_run",
        summary: `Reply Intelligence Agent — ${analysis.recommendedAction.action}${analysis.escalation.required ? " (human approval required)" : ""}`,
      },
    ],
  });
}

type AnalysisBody = Omit<
  ReplyAnalysis,
  "id" | "leadId" | "timestamp" | "engine" | "incomingMessage"
>;

async function openaiReply(
  lead: Lead,
  incomingMessage: string,
  context: {
    research: unknown;
    plan: unknown;
    playbook: unknown;
  }
): Promise<AnalysisBody> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input = {
    incomingMessage,
    crmRecord: {
      contact: { name: lead.contactName, title: lead.contactTitle },
      company: {
        name: lead.company,
        industry: lead.industry,
        size: lead.companySize,
      },
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
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: REPLY_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. Analyze this inbound reply with full context:\n${JSON.stringify(input, null, 2)}\n\nProduce the JSON analysis.`,
      },
    ],
  });

  return JSON.parse(
    response.choices[0]?.message?.content ?? "{}"
  ) as AnalysisBody;
}

/**
 * Deterministic reply analysis. Intent is classified from the message text,
 * scores are adjusted from the lead's current state, and the draft answers
 * what was actually asked. Unverifiable answers are deferred to a human.
 */
function demoReply(
  lead: Lead,
  message: string,
  plan: AccountPlan | null
): AnalysisBody {
  const m = message.toLowerCase();
  const firstName = lead.contactName.split(" ")[0];

  // --- Step 1: intent classification ---
  const intents: { intent: string; confidence: number }[] = [];
  const add = (intent: string, confidence: number) =>
    intents.push({ intent, confidence });

  if (/unsubscribe|remove me|stop (emailing|contacting)|opt.?out/.test(m))
    add("Unsubscribe", 95);
  if (/out of (the )?office|auto.?reply|automatic reply|on leave|annual leave/.test(m))
    add("Automatic Reply", 95);
  if (/not interested|no thanks|not for us|please don.?t/.test(m))
    add("Not Interested", 85);
  if (/wrong person|not my (area|department)|no longer (work|at)/.test(m))
    add("Wrong Contact", 85);
  if (/how much|price|pricing|cost|quote/.test(m)) add("Pricing Question", 85);
  if (/budget|can.?t afford|too expensive|cheaper/.test(m))
    add("Budget Concern", 80);
  if (/next (quarter|year)|later|not (right )?now|bad timing|busy (right now|at the moment)|q[1-4]/.test(m))
    add("Timing Concern", 75);
  if (/already (use|using|have)|we use |current(ly)? (use|have)|existing (tool|vendor|solution)/.test(m))
    add("Already Using Competitor", 80);
  if (/security|soc ?2|iso ?27001|gdpr|compliance|data (residency|protection)|questionnaire/.test(m))
    add("Security Question", 85);
  if (/integrat|api|technical|architecture|sso|single sign/.test(m))
    add("Technical Question", 80);
  if (/legal|contract|terms|msa|dpa/.test(m)) add("Legal Review", 85);
  if (/procurement|vendor (form|onboarding)|purchasing/.test(m))
    add("Procurement", 85);
  if (/discount|negotiat|better (price|deal)/.test(m)) add("Negotiation", 80);
  if (/(book|schedule|set ?up|arrange).{0,20}(call|meeting|demo|chat)|calendar|availability|free (on|this|next)|works for me/.test(m))
    add("Meeting Request", 85);
  if (/forward(ed)?|loop(ing)? in|cc.?ing|passed (this|it) (on|to)|my colleague/.test(m))
    add("Forwarded Internally", 75);
  if (/(talk|speak|check) (to|with) (my|our) (boss|ceo|cfo|manager|team)|need (sign.?off|approval)/.test(m))
    add("Executive Approval Needed", 75);
  if (/send (me|over|more)|more (info|information|details)|case stud|one.?pager|deck/.test(m))
    add("Request for Information", 80);
  if (/interest(ed|ing)|sounds (good|great|useful)|tell me more|worth (a|exploring)|yes,? (this|that) is/.test(m))
    add("Positive Interest", 80);
  if (intents.length === 0) add("Unknown", 50);

  intents.sort((a, b) => b.confidence - a.confidence);
  const primary = intents[0].intent;
  const has = (i: string) => intents.some((x) => x.intent === i);

  const dead =
    has("Unsubscribe") || has("Not Interested") || has("Spam");
  const hot =
    has("Meeting Request") ||
    (has("Positive Interest") && !has("Timing Concern"));
  const auto = has("Automatic Reply");

  // --- Step 2: sentiment ---
  const questionsAsked = (message.match(/[^.!?\n]*\?/g) ?? []).map((q) =>
    q.trim()
  );
  const positive = /thanks|interest|great|good|sure|yes|happy to|sounds/.test(m);
  const negative = /not interested|no thanks|stop|don.?t|unfortunately|however/.test(m);
  const urgentWords = /asap|urgent|this (week|quarter)|soon|quickly|deadline/.test(m);

  const engagement = auto
    ? 10
    : dead
      ? 15
      : Math.min(
          95,
          40 + questionsAsked.length * 15 + (positive ? 15 : 0) + (message.length > 200 ? 10 : 0)
        );
  const buyingConfidence = hot ? 70 : dead ? 5 : positive && !negative ? 55 : 35;
  const urgency = urgentWords ? 75 : hot ? 55 : 30;
  const readiness = has("Meeting Request")
    ? 75
    : has("Executive Approval Needed") || has("Procurement")
      ? 60
      : dead
        ? 5
        : 40;

  const overall = dead
    ? "Negative"
    : hot
      ? "Positive"
      : negative && positive
        ? "Guarded"
        : positive
          ? "Positive"
          : auto
            ? "Neutral"
            : "Neutral";

  // --- Step 3: opportunity assessment ---
  const prevProb = lead.closeProbability ?? 25;
  const prevIntent = lead.intentScore ?? 40;
  const prevPriority = lead.priorityScore ?? 50;
  const delta = dead
    ? -Math.min(prevProb, 20)
    : hot
      ? 15
      : has("Timing Concern")
        ? -5
        : has("Budget Concern")
          ? -8
          : auto
            ? 0
            : 5;
  const clamp = (n: number) => Math.max(0, Math.min(95, n));
  const newProb = clamp(prevProb + delta);
  const newIntent = clamp(prevIntent + (dead ? -30 : hot ? 15 : positive ? 8 : 0));
  const newPriority = clamp(
    prevPriority + (dead ? -25 : hot ? 10 : auto ? 0 : 3)
  );
  const fmt = (d: number) => (d === 0 ? "unchanged" : d > 0 ? `+${d}` : `${d}`);

  const salesStage = dead
    ? "Closed lost"
    : has("Meeting Request")
      ? "Meeting scheduled"
      : has("Procurement") || has("Legal Review")
        ? "Procurement / legal"
        : has("Negotiation")
          ? "Negotiation"
          : has("Pricing Question") || has("Request for Information")
            ? "Evaluation"
            : lead.status === "engaged"
              ? "Discovery"
              : "Qualification";

  const riskLevel: RiskLevel = dead
    ? "Critical"
    : has("Budget Concern") || has("Already Using Competitor")
      ? "High"
      : has("Timing Concern") || has("Executive Approval Needed")
        ? "Medium"
        : "Low";

  // --- Step 5: objection analysis ---
  const objectionPresent =
    has("Budget Concern") ||
    has("Timing Concern") ||
    has("Already Using Competitor") ||
    has("Not Interested") ||
    has("Pricing Question");
  const surface = has("Budget Concern")
    ? "Budget / cost concern"
    : has("Timing Concern")
      ? "Not the right time"
      : has("Already Using Competitor")
        ? "Existing solution in place"
        : has("Pricing Question")
          ? "Price sensitivity signaled by leading with cost"
          : has("Not Interested")
            ? "Direct rejection"
            : "None";
  const planPredicted = plan?.objectionForecast.find((o) =>
    surface.toLowerCase().includes(o.objection.toLowerCase().split(" ")[0])
  );

  // --- Step 6: next action ---
  let action: string;
  let actionReason: string;
  const needsHuman =
    has("Legal Review") ||
    has("Procurement") ||
    has("Negotiation") ||
    has("Security Question") ||
    has("Executive Approval Needed");

  if (has("Unsubscribe")) {
    action = "Close Opportunity";
    actionReason =
      "Explicit unsubscribe — comply immediately, suppress the contact, and close. Anti-spam compliance is non-negotiable.";
  } else if (has("Not Interested")) {
    action = "Disqualify";
    actionReason =
      "Clear rejection. Send a one-line gracious close, honor it, and re-open only on a new verified trigger.";
  } else if (auto) {
    action = "Wait";
    actionReason =
      "Automatic reply — no human has read the message. Wait for the return date and resume the sequence then.";
  } else if (needsHuman) {
    action = "Request Human Approval";
    actionReason =
      "The reply touches legal, security, procurement, pricing approval, or executive territory — policy requires a human in the loop before responding substantively.";
  } else if (has("Meeting Request")) {
    action = "Book Meeting";
    actionReason =
      "The prospect asked for time. Confirm fast with two concrete slots and a stated agenda.";
  } else if (has("Wrong Contact")) {
    action = "Reply";
    actionReason =
      "Thank them and ask for a pointer to the right owner — a referred introduction converts far better than a cold restart.";
  } else if (has("Request for Information") || has("Pricing Question") || has("Technical Question") || has("Feature Question")) {
    action = "Provide Information";
    actionReason =
      "Direct questions were asked. Answer everything verifiable, attach one relevant artifact, and advance with a single question.";
  } else if (has("Timing Concern")) {
    action = "Nurture";
    actionReason =
      "Interest without current timing. Calendar the stated window, send one useful artifact, and stand down until the trigger.";
  } else if (has("Positive Interest")) {
    action = "Reply";
    actionReason =
      "Engagement is warm but a meeting is not yet earned — deepen the problem conversation first.";
  } else {
    action = "Request Human Approval";
    actionReason =
      "Intent is unclear. Per policy, uncertainty routes to human review rather than guessing.";
  }

  // --- Step 7: response draft ---
  const shouldSend = !auto && action !== "Wait";
  let body = "";
  let cta = "";
  let notesForHuman = "";

  if (has("Unsubscribe")) {
    body = `Hi ${firstName},\n\nDone — you won't hear from me again. Thanks for letting me know directly.\n\nBest,\nApex`;
    cta = "None — confirmation only";
    notesForHuman = "Suppress this contact in all sequences immediately.";
  } else if (has("Not Interested")) {
    body = `Hi ${firstName},\n\nUnderstood, and thanks for the straight answer — it's genuinely appreciated. I'll close the file on my side.\n\nIf the picture changes, you know where I am.\n\nBest,\nApex`;
    cta = "None — gracious close";
    notesForHuman = "Move to closed lost; set a 90-day signal watch only.";
  } else if (has("Meeting Request")) {
    body = `Hi ${firstName},\n\nGreat — let's do it. Two options: Tuesday at 10:00 or Thursday at 14:00 (your timezone). If neither works, name a slot and I'll make it fit.\n\nSo the time is useful, the agenda I'd propose: ${plan?.engagementStrategy.meetingObjective ?? "your current situation in your words, then whether and how this problem is worth solving now"}.\n\nWhich slot works?\n\nBest,\nApex`;
    cta = "Pick one of two proposed slots";
    notesForHuman = "Replace placeholder slots with real calendar availability before sending.";
  } else if (has("Pricing Question") && !needsHuman) {
    body = `Hi ${firstName},\n\nFair question, and I won't make you sit through a demo to get a number. Pricing depends mainly on team size — for a company like ${lead.company}, most land in the ${lead.estimatedDealSize ?? "range we can pin down in five minutes"} bracket.\n\nThe honest caveat: the number only makes sense against what the current state costs you. What does the process you have today cost per month, roughly?\n\nBest,\nApex`;
    cta = "Answer one costing question about the current state";
    notesForHuman = "Verify the quoted price bracket against the current price book before sending.";
  } else if (has("Wrong Contact")) {
    body = `Hi ${firstName},\n\nThanks for the straight answer — I clearly did my homework imperfectly.\n\nOne quick favor: who owns this area at ${lead.company}? Even just a name means I don't bother anyone else who isn't the right person.\n\nBest,\nApex`;
    cta = "Ask for the correct owner's name";
    notesForHuman = "Update the CRM contact record once the correct owner is identified.";
  } else if (has("Timing Concern")) {
    body = `Hi ${firstName},\n\nMakes sense — forcing this against a full plate helps nobody.\n\nSo the thread is easy to pick back up: I'll send one short piece that's useful whether or not we ever talk, and check back when the timing you mentioned comes around.\n\nIs there anything that would move the timeline up, or is it fixed?\n\nBest,\nApex`;
    cta = "One question about what could change the timeline";
    notesForHuman = "Set the follow-up date to match the timing stated in their reply.";
  } else if (needsHuman) {
    body = `Hi ${firstName},\n\nGood questions — some of them deserve precise answers rather than a salesperson's paraphrase, so I'm looping in the right specialist on our side.\n\nYou'll have a complete response within one business day.\n\nBest,\nApex`;
    cta = "Set the expectation of a specialist response within one business day";
    notesForHuman = `HUMAN REVIEW REQUIRED before any substantive answer: reply touches ${[has("Legal Review") && "legal terms", has("Security Question") && "security review", has("Procurement") && "procurement", has("Negotiation") && "pricing/discount approval", has("Executive Approval Needed") && "executive escalation"].filter(Boolean).join(", ")}.`;
  } else if (has("Request for Information")) {
    body = `Hi ${firstName},\n\nHappy to. Rather than a generic deck, one question so I send the right thing: is the more useful material about how this works technically, or what results teams like yours saw?\n\nEither way it'll be one page, not a novel.\n\nBest,\nApex`;
    cta = "One clarifying question to send the right material";
    notesForHuman = "Prepare both artifacts so the follow-up is same-day.";
  } else {
    body = `Hi ${firstName},\n\nThanks for the reply — that's useful context.\n\n${questionsAsked.length > 0 ? "You asked a fair question, and I want to answer it precisely rather than approximately, so give me until tomorrow to get you the exact detail." : `It sounds like the core issue is ${lead.crm.painPoints[0]?.toLowerCase() ?? "worth pinning down more precisely"}.`}\n\nWhat would be most useful to cover next?\n\nBest,\nApex`;
    cta = "Ask what would be most useful to cover next";
    notesForHuman = questionsAsked.length > 0
      ? `Verify answers to: ${questionsAsked.join(" | ")}`
      : "Review draft for tone before sending.";
  }

  // --- Step 8: CRM updates (only changed fields) ---
  const inDays = (n: number) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const crmUpdates: ReplyAnalysis["crmUpdates"] = {
    latestSummary: `Inbound reply classified as ${primary}. ${actionReason}`,
    nextAction: action === "Book Meeting" ? "Confirm meeting slot" : action,
    followUpDate: dead ? undefined : has("Timing Concern") ? inDays(30) : inDays(2),
  };
  if (dead) crmUpdates.leadStatus = "closed_lost";
  else if (has("Meeting Request")) crmUpdates.leadStatus = "meeting_booked";
  else if (has("Timing Concern")) crmUpdates.leadStatus = "nurturing";
  else if (!auto) crmUpdates.leadStatus = "engaged";
  crmUpdates.opportunityStage = salesStage;
  if (has("Budget Concern"))
    crmUpdates.risks = ["Budget concern raised in reply"];
  if (has("Already Using Competitor"))
    crmUpdates.competitors = ["Unnamed incumbent mentioned in reply — identify it"];

  // --- Step 9: learning ---
  const learning = {
    whatWeLearned: [
      `Prospect responds — channel and tone are viable (primary intent: ${primary}).`,
      ...(questionsAsked.length > 0
        ? [`They care enough to ask: ${questionsAsked[0]}`]
        : []),
      ...(has("Timing Concern") ? ["Timing, not relevance, is the constraint."] : []),
    ],
    assumptionsConfirmed: planPredicted
      ? [`Account plan predicted this objection ("${planPredicted.objection}") — forecast was accurate.`]
      : positive
        ? ["The problem hypothesis resonated enough to earn a reply."]
        : [],
    assumptionsIncorrect: dead
      ? ["Assumed relevance was wrong, or the timing/angle missed. Review the hook used."]
      : [],
    accountStrategyChange: dead
      ? "Close and remove from active pursuit; re-qualify only on new signals."
      : has("Timing Concern")
        ? "Shift from active pursuit to triggered nurture aligned to their stated window."
        : "None",
    outreachStrategyChange: auto
      ? "Pause sequence until the return date in the auto-reply."
      : dead
        ? "Retire this angle for this segment if rejection repeats."
        : "None",
    qualificationChange: has("Wrong Contact")
      ? "Re-map the buying committee — current contact is not the owner."
      : "None",
    improvements: [
      planPredicted
        ? "Use the account plan's prepared response for this objection — it was pre-built."
        : "Add this reply pattern to the objection forecast for similar accounts.",
    ],
  };

  // --- Step 10: escalation ---
  const escalationReasons = [
    ...(has("Legal Review") ? ["Legal terms requested"] : []),
    ...(has("Negotiation") ? ["Pricing/discount approval required"] : []),
    ...(has("Security Question") ? ["Security review may require specialist"] : []),
    ...(has("Procurement") ? ["Enterprise procurement beginning"] : []),
    ...(has("Executive Approval Needed") ? ["Executive escalation in play"] : []),
    ...(primary === "Unknown" ? ["Intent unclear — AI uncertain"] : []),
  ];

  const confLevel: ConfidenceLevel =
    primary === "Unknown" ? "Low" : intents[0].confidence >= 85 ? "High" : "Medium";

  return {
    classification: { intents, primaryIntent: primary },
    sentiment: {
      overall,
      buyerEngagement: {
        score: engagement,
        explanation: `${questionsAsked.length} question${questionsAsked.length === 1 ? "" : "s"} asked, ${message.length} chars, ${positive ? "positive" : negative ? "negative" : "neutral"} language.`,
      },
      buyingConfidence: {
        score: buyingConfidence,
        explanation: hot
          ? "Meeting-level interest expressed."
          : dead
            ? "Explicit disengagement."
            : "Engaged but not yet committed to evaluating.",
      },
      urgency: {
        score: urgency,
        explanation: urgentWords
          ? "Time-bound language present in the reply."
          : "No time pressure expressed.",
      },
      emotionalTone: dead
        ? "Final, but not hostile — respect it"
        : positive
          ? "Open and constructive"
          : "Businesslike, reserved",
      decisionReadiness: {
        score: readiness,
        explanation:
          readiness >= 60
            ? "Process signals (meeting/approval/procurement) indicate movement toward a decision."
            : "Still in problem-validation territory.",
      },
    },
    opportunityAssessment: {
      dealProbability: {
        value: newProb,
        change: fmt(newProb - prevProb),
        reason: actionReason,
      },
      buyingIntent: {
        value: newIntent,
        change: fmt(newIntent - prevIntent),
        reason: dead
          ? "Explicit rejection collapses intent."
          : hot
            ? "Meeting-level interest raises intent."
            : "Reply itself is a modest positive signal.",
      },
      priority: {
        value: newPriority,
        change: fmt(newPriority - prevPriority),
        reason: dead
          ? "Dead conversations drop out of the priority queue."
          : "Active conversations rank above cold accounts.",
      },
      relationshipStrength: {
        value: dead ? 10 : hot ? 70 : 50,
        change: dead ? "-" : "+",
        reason: "Any genuine reply strengthens the relationship except explicit rejection.",
      },
      estimatedValue: lead.estimatedDealSize ?? "Unknown",
      salesStage,
      expectedCloseDate: dead
        ? "N/A"
        : hot
          ? inDays(45)
          : has("Timing Concern")
            ? "Unknown — tied to their stated window"
            : "Unknown",
      riskLevel,
    },
    conversationSummary: {
      questionsAsked,
      questionsAnswered: [],
      openQuestions: questionsAsked,
      concernsRaised: objectionPresent ? [surface] : [],
      businessObjectives: lead.crm.goals,
      decisionCriteria: has("Pricing Question")
        ? ["Price / value ratio raised early — likely a formal criterion"]
        : [],
      stakeholdersMentioned: has("Executive Approval Needed") || has("Forwarded Internally")
        ? ["Additional internal stakeholder referenced — identify by name"]
        : [],
      deadlines: urgentWords ? ["Time-bound language used — pin down the exact date"] : [],
      commitments: [],
      agreedNextSteps: has("Meeting Request") ? ["Prospect open to a meeting — slot to be confirmed"] : [],
    },
    objectionAnalysis: {
      present: objectionPresent,
      surfaceObjection: surface,
      realObjection: has("Budget Concern")
        ? "Value not yet proven at the asked price"
        : has("Timing Concern")
          ? "Competing priorities outrank this problem right now"
          : has("Already Using Competitor")
            ? "Switching cost feels higher than the pain"
            : surface,
      hiddenConcern: objectionPresent
        ? "Risk of championing something that fails internally"
        : "None identified",
      rootCause: objectionPresent
        ? "The cost of the current state has not been quantified in their numbers"
        : "N/A",
      evidenceRequired: objectionPresent
        ? "A payback model built on figures the prospect supplies, plus one relevant proof point"
        : "None",
      responseStrategy: planPredicted?.recommendedResponse ??
        (objectionPresent
          ? "Acknowledge, quantify the current state, reduce commitment size, advance with one question"
          : "N/A"),
      riskLevel: objectionPresent ? riskLevel : "Low",
    },
    recommendedAction: { action, reason: actionReason },
    responseDraft: {
      shouldSend,
      subject: has("Meeting Request") ? `Re: time to talk — two options` : "Re: your reply",
      body,
      cta,
      notesForHuman,
    },
    crmUpdates,
    learning,
    escalation: {
      required: escalationReasons.length > 0,
      reasons: escalationReasons,
      urgency: has("Legal Review") || has("Procurement") ? "High" : escalationReasons.length > 0 ? "Medium" : "Low",
    },
    confidence: {
      level: confLevel,
      explanation:
        confLevel === "High"
          ? "Clear intent markers in the message text; classification is unambiguous."
          : confLevel === "Medium"
            ? "Intent classified with moderate certainty; human skim of the draft recommended."
            : "Intent unclear — routed to human review rather than guessed. (Demo engine — connect an OpenAI key for full reasoning.)",
    },
  };
}
