import OpenAI from "openai";
import { PLANNING_SYSTEM_PROMPT } from "./planning-prompt";
import { getPlan, savePlan } from "./plan-store";
import { getResearch } from "./research-store";
import { getLead, updateLead } from "./store";
import {
  AccountClassification,
  AccountPlan,
  ConfidenceLevel,
  Lead,
  PlanObjection,
  PlanRisk,
  PlanStakeholder,
  ResearchProfile,
  RiskLevel,
} from "./types";

export { getPlan };

export async function runPlanning(leadId: string): Promise<AccountPlan> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");
  const research = await getResearch(leadId);

  const body = process.env.OPENAI_API_KEY
    ? await openaiPlan(lead, research)
    : demoPlan(lead, research);

  const plan: AccountPlan = {
    ...body,
    id: crypto.randomUUID(),
    leadId: lead.id,
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
  };

  await savePlan(plan);
  await updateLead(lead.id, {
    activity: [
      ...lead.activity,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "agent_run",
        summary: `Strategic Account Planning Agent — plan built (${plan.executiveAssessment.classification}, deal probability ${plan.successPlan.dealProbability}%)`,
      },
    ],
  });

  return plan;
}

type PlanBody = Omit<AccountPlan, "id" | "leadId" | "timestamp" | "engine">;

async function openaiPlan(
  lead: Lead,
  research: ResearchProfile | null
): Promise<PlanBody> {
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
        website: lead.website,
        industry: lead.industry,
        size: lead.companySize,
        location: lead.location,
        funding: lead.fundingStage,
        techStack: lead.techStack,
      },
      buyingSignals: lead.buyingSignals,
      notes: lead.notes,
      status: lead.status,
      scores: {
        fit: lead.fitScore,
        intent: lead.intentScore,
        priority: lead.priorityScore,
        estimatedDealSize: lead.estimatedDealSize,
        closeProbability: lead.closeProbability,
      },
      crm: lead.crm,
      recentActivity: lead.activity.slice(-8).map((a) => ({
        when: a.timestamp,
        type: a.type,
        summary: a.summary,
      })),
    },
    researchIntelligenceProfile: research ?? "Not yet available for this account",
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PLANNING_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Build the full strategic account plan for this account. Available inputs:\n${JSON.stringify(input, null, 2)}\n\nProduce the JSON plan.`,
      },
    ],
  });

  return JSON.parse(response.choices[0]?.message?.content ?? "{}") as PlanBody;
}

/**
 * Deterministic account plan built from CRM data and the research profile
 * when available. Inferred recommendations are labeled as such.
 */
function demoPlan(lead: Lead, research: ResearchProfile | null): PlanBody {
  const hasFunding = /series|seed|\$|funded|equity/i.test(lead.fundingStage);
  const largeCo = /\d{3,}/.test(lead.companySize);
  const signalCount = lead.buyingSignals.length;
  const engaged = lead.status === "engaged" || lead.status === "meeting_booked";
  const firstName = lead.contactName.split(" ")[0];
  const topSignal = lead.buyingSignals[0];

  const priority =
    research?.qualification.priorityScore ?? lead.priorityScore ?? 40;
  const dealSize =
    research?.qualification.expectedDealSize ??
    lead.estimatedDealSize ??
    (largeCo ? "$80,000–$150,000 ARR" : hasFunding ? "$30,000–$60,000 ARR" : "$10,000–$25,000 ARR");

  const classification: AccountClassification =
    priority >= 70
      ? "High Priority"
      : priority >= 50
        ? "Medium Priority"
        : priority >= 30
          ? "Low Priority"
          : "Disqualify";

  const dealProbability = Math.max(
    5,
    Math.min(85, Math.round(priority * 0.5 + (engaged ? 15 : 0)))
  );

  // Stakeholders: primary contact + CRM-mapped + expected roles.
  const stakeholders: PlanStakeholder[] = [];
  const seniorContact = /vp|chief|head|director|founder|c[eoft]o/i.test(
    lead.contactTitle
  );
  stakeholders.push({
    name: lead.contactName,
    role: lead.contactTitle || "Unknown",
    influence: seniorContact ? "High" : "Medium",
    authority: /chief|founder|c[eoft]o/i.test(lead.contactTitle)
      ? "High"
      : seniorContact
        ? "Medium"
        : "Low",
    likelyPriorities: seniorContact
      ? ["Hitting targets owned by their function", "Team productivity", "Defensible ROI"]
      : ["Workflow efficiency", "Ease of adoption"],
    likelyConcerns: ["Implementation effort", "Whether this survives budget review"],
    communicationStyle: seniorContact
      ? "Direct, outcome-focused — lead with numbers, keep messages short (inferred from seniority)"
      : "Practical and detail-oriented (inferred)",
    outcomesTheyCareAbout: topSignal
      ? [`Making "${topSignal}" succeed`, "Looking good to leadership"]
      : ["Predictable results", "Low-risk decisions"],
    engagementOrder: 1,
    decisionInfluenceScore: seniorContact ? 80 : 55,
  });
  lead.crm.decisionMakers
    .filter((dm) => !dm.startsWith(lead.contactName))
    .forEach((dm, i) => {
      stakeholders.push({
        name: dm,
        role: "Unknown",
        influence: "Medium",
        authority: "Medium",
        likelyPriorities: ["Unknown — validate in discovery"],
        likelyConcerns: ["Unknown — validate in discovery"],
        communicationStyle: "Unknown",
        outcomesTheyCareAbout: ["Unknown — validate in discovery"],
        engagementOrder: i + 2,
        decisionInfluenceScore: 60,
      });
    });
  stakeholders.push({
    name: "Unknown — likely Finance approver (CFO / Finance Director)",
    role: "Budget sign-off",
    influence: "Medium",
    authority: "High",
    likelyPriorities: ["Cost control", "Contract flexibility"],
    likelyConcerns: ["Unbudgeted spend", "Lock-in"],
    communicationStyle: "Numbers-first; wants the business case in one page (inferred)",
    outcomesTheyCareAbout: ["Measurable ROI within the fiscal year"],
    engagementOrder: stakeholders.length + 1,
    decisionInfluenceScore: 70,
  });

  const opportunities = [
    ...(topSignal
      ? [
          {
            rank: 1,
            opportunity: `Support the initiative behind: ${topSignal}`,
            category: "Business initiative",
            businessDriver: "Publicly visible commitment creates internal pressure to deliver",
            expectedImpact: "High" as ConfidenceLevel,
          },
        ]
      : []),
    ...(hasFunding
      ? [
          {
            rank: topSignal ? 2 : 1,
            opportunity: "Convert new capital into measurable growth without proportional headcount",
            category: "Financial challenge",
            businessDriver: `Investor expectations attached to ${lead.fundingStage.split("(")[0].trim()}`,
            expectedImpact: "High" as ConfidenceLevel,
          },
        ]
      : []),
    ...(research?.painPoints.confirmed ?? lead.crm.painPoints)
      .slice(0, 2)
      .map((p, i) => ({
        rank: (topSignal ? 1 : 0) + (hasFunding ? 1 : 0) + i + 1,
        opportunity: `Resolve confirmed problem: ${p}`,
        category: "Operational challenge",
        businessDriver: "Already acknowledged internally — lowest resistance to act on",
        expectedImpact: "Medium" as ConfidenceLevel,
      })),
  ];
  if (opportunities.length === 0) {
    opportunities.push({
      rank: 1,
      opportunity: "Unknown — no verified initiatives; discovery required before strategy can be ranked",
      category: "Business initiative",
      businessDriver: "Unknown",
      expectedImpact: "Low" as ConfidenceLevel,
    });
  }

  const competitors =
    research?.competitors.map((c) => c.name) ??
    (lead.crm.competitors.length ? lead.crm.competitors : []);
  const incumbents = competitors.filter((c) => /internal|status quo/i.test(c));
  const external = competitors.filter((c) => !/internal|status quo/i.test(c));

  const objections: PlanObjection[] = [
    {
      objection: "We already have a way of handling this",
      probability: external.length > 0 ? "High" : "Medium",
      severity: "Medium",
      rootCause: "Incumbent tooling or process exists; switching feels like effort without guaranteed payoff",
      recommendedResponse: "Don't attack the incumbent. Ask what it does well, then quantify the gap it leaves against their own stated initiative.",
      evidenceNeeded: "Side-by-side outcome comparison relevant to their use case",
    },
    {
      objection: "This isn't a priority this quarter",
      probability: engaged ? "Low" : "High",
      severity: "High",
      rootCause: "No internal deadline tied to the problem",
      recommendedResponse: topSignal
        ? `Tie directly to "${topSignal}" — that initiative has its own clock; quantify the cost of running it without support.`
        : "Ask what would need to be true for this to become a priority, and calendar the trigger.",
      evidenceNeeded: "Cost-of-delay calculation using their own numbers",
    },
    {
      objection: "The price is too high",
      probability: "Medium",
      severity: "Medium",
      rootCause: "Value not yet anchored to a business outcome",
      recommendedResponse: "Reframe from cost to ratio: price against the quantified cost of the current state. Offer a phased start to reduce commitment.",
      evidenceNeeded: "ROI model with conservative assumptions they agree to",
    },
    ...(largeCo
      ? [
          {
            objection: "Security and procurement review will take months",
            probability: "High" as ConfidenceLevel,
            severity: "Medium" as ConfidenceLevel,
            rootCause: "Enterprise governance process",
            recommendedResponse: "Provide security documentation proactively at first meeting; run procurement in parallel with the pilot, not after it.",
            evidenceNeeded: "Security/compliance pack, reference from a similar-sized customer",
          },
        ]
      : []),
  ];

  const risks: PlanRisk[] = [
    {
      area: "Budget",
      risk: hasFunding
        ? "Funding exists but this line item is unbudgeted"
        : "No verified budget signal",
      level: hasFunding ? "Medium" : "High",
      mitigation: "Ask about budget process in first discovery call; size the deal to fit discretionary limits if needed.",
    },
    {
      area: "Authority",
      risk: seniorContact
        ? `${lead.contactName} likely influences but may not sign alone`
        : "Primary contact's decision authority is unverified",
      level: seniorContact ? "Medium" : "High",
      mitigation: "Map the buying committee by asking who else would evaluate this; multi-thread early.",
    },
    {
      area: "Timing",
      risk: topSignal
        ? "Initiative window could close if engagement is slow"
        : "No time-bound trigger identified",
      level: topSignal ? "Medium" : "High",
      mitigation: topSignal
        ? "Anchor every touch to the initiative's own timeline."
        : "Find or create a compelling event in discovery.",
    },
    {
      area: "Competition",
      risk: external.length > 0
        ? `${external.join(", ")} already known to the account`
        : "Unknown competitive presence",
      level: external.length > 0 ? "Medium" : "Low",
      mitigation: external.length > 0
        ? "Position on the differentiators competitors are weakest on; never disparage."
        : "Ask directly what else they are evaluating.",
    },
    {
      area: "Technical",
      risk: lead.techStack.length > 0
        ? `Must integrate with ${lead.techStack.join(", ")}`
        : "Stack unknown — integration effort cannot be scoped",
      level: "Medium",
      mitigation: "Validate integration requirements in the technical discovery block.",
    },
    {
      area: "Relationship",
      risk: engaged
        ? "Relationship is single-threaded through one contact"
        : "No relationship established yet",
      level: engaged ? "Medium" : "High",
      mitigation: "Build at least two independent relationships before proposal stage.",
    },
    {
      area: "Champion",
      risk: `${lead.contactName} is the presumed champion but has not proven willingness to sell internally`,
      level: "Medium",
      mitigation: "Test champion strength by asking them to bring a colleague to the next meeting.",
    },
    {
      area: "Implementation",
      risk: largeCo
        ? "Enterprise rollout requires change management across teams"
        : "Small team — implementation depends on one or two people's bandwidth",
      level: largeCo ? "High" : "Low",
      mitigation: "Present a phased implementation plan with a fast first win inside 30 days.",
    },
  ];

  const gaps = research?.confidence.researchGaps ?? [];
  const confidenceLevel: ConfidenceLevel = research
    ? research.confidence.level
    : signalCount > 0
      ? "Medium"
      : "Low";

  return {
    executiveAssessment: {
      company: `${lead.company}${lead.industry ? ` — ${lead.industry}` : ""}${lead.location ? `, ${lead.location}` : ""}`,
      currentSituation: topSignal
        ? `Active change underway: ${lead.buyingSignals.join("; ")}. Status: ${lead.status}.`
        : `No verified initiatives. Status: ${lead.status}.`,
      strategicImportance: largeCo
        ? "High — enterprise logo with multi-department expansion potential"
        : hasFunding
          ? "Medium — funded and growing; value scales with their headcount"
          : "Standard — value depends on growth trajectory",
      revenuePotential: dealSize,
      recommendation:
        classification === "High Priority"
          ? "Pursue now with a senior-led, initiative-anchored approach."
          : classification === "Medium Priority"
            ? "Pursue with standard cadence; invest more once intent is validated."
            : classification === "Low Priority"
              ? "Nurture only; do not invest heavy pre-sales effort yet."
              : "Do not pursue at this time.",
      classification,
      rationale: `Priority ${priority} from ${research ? "research profile" : "CRM scores"}: ${signalCount} verified signal${signalCount === 1 ? "" : "s"}, ${engaged ? "active engagement" : "no engagement yet"}, ${hasFunding ? "verified funding" : "no verified funding"}.`,
    },
    opportunities,
    stakeholders,
    salesStrategy: {
      primaryValueProposition: topSignal
        ? `Make "${topSignal}" succeed faster and with less risk than doing it with current tools and headcount alone.`
        : "Quantify and eliminate the cost of the current way of working (to be validated in discovery).",
      secondaryValueProposition: hasFunding
        ? "Turn investor capital into measurable output without proportional cost growth."
        : "Reduce operational drag so the existing team produces more.",
      businessCase: `At ${dealSize}, the deal pays back if it ${largeCo ? "recovers a fraction of one percent of operating cost" : "saves the equivalent of a part-time hire or unlocks a handful of additional deals"}. Anchor the case to one number the champion already reports on.`,
      roiNarrative: "Conservative model: take their own baseline metric, apply a modest improvement they agree is plausible, and show payback inside two quarters. Never use vendor-claimed multipliers.",
      competitivePositioning: external.length > 0
        ? `Respect ${external.join(" and ")} — position on the specific outcomes they underserve rather than feature lists.`
        : "Primary competitor is the status quo; position against the cost of inaction.",
      riskReductionStrategy: "Phased start, clear exit criteria, security documentation upfront, reference call offered before contract.",
      proofPointsRequired: [
        `A customer story in ${lead.industry || "a similar industry"} with a quantified outcome`,
        "Integration proof for their known stack",
        "Implementation timeline showing first value inside 30 days",
      ],
      successMetrics: [
        "One agreed baseline metric improved by an agreed amount within a quarter",
        "Adoption by the primary team within 30 days",
        "Champion able to present ROI internally without our help",
      ],
      implementationStrategy: largeCo
        ? "Land with one team, prove value in 30 days, expand department by department with executive sponsorship."
        : "Single-phase rollout with the whole team, weekly check-ins for the first month.",
      expansionOpportunities: [
        largeCo ? "Adjacent departments and regions" : "Seat growth as the company scales",
        "Premium tier once usage matures",
      ],
    },
    discoveryPlan: [
      {
        category: "Business",
        questions: [
          topSignal
            ? `What's driving "${topSignal.toLowerCase()}" — and what happens if it slips?`
            : "What are the top two priorities for your team this year?",
          "How does this initiative connect to what leadership is measured on?",
        ],
      },
      {
        category: "Financial",
        questions: [
          "What does the current way of doing this cost you per month, roughly?",
          "How do purchases like this usually get budgeted and approved here?",
        ],
      },
      {
        category: "Technical",
        questions: [
          lead.techStack.length > 0
            ? `How central are ${lead.techStack.slice(0, 2).join(" and ")} to this workflow?`
            : "What does your current stack look like for this workflow?",
          "What would integration need to look like for your team to adopt this without friction?",
        ],
      },
      {
        category: "Operational",
        questions: [
          "Walk me through how this works today — where does it break first as you grow?",
          "Who feels the pain most acutely day to day?",
        ],
      },
      {
        category: "Executive",
        questions: [
          "If this went perfectly, what would your exec team see change in the numbers?",
          "Who at leadership level cares most about this outcome?",
        ],
      },
      {
        category: "Decision Process",
        questions: [
          "Who else would be involved in evaluating something like this?",
          "What did your last comparable purchase process look like, start to finish?",
        ],
      },
      {
        category: "Success Criteria",
        questions: [
          "What number would need to move, by how much, for this to be an obvious win?",
          "How will you personally judge whether this worked in six months?",
        ],
      },
      {
        category: "Timeline",
        questions: [
          "Is there a date this needs to be working by — and what sets that date?",
        ],
      },
      {
        category: "Risks",
        questions: [
          "What would make this project fail internally, even with the right tool?",
          "What happened the last time a new tool was rolled out here?",
        ],
      },
    ],
    objectionForecast: objections,
    engagementStrategy: {
      firstContact: `${lead.contactName} (${lead.contactTitle || "role unverified"}) — presumed champion and closest to the pain.`,
      secondContact:
        stakeholders[1]?.name ??
        "Unknown — identify the operational owner in first discovery",
      thirdContact: "Finance approver — engage only once value is validated and quantified",
      preferredChannel: lead.email
        ? "Email first (address on file), LinkedIn as second channel"
        : lead.linkedin
          ? "LinkedIn (no email on file)"
          : "Unknown — acquire a contact channel first",
      meetingObjective: "Validate the problem, quantify impact, map the buying committee. Not a demo.",
      meetingAgenda: [
        "5 min — their current situation in their words",
        "15 min — discovery on the top-ranked opportunity",
        "5 min — where we've seen this solved (one concrete example)",
        "5 min — agree next step and who else should be involved",
      ],
      contentToShare: [
        `One ${lead.industry || "relevant"} case study with a quantified result`,
        "One-page security/compliance overview (proactively)",
      ],
      caseStudyThemes: [
        topSignal ? `Companies mid-way through: ${topSignal.toLowerCase()}` : "Companies at a similar growth stage",
        hasFunding ? "Post-funding scale-up efficiency" : "Doing more with a fixed team",
      ],
      timingRecommendations: topSignal
        ? "Engage immediately — the initiative is live now and vendor decisions consolidate early."
        : "Standard cadence; accelerate only when a trigger event appears.",
      followUpCadence: [
        "Day 0: first touch",
        "Day 3: value-add follow-up (new angle)",
        "Day 7: second channel",
        "Day 14: final check-in, then nurture",
      ],
      escalationPath: "If champion stalls twice: polite executive-to-executive note referencing the business initiative, offering to close the loop either way.",
    },
    competitiveStrategy: {
      likelyCompetitors: external.length > 0 ? external : ["Unknown — probe in discovery"],
      incumbentVendors: incumbents.length > 0 ? incumbents : ["Status quo / manual process (assumed)"],
      switchingBarriers: [
        "Data / workflow migration effort",
        "Team retraining and adoption risk",
        ...(largeCo ? ["Procurement and security review cycle"] : []),
      ],
      competitiveWeaknesses: external.length > 0
        ? [`${external.join(", ")}: typically strong on breadth, weaker on the specific outcome this account needs (validate)`]
        : ["Status quo: no accountability for the metric this account needs to move"],
      differentiatorsToEmphasize: [
        "Time-to-first-value (30 days vs. quarters)",
        "Outcome accountability tied to their own metric",
        "Low-risk phased entry",
      ],
      gapExposingQuestions: [
        "How long did your current solution take before it showed measurable results?",
        "When you ask for the metric that matters most, how quickly can you get it today?",
        "What does support look like when something breaks mid-quarter?",
      ],
    },
    riskAssessment: risks,
    successPlan: {
      dealProbability,
      salesCycleLength: largeCo ? "3–6 months" : hasFunding ? "4–8 weeks" : "2–6 weeks",
      expectedContractValue: dealSize,
      expansionPotential: largeCo
        ? "High — multi-department"
        : "Medium — scales with headcount",
      renewalProbability: Math.min(90, dealProbability + 25),
      accountHealth: engaged
        ? "Warm — active dialogue, single-threaded"
        : signalCount > 0
          ? "Cold but signaled — right time to open"
          : "Cold — intent unproven",
      topThreeActions: [
        stakeholders.length <= 2
          ? "Multi-thread: map and engage a second stakeholder before proposal stage"
          : "Deepen the second stakeholder relationship before proposal stage",
        topSignal
          ? `Anchor the entire narrative to "${topSignal}" and its internal deadline`
          : "Find the compelling event in first discovery — no deal closes without one",
        "Quantify the cost of the current state with the champion's own numbers in the first two meetings",
      ],
    },
    confidence: {
      level: confidenceLevel,
      verifiedBasis: [
        ...(lead.contactTitle ? [`Contact role: ${lead.contactName}, ${lead.contactTitle}`] : []),
        ...(lead.fundingStage ? [`Funding: ${lead.fundingStage}`] : []),
        ...(signalCount > 0 ? [`Buying signals: ${lead.buyingSignals.join("; ")}`] : []),
        ...(lead.techStack.length > 0 ? [`Known stack: ${lead.techStack.join(", ")}`] : []),
        ...(lead.crm.painPoints.length > 0 ? [`CRM pain points: ${lead.crm.painPoints.join("; ")}`] : []),
      ],
      inferredElements: [
        "Stakeholder communication styles and concerns (inferred from roles)",
        "Objection probabilities (pattern-based, not account-verified)",
        "ROI narrative structure (requires their numbers to become concrete)",
        "Competitive weaknesses (must be validated, never asserted to the prospect)",
      ],
      gaps: gaps.length > 0
        ? gaps
        : ["Budget process unknown", "Full buying committee unmapped", "Incumbent satisfaction unknown"],
    },
  };
}
