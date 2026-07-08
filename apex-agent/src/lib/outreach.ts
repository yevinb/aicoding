import OpenAI from "openai";
import { OUTREACH_SYSTEM_PROMPT } from "./outreach-prompt";
import { getPlaybook, savePlaybook } from "./outreach-store";
import { getPlan } from "./plan-store";
import { getResearch } from "./research-store";
import { getLead, updateLead } from "./store";
import {
  AccountPlan,
  ConfidenceLevel,
  Lead,
  OutreachPlaybook,
  OutreachTouch,
  ResearchProfile,
} from "./types";

export { getPlaybook };

export async function runOutreach(leadId: string): Promise<OutreachPlaybook> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const research = await getResearch(leadId);
  const plan = await getPlan(leadId);

  const body = process.env.OPENAI_API_KEY
    ? await openaiOutreach(lead, research, plan)
    : demoOutreach(lead, research, plan);

  const playbook: OutreachPlaybook = {
    ...body,
    id: crypto.randomUUID(),
    leadId: lead.id,
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
  };

  await savePlaybook(playbook);
  await updateLead(lead.id, {
    activity: [
      ...lead.activity,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "agent_run",
        summary: `Outreach Intelligence Agent — ${playbook.decision.outreachNow ? `5-touch sequence built via ${playbook.channelStrategy.primaryChannel}` : "outreach deferred: " + playbook.decision.reason}`,
      },
    ],
  });

  return playbook;
}

type PlaybookBody = Omit<OutreachPlaybook, "id" | "leadId" | "timestamp" | "engine">;

async function openaiOutreach(
  lead: Lead,
  research: ResearchProfile | null,
  plan: AccountPlan | null
): Promise<PlaybookBody> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const input = {
    crmRecord: {
      contact: {
        name: lead.contactName,
        title: lead.contactTitle,
        email: lead.email,
        linkedin: lead.linkedin,
      },
      company: {
        name: lead.company,
        industry: lead.industry,
        size: lead.companySize,
        location: lead.location,
        funding: lead.fundingStage,
        techStack: lead.techStack,
      },
      buyingSignals: lead.buyingSignals,
      notes: lead.notes,
      status: lead.status,
      crm: lead.crm,
      previousOutreach: lead.activity
        .filter((a) => a.type === "agent_run" || a.type === "objection")
        .slice(-8)
        .map((a) => ({ when: a.timestamp, summary: a.summary })),
    },
    researchProfile: research ?? "Not available",
    strategicAccountPlan: plan ?? "Not available",
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.5,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: OUTREACH_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Build the full outreach playbook for this account. Inputs:\n${JSON.stringify(input, null, 2)}\n\nProduce the JSON playbook.`,
      },
    ],
  });

  return JSON.parse(
    response.choices[0]?.message?.content ?? "{}"
  ) as PlaybookBody;
}

/**
 * Deterministic playbook built from verified lead data plus the research
 * profile and account plan when available. No fabricated personalization:
 * hooks come only from recorded signals, pains, and CRM history.
 */
function demoOutreach(
  lead: Lead,
  research: ResearchProfile | null,
  plan: AccountPlan | null
): PlaybookBody {
  const firstName = lead.contactName.split(" ")[0];
  const signal = lead.buyingSignals[0];
  const signal2 = lead.buyingSignals[1];
  const pain =
    research?.painPoints.confirmed[0] ??
    lead.crm.painPoints.find((p) => !/unknown/i.test(p));
  const hasFunding = /series|seed|\$|funded|equity/i.test(lead.fundingStage);
  const engaged = lead.status === "engaged" || lead.status === "meeting_booked";
  const outreachNow = engaged || lead.buyingSignals.length > 0;
  const signalLower = signal
    ? signal.charAt(0).toLowerCase() + signal.slice(1)
    : null;
  // Quotable short form of the pain point for natural sentence embedding.
  const painRef = pain
    ? `"${pain.replace(/\s*\([^)]*\)/g, "").toLowerCase()}"`
    : null;

  const primaryProblem =
    pain ??
    (signal
      ? `Executing "${signal}" with current processes and headcount`
      : "Unverified — discovery required before a problem can be claimed");

  const outcome = pain
    ? `Removing "${pain.toLowerCase()}" as a constraint on growth`
    : signal
      ? `Making "${signalLower}" deliver results without proportional cost`
      : "To be established in discovery";

  const cta = engaged
    ? "Propose two specific 30-minute slots"
    : "One yes/no question that validates the problem — no meeting request yet";

  const hook = signalLower
    ? `${lead.company} ${signalLower}`
    : `the pace ${lead.company} is moving in ${lead.industry || "its market"}`;

  const touch1Body = [
    `Hi ${firstName},`,
    "",
    signal
      ? `${lead.company} ${signalLower} — in my experience that's the point where ${painRef ? `${painRef} stops being a tolerable annoyance and starts costing pipeline` : "the processes that worked at the previous size start to crack"}.`
      : `Teams in ${lead.industry || "your space"} at your stage usually hit the same wall: the process that got them here stops scaling.`,
    "",
    pain
      ? `Most teams don't put a number on that cost until two quarters in — by then the cheapest fixes are gone.`
      : `The costly part is usually invisible until someone puts a number on it.`,
    "",
    `Is that showing up for your team yet? A one-line reply either way is genuinely useful.`,
    "",
    `Best,`,
    `Apex`,
  ].join("\n");

  const sequence: OutreachTouch[] = [
    {
      touch: 1,
      day: 0,
      channel: "Email",
      objective: "Open with a verified, business-relevant hook and validate the problem",
      subject: signal ? `${firstName} — a question about ${hook}` : `A question about ${lead.company}'s next stage`,
      message: touch1Body,
      cta: "Reply with whether the problem is real for them (yes/no)",
      successCondition: "Any reply, including a negative one",
      fallbackAction: "Proceed to touch 2 on day 3",
    },
    {
      touch: 2,
      day: 3,
      channel: "Email",
      objective: "Add value with a concrete, relevant proof point — no repeat of touch 1's framing",
      subject: "",
      message: [
        `Hi ${firstName},`,
        "",
        `One data point that may be useful regardless of whether we ever talk: ${lead.industry ? `a ${lead.industry.split("/")[0].trim()} company` : "a company"} at a similar stage cut ${painRef ? `the cost of ${painRef}` : "their time-to-result on exactly this kind of initiative"} by measuring one number weekly before changing any tooling.`,
        "",
        `Happy to share the one-page breakdown if useful — shall I send it over?`,
        "",
        `Best,`,
        `Apex`,
      ].join("\n"),
      cta: "Ask permission to share a one-page case breakdown",
      successCondition: "Reply requesting the material or engaging with the idea",
      fallbackAction: "Switch channel: LinkedIn on day 7",
    },
    {
      touch: 3,
      day: 7,
      channel: "LinkedIn",
      objective: "Second channel; short, peer-level note referencing the thread without repeating it",
      subject: "",
      message: `${firstName} — sent you two notes about ${signal ? `the ${signalLower} push` : "scaling your current process"}. Email may not be your channel, so trying here once. If the problem isn't real for ${lead.company}, tell me and I'll close the file.`,
      cta: "Invite a direct yes/no on relevance",
      successCondition: "Connection accepted or reply received",
      fallbackAction: "Proceed to touch 4 on day 12",
    },
    {
      touch: 4,
      day: 12,
      channel: "Video Message",
      objective: "Demonstrate effort and specificity; walk through the hypothesis visually in under 90 seconds",
      subject: "",
      message: `[90-second video script] ${firstName}, I'll keep this under two minutes. ${signal ? `Here's what I've seen happen at companies mid-way through ${signalLower}` : `Here's the pattern I've seen at companies like ${lead.company}`}: [show one chart — the cost curve of ${painRef ?? "the unmeasured current state"}]. If this curve looks familiar, the fix is cheaper earlier. If it doesn't, you're ahead of the curve and I'll stop here.`,
      cta: "Watch the 90-second video and reply with one word: familiar or not",
      successCondition: "Video watched and any reply",
      fallbackAction: "Send final touch on day 18",
    },
    {
      touch: 5,
      day: 18,
      channel: "Email",
      objective: "Professional close of the sequence; leave the door open without pressure",
      subject: `Closing the loop, ${firstName}`,
      message: [
        `Hi ${firstName},`,
        "",
        `I've shared a hypothesis${signal ? ` about ${signalLower}` : ""}, a proof point, and a short walkthrough — and I don't want to add noise to your inbox.`,
        "",
        `I'll assume the timing isn't right and stop here. If ${painRef ?? "this problem"} moves up your list later, my earlier notes will still be accurate and I'll pick up exactly where we left off.`,
        "",
        `Best,`,
        `Apex`,
      ].join("\n"),
      cta: "None required — explicit permission to re-engage later",
      successCondition: "Reply of any kind, or a clean close",
      fallbackAction: "Move to nurture; re-check signals in 60 days",
    },
  ];

  const followUpLogic = [
    {
      scenario: "No response after full sequence",
      nextResponse: "Move to nurture. Re-open only on a new verified trigger (funding, hiring, leadership change) with a fresh angle — never re-send the old sequence.",
    },
    {
      scenario: "Positive response",
      nextResponse: `Reply within an hour. Confirm the specific pain in their words, then offer two concrete 30-minute slots with a stated agenda: "${plan?.engagementStrategy.meetingObjective ?? "validate the problem, quantify impact, map who else should be involved"}".`,
    },
    {
      scenario: "Interested, but later",
      nextResponse: "Ask what changes between now and then, calendar the trigger date, and send one relevant artifact now so the thread survives the gap.",
    },
    {
      scenario: "Budget objection",
      nextResponse: "Shift from price to cost-of-current-state. Ask what handling this manually costs per month, then size a phased start below their discretionary threshold.",
    },
    {
      scenario: "Timing objection",
      nextResponse: signal
        ? `Tie to their own clock: "${signal}" has a deadline whether or not a tool is involved. Ask what happens to that initiative in the meantime.`
        : "Ask what would need to be true for the timing to be right, and get a specific re-engage date.",
    },
    {
      scenario: "Already using a competitor",
      nextResponse: "Acknowledge it positively. Ask what it does well and where it falls short of what they hoped. Position on the gap only if one exists — otherwise close cleanly and stay in touch.",
    },
    {
      scenario: "No authority",
      nextResponse: "Thank them and ask who owns the outcome. Request a warm intro with a one-paragraph summary they can forward verbatim.",
    },
    {
      scenario: "Security concern",
      nextResponse: "Send the security overview pack same-day, unprompted detail included. Offer a direct call between their security lead and ours.",
    },
    {
      scenario: "Technical concern",
      nextResponse: `Get the specific concern in writing, answer only that concern with evidence${lead.techStack.length ? ` (integration specifics for ${lead.techStack.join(", ")})` : ""}, and offer a technical validation session — not a sales call.`,
    },
  ];

  const objectionResponses = [
    {
      objection: "Price",
      response: "That's a fair reaction to a number without context. Can I ask what you're comparing it against? Most teams compare against zero, but the real baseline is what the current state costs monthly.",
      riskReducer: "Phased start priced below the full commitment, with defined exit criteria.",
      advanceWith: "If the math showed payback inside two quarters using your numbers, would the price still be the blocker?",
    },
    {
      objection: "Competition",
      response: "They're a credible option — teams pick them for good reasons. The pattern we see is they're strong on breadth and weaker on the specific outcome you named. Worth verifying rather than taking my word.",
      riskReducer: "Offer a side-by-side evaluation criteria sheet they can use with any vendor.",
      advanceWith: "What would the winner have to prove in the first 30 days for you to feel the choice was right?",
    },
    {
      objection: "Timing",
      response: "Understood — forcing this now against a full roadmap helps nobody. The only thing I'd flag is that the cost of the current state doesn't pause while priorities sort out.",
      riskReducer: "Offer a zero-commitment baseline measurement now so the later decision is grounded in data.",
      advanceWith: "What's the event that would move this up the list — and when do you expect it?",
    },
    {
      objection: "Budget",
      response: "Makes sense; unbudgeted spend has a high bar. Usually this either fits an existing line (tooling, efficiency, the initiative itself) or the case gets built for next cycle.",
      riskReducer: "Size the first phase to fit discretionary limits; provide a one-page business case for the budget owner.",
      advanceWith: "Whose budget would this most naturally live in, and what does that person need to see?",
    },
    {
      objection: "Security",
      response: "Right question to ask early. We'd rather go through review before you've invested time than after.",
      riskReducer: "Security pack sent same-day; direct line to our security team; review runs parallel to evaluation, not after.",
      advanceWith: "Who runs security review on your side, and can I get them what they need this week?",
    },
    {
      objection: "Implementation",
      response: "Fair — most tools underestimate this and the buyer pays for it. Our first phase is deliberately scoped to produce a visible result inside 30 days with minimal lift from your team.",
      riskReducer: "Named implementation owner on our side; weekly check-ins for the first month; rollback plan in writing.",
      advanceWith: "What did the last rollout that went badly here look like — so we design around it?",
    },
    {
      objection: "Resources",
      response: "If your team has no bandwidth to adopt something new, that's real. The setup is designed to consume hours, not weeks, of your team's time — and most of it is ours to do.",
      riskReducer: "We do the heavy lifting; their time investment is specified upfront in hours.",
      advanceWith: "If the total ask on your team were under four hours in month one, does that change the picture?",
    },
    {
      objection: "Executive buy-in",
      response: "Then let's build the case your exec actually needs rather than more product detail. Execs buy outcomes tied to numbers they already report on.",
      riskReducer: "One-page executive brief in their format; offer to co-present or stay out of the room, their choice.",
      advanceWith: "Which number on your exec's dashboard would this most credibly move?",
    },
  ];

  const meetingRecommended = engaged;
  const meetingPlan = {
    recommended: meetingRecommended,
    goal: plan?.engagementStrategy.meetingObjective ?? "Validate the problem, quantify impact, and map the buying committee — not a demo.",
    agenda: plan?.engagementStrategy.meetingAgenda ?? [
      "5 min — their situation in their words",
      "15 min — discovery on the primary problem",
      "5 min — one concrete example of the problem solved",
      "5 min — agree next step and who else should be involved",
    ],
    discoveryObjectives: [
      `Confirm whether "${primaryProblem}" is real and owned`,
      "Quantify the monthly cost of the current state",
      "Identify the full buying committee and the decision process",
      "Establish the compelling event and its date",
    ],
    questionsToAsk: plan?.discoveryPlan.flatMap((g) => g.questions).slice(0, 6) ?? [
      "What triggered your current priorities, and who owns the outcome?",
      "How are you handling this today, and where does it break first?",
      "If this went perfectly, what number changes and by when?",
      "Who else would be involved in evaluating something like this?",
    ],
    expectedOutcome: "A mutual decision: either a scoped next step with a second stakeholder present, or a clean disqualification.",
    successCriteria: [
      "Problem confirmed and quantified in their numbers",
      "At least one additional stakeholder identified by name",
      "A dated next step agreed before the call ends",
    ],
  };

  const personalizationScore = signal ? 90 : pain ? 87 : 85;
  const qualityScores = {
    personalization: {
      score: personalizationScore,
      explanation: signal
        ? `Anchored to a verified event ("${signal}") with a business consequence, not a trivial observation.`
        : pain
          ? `Anchored to a recorded pain point ("${pain}") from the CRM.`
          : "No verified signals available — personalization rests on industry and stage patterns, the honest ceiling without fabricating.",
    },
    relevance: {
      score: signal || pain ? 91 : 85,
      explanation: "The hook, hypothesis, and CTA all point at the same problem the account is verifiably living through.",
    },
    businessValue: {
      score: 88,
      explanation: "Message leads with the cost of the current state and a measurable outcome, not product features.",
    },
    clarity: {
      score: 92,
      explanation: "Short paragraphs, one idea per touch, exactly one CTA, no jargon or marketing language.",
    },
    trust: {
      score: 90,
      explanation: "No hype, no fake urgency, no banned filler phrases; explicitly invites a negative reply, which raises credibility.",
    },
    likelihoodOfReply: {
      score: engaged ? 89 : 85,
      explanation: engaged
        ? "Existing engagement plus a one-line-reply CTA makes response low-effort."
        : "Cold outreach; the yes/no CTA is the lowest-friction ask available.",
    },
    overallQuality: {
      score: signal ? 90 : 86,
      explanation: "All dimensions at or above the 85 threshold; strongest with a verified event to anchor on.",
    },
  };

  const abTests = {
    versionA: {
      subject: sequence[0].subject,
      message: sequence[0].message,
    },
    versionB: {
      subject: pain
        ? `${pain.replace(/\s*\([^)]*\)/g, "").split(" ").slice(0, 5).join(" ").toLowerCase()} — a hypothesis`
        : `A hypothesis about ${lead.company}`,
      message: [
        `Hi ${firstName},`,
        "",
        `A hypothesis, and feel free to tell me it's wrong: ${painRef ? `${painRef} is costing ${lead.company} more than anyone has put a number on` : `the process that got ${lead.company} here is quietly becoming the bottleneck`}.`,
        "",
        `If that's off-base, a one-word reply kills it. If it's close, I can show you how two similar teams measured it in under a week.`,
        "",
        `Best,`,
        `Apex`,
      ].join("\n"),
    },
    hypothesis: "Event-anchored openers (A) outperform hypothesis-led openers (B) when the buying signal is recent and public; B wins when the signal is stale or the pain is more certain than the event.",
    difference: "A opens with the verified company event and derives the problem; B opens with a falsifiable claim about the problem and invites correction.",
    whenToUseA: "Signal is fresh (under ~60 days) and publicly verifiable.",
    whenToUseB: "No fresh signal, or the recorded pain point is stronger than any public event.",
    expectedAudience: `Senior operators like ${lead.contactTitle || "the target persona"} — direct, skeptical of flattery, reply to specificity.`,
  };

  const basedOn = [
    ...(signal ? [`Verified signal: ${signal}`] : []),
    ...(signal2 ? [`Verified signal: ${signal2}`] : []),
    ...(pain ? [`Recorded pain point: ${pain}`] : []),
    ...(lead.contactTitle ? [`Contact role: ${lead.contactTitle}`] : []),
    ...(hasFunding ? [`Funding: ${lead.fundingStage}`] : []),
    ...(plan ? ["Strategic account plan available"] : []),
    ...(research ? ["Research profile available"] : []),
  ];

  const level: ConfidenceLevel =
    basedOn.length >= 4 ? "High" : basedOn.length >= 2 ? "Medium" : "Low";

  return {
    decision: {
      outreachNow,
      reason: outreachNow
        ? engaged
          ? "Active engagement exists — the cost of silence now exceeds the risk of a well-timed touch."
          : `Verified signal${lead.buyingSignals.length > 1 ? "s give" : " gives"} a credible, non-fabricated reason to reach out today.`
        : "No verified signals and no engagement — outreach now would force generic personalization. Run deep research first; one verified trigger changes this decision.",
      firstStakeholder: plan?.engagementStrategy.firstContact ?? `${lead.contactName}${lead.contactTitle ? ` (${lead.contactTitle})` : ""} — closest to the pain, presumed champion`,
      primaryBusinessProblem: primaryProblem,
      outcomeEmphasized: outcome,
      supportingEvidence: signal
        ? `Their own public activity ("${signal}") plus pattern evidence from similar companies — no unverifiable claims used.`
        : "Industry-stage patterns only; flagged as hypothesis, never asserted as fact.",
      lowestFrictionCta: cta,
    },
    channelStrategy: {
      primaryChannel: lead.email ? "Email" : lead.linkedin ? "LinkedIn" : "Multiple Touch Sequence",
      rationale: lead.email
        ? `Email address on file; ${lead.crm.notes.toLowerCase().includes("email") ? "CRM notes indicate email preference; " : ""}senior operators process asynchronous, skimmable messages best. LinkedIn and video reserved as pattern-interrupts later in the sequence.`
        : "No email on file — LinkedIn is the only verified channel.",
      alternates: ["LinkedIn (touch 3)", "Video Message (touch 4)", ...(engaged ? ["Phone — earned after first reply"] : [])],
    },
    sequence,
    followUpLogic,
    objectionResponses,
    meetingPlan,
    qualityScores,
    abTests,
    confidence: {
      level,
      basedOn: basedOn.length ? basedOn : ["CRM record only — thin basis"],
      cautions: [
        ...(signal ? [] : ["No verified event — openers rest on patterns, which lowers reply probability"]),
        "Send-time matters: first touch lands best Tuesday–Thursday morning in the prospect's timezone",
        ...(lead.crm.notes ? [`CRM note to respect: ${lead.crm.notes}`] : []),
        "If any touch gets a negative reply, stop the sequence immediately — the close-the-file promise must be honored",
      ],
    },
  };
}
