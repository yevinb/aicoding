import OpenAI from "openai";
import { RESEARCH_SYSTEM_PROMPT } from "./research-prompt";
import { saveResearch } from "./research-store";
import { getLead, updateLead } from "./store";
import {
  ConfidenceLevel,
  Lead,
  ResearchProfile,
  ResearchSignal,
  TechFinding,
} from "./types";

export async function runResearch(leadId: string): Promise<ResearchProfile> {
  const lead = await getLead(leadId);
  if (!lead) throw new Error("Lead not found");

  const body = process.env.OPENAI_API_KEY
    ? await openaiResearch(lead)
    : demoResearch(lead);

  const profile: ResearchProfile = {
    ...body,
    id: crypto.randomUUID(),
    leadId: lead.id,
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
  };

  await saveResearch(profile);
  await updateLead(lead.id, {
    activity: [
      ...lead.activity,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type: "agent_run",
        summary: `Research Intelligence Agent — profile built (ICP fit ${profile.qualification.icpFit}, confidence ${profile.confidence.level})`,
      },
    ],
  });

  return profile;
}

type ProfileBody = Omit<ResearchProfile, "id" | "leadId" | "timestamp" | "engine">;

async function openaiResearch(lead: Lead): Promise<ProfileBody> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const known = {
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
      knownTechStack: lead.techStack,
    },
    observedBuyingSignals: lead.buyingSignals,
    crmNotes: lead.notes,
    crmRecord: lead.crm,
  };

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: RESEARCH_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Build a full sales intelligence profile for this account. Verified CRM data:\n${JSON.stringify(known, null, 2)}\n\nYou have no live web access in this run — treat the CRM data as your verified source, reason carefully from it, and mark everything you cannot verify as "Unknown". Produce the JSON profile.`,
      },
    ],
  });

  return JSON.parse(
    response.choices[0]?.message?.content ?? "{}"
  ) as ProfileBody;
}

/**
 * Deterministic research profile built strictly from CRM data.
 * Anything not present in the lead record is marked Unknown.
 */
function demoResearch(lead: Lead): ProfileBody {
  const UNKNOWN = "Unknown";
  const hasFunding = /series|seed|\$|funded|equity/i.test(lead.fundingStage);
  const largeCo = /\d{3,}/.test(lead.companySize);
  const seniorContact = /vp|chief|head|director|founder|c[eoft]o/i.test(
    lead.contactTitle
  );
  const signalCount = lead.buyingSignals.length;

  const technology: TechFinding[] = lead.techStack.map((tool) => ({
    category: guessTechCategory(tool),
    tool,
    confidence: "Medium" as ConfidenceLevel,
  }));

  const buyingSignals: ResearchSignal[] = lead.buyingSignals.map((signal) => {
    const strength: ConfidenceLevel = /hir|fund|rais|expan|new .*(vp|chief|head)/i.test(
      signal
    )
      ? "High"
      : "Medium";
    return {
      signal,
      strength,
      whyItMatters: /hir/i.test(signal)
        ? "Hiring indicates budget exists and the team is under pressure to ramp results quickly."
        : /fund|rais|equity/i.test(signal)
          ? "Fresh capital usually comes with aggressive growth targets and new tooling budget."
          : /expan|market|office/i.test(signal)
            ? "Expansion creates new operational problems that existing processes were not built for."
            : "Signals active change — change creates openings for new vendors.",
    };
  });

  const icpFit = Math.min(
    95,
    40 + (hasFunding ? 15 : 0) + (seniorContact ? 15 : 5) + (lead.industry ? 10 : 0) + signalCount * 4
  );
  const buyingIntent = Math.min(95, 20 + signalCount * 15 + (lead.status === "engaged" ? 25 : 0));
  const growthScore = Math.min(95, (hasFunding ? 40 : 15) + signalCount * 12);
  const technologyMatch = technology.length > 0 ? 65 : 30;
  const urgencyScore = Math.min(90, 15 + signalCount * 18);
  const strategicValue = largeCo ? 80 : hasFunding ? 60 : 40;
  const priorityScore = Math.round(
    icpFit * 0.25 + buyingIntent * 0.25 + urgencyScore * 0.2 + strategicValue * 0.15 + growthScore * 0.15
  );
  const expectedDealSize = largeCo
    ? "$80,000–$150,000 ARR"
    : hasFunding
      ? "$30,000–$60,000 ARR"
      : "$10,000–$25,000 ARR";

  const gaps: string[] = [];
  if (!lead.industry) gaps.push("Industry unverified");
  if (!lead.companySize) gaps.push("Employee count unverified");
  if (!lead.fundingStage) gaps.push("Funding history unverified");
  if (lead.techStack.length === 0) gaps.push("No technology stack data");
  if (signalCount === 0) gaps.push("No verified buying signals — intent is unproven");
  if (!lead.contactTitle) gaps.push("Contact role unverified");
  if (lead.crm.decisionMakers.length <= 1)
    gaps.push("Only one stakeholder mapped — buying committee unknown");

  const confidenceLevel: ConfidenceLevel =
    gaps.length === 0 ? "High" : gaps.length <= 2 ? "Medium" : "Low";

  const firstName = lead.contactName.split(" ")[0];

  return {
    company: {
      description: lead.notes
        ? `${lead.company}: ${lead.notes}`
        : lead.industry
          ? `${lead.company} operates in ${lead.industry}. Detailed description unverified.`
          : UNKNOWN,
      industry: lead.industry || UNKNOWN,
      businessModel: lead.industry.toLowerCase().includes("saas")
        ? "Subscription software (inferred from industry)"
        : UNKNOWN,
      headquarters: lead.location || UNKNOWN,
      regionsServed: UNKNOWN,
      employeeCount: lead.companySize || UNKNOWN,
      companySize: largeCo ? "Mid-market / Enterprise" : lead.companySize ? "SMB / Mid-market" : UNKNOWN,
      revenueEstimate: UNKNOWN,
      growthStage: lead.fundingStage || UNKNOWN,
      ownership: /public/i.test(lead.fundingStage)
        ? "Public"
        : /equity|pe/i.test(lead.fundingStage)
          ? "PE-backed"
          : hasFunding
            ? "Private (VC-backed)"
            : UNKNOWN,
    },
    businessHealth: {
      hiringActivity:
        lead.buyingSignals.find((s) => /hir/i.test(s)) ?? UNKNOWN,
      fundingHistory: lead.fundingStage || UNKNOWN,
      recentAcquisitions: UNKNOWN,
      productLaunches:
        lead.buyingSignals.find((s) => /launch|product/i.test(s)) ?? UNKNOWN,
      marketExpansion:
        lead.buyingSignals.find((s) => /expan|market|office|eu|international/i.test(s)) ?? UNKNOWN,
      leadershipChanges:
        lead.buyingSignals.find((s) => /new .*(vp|chief|head|cto|ceo)|leadership/i.test(s)) ?? UNKNOWN,
      partnerships: UNKNOWN,
      awards: UNKNOWN,
      financialSignals: hasFunding
        ? `Capitalized: ${lead.fundingStage}`
        : UNKNOWN,
      growthIndicators:
        signalCount > 0
          ? `${signalCount} active signal${signalCount === 1 ? "" : "s"} observed`
          : UNKNOWN,
    },
    technology,
    buyingSignals,
    painPoints: {
      confirmed: lead.crm.painPoints.filter(
        (p) => !/unknown|likely/i.test(p)
      ),
      likely:
        signalCount > 0
          ? lead.buyingSignals.map((s) =>
              /hir/i.test(s)
                ? "Scaling the team faster than processes can support"
                : /fund|rais/i.test(s)
                  ? "Board pressure to convert new capital into measurable growth"
                  : /expan/i.test(s)
                    ? "Operational complexity from entering new markets"
                    : `Change pressure from: ${s}`
            )
          : ["Unable to infer problems — no verified signals"],
      unknown: [
        "Current tooling satisfaction and contract renewal dates",
        "Internal budget cycle and approval process",
        "Whether a competing initiative already exists internally",
      ],
    },
    opportunities: {
      potentialValue: expectedDealSize,
      useCases:
        signalCount > 0
          ? lead.buyingSignals.map(
              (s) => `Support the initiative behind: ${s.toLowerCase()}`
            )
          : ["To be discovered in first conversation"],
      likelihoodOfInterest:
        buyingIntent >= 60 ? "High" : buyingIntent >= 40 ? "Medium" : "Low",
      salesComplexity: largeCo
        ? "High — multiple stakeholders and procurement likely"
        : "Moderate — small buying committee expected",
      implementationComplexity: technology.length > 2 ? "Moderate — existing stack integrations required" : "Low to moderate",
      estimatedSalesCycle: largeCo ? "3–6 months" : hasFunding ? "4–8 weeks" : "2–6 weeks",
      expansionPotential: largeCo
        ? "High — multiple departments and regions"
        : "Medium — grows with headcount",
      crossSell: ["To be assessed after initial deal"],
      upsell: ["Seat expansion", "Premium tier as usage matures"],
    },
    decisionMakers: [
      {
        name: lead.contactName,
        role: lead.contactTitle || UNKNOWN,
        department: guessDepartment(lead.contactTitle),
        buyingInfluence: seniorContact ? "High" : "Medium",
        decisionAuthority: /chief|founder|c[eoft]o|vp/i.test(lead.contactTitle)
          ? "High"
          : "Medium",
        likelyPriorities: seniorContact
          ? ["Hitting growth targets", "Team efficiency", "Defensible ROI"]
          : ["Day-to-day workflow", "Ease of adoption"],
        relationshipToProject: "Primary contact — likely champion or economic buyer",
      },
      ...lead.crm.decisionMakers
        .filter((dm) => !dm.startsWith(lead.contactName))
        .map((dm) => ({
          name: dm,
          role: UNKNOWN,
          department: UNKNOWN,
          buyingInfluence: "Medium" as ConfidenceLevel,
          decisionAuthority: "Medium" as ConfidenceLevel,
          likelyPriorities: ["Unknown — validate in discovery"],
          relationshipToProject: "Mapped in CRM — role in decision unverified",
        })),
      {
        name: "Unknown — likely Finance approver (CFO / Finance Director)",
        role: "Budget sign-off",
        department: "Finance",
        buyingInfluence: "Medium",
        decisionAuthority: "High",
        likelyPriorities: ["Cost justification", "Contract terms"],
        relationshipToProject: "Expected approver for purchases at this deal size",
      },
    ],
    competitors: lead.crm.competitors.length
      ? lead.crm.competitors.map((c) => ({
          name: c,
          type: /internal/i.test(c) ? ("incumbent" as const) : ("competitor" as const),
          note: /internal/i.test(c)
            ? "Status quo / build-it-internally is the real competition — sell against inaction."
            : "Mentioned in CRM — displacement angle needs validation.",
        }))
      : [
          {
            name: "Status quo (doing nothing)",
            type: "incumbent" as const,
            note: "With no competitors mapped, inertia is the default competitor.",
          },
        ],
    personalization: [
      ...(lead.buyingSignals[0]
        ? [
            `Open with their initiative: "${lead.buyingSignals[0]}" — ask what it changes for ${firstName}'s team specifically.`,
          ]
        : []),
      ...(lead.fundingStage && hasFunding
        ? [
            `Reference the ${lead.fundingStage.split("(")[0].trim()} raise and the growth expectations that come with it.`,
          ]
        : []),
      ...(lead.industry
        ? [
            `Industry angle: share one concrete observation about how similar ${lead.industry} companies handle this problem.`,
          ]
        : []),
      `Hypothesis to test: the trigger behind ${lead.company}'s current activity is capacity, not tooling preference — frame value in output terms.`,
    ],
    qualification: {
      icpFit,
      buyingIntent,
      growthScore,
      technologyMatch,
      urgencyScore,
      strategicValue,
      priorityScore,
      expectedDealSize,
      overallConfidence: confidenceLevel,
      explanations: {
        icpFit: `Based on ${[hasFunding && "funding stage", seniorContact && "contact seniority", lead.industry && "industry match", signalCount > 0 && "active signals"].filter(Boolean).join(", ") || "limited data"}.`,
        buyingIntent: signalCount > 0
          ? `${signalCount} observed signal${signalCount === 1 ? "" : "s"}${lead.status === "engaged" ? " plus active engagement" : ""}.`
          : "No verified signals — intent unproven.",
        growthScore: hasFunding ? "Recent capital plus visible activity." : "No verified funding; growth inferred from signals only.",
        technologyMatch: technology.length > 0 ? `${technology.length} known tools suggest integration feasibility.` : "Stack unknown — match cannot be assessed.",
        urgencyScore: signalCount > 0 ? "Active initiatives imply near-term pressure." : "No time-bound triggers identified.",
        strategicValue: largeCo ? "Company size supports enterprise-tier deal and expansion." : "Value scales with company growth.",
        priorityScore: "Weighted blend: fit 25%, intent 25%, urgency 20%, strategic value 15%, growth 15%.",
      },
    },
    recommendedStrategy: {
      primaryAngle: lead.buyingSignals[0]
        ? `Anchor on "${lead.buyingSignals[0]}" — position as the fastest way to make that initiative succeed.`
        : "Lead with a discovery question about their current priorities; no verified angle exists yet.",
      secondaryAngle: hasFunding
        ? "Post-funding efficiency: convert new capital into results without proportional headcount."
        : "Cost-of-inaction: quantify what the current process costs per month.",
      discoveryQuestions: [
        `What triggered ${lead.buyingSignals[0] ? `"${lead.buyingSignals[0].toLowerCase()}"` : "your current priorities"} — and who owns the outcome?`,
        "How are you handling this today, and where does it break first as you grow?",
        "If this went perfectly, what number changes and by when?",
        "Who else would be involved in evaluating something like this?",
      ],
      firstChannel: lead.email
        ? "Email (address on file; lowest friction)"
        : lead.linkedin
          ? "LinkedIn (no email on file)"
          : "Unknown — acquire contact channel first",
      suggestedCta: buyingIntent >= 60
        ? "Offer a specific 30-minute working session with a concrete agenda."
        : "Ask a single low-commitment question to validate the problem before requesting time.",
      meetingObjective:
        "Validate the problem, quantify impact, and map the buying committee — not to demo.",
      expectedObjections: [
        "\"We already have something for this\" — probe satisfaction and renewal date.",
        "\"Not a priority this quarter\" — tie to their own stated initiative and cost of waiting.",
        "\"Send me some information\" — agree, and attach one specific question to keep the thread alive.",
        ...(largeCo ? ["\"Procurement/security review takes months\" — offer security docs upfront to shorten the path."] : []),
      ],
      followUpCadence: [
        "Day 0: first touch",
        "Day 3: short value-add follow-up (new angle, no pressure)",
        "Day 7: second channel (LinkedIn or phone)",
        "Day 14: final check-in, then move to nurture",
      ],
    },
    confidence: {
      level: confidenceLevel,
      researchGaps: gaps.length > 0 ? gaps : ["No material gaps identified"],
      additionalResearch: [
        ...(lead.techStack.length === 0
          ? ["Identify current stack via job postings and website technology scan"]
          : []),
        ...(lead.crm.decisionMakers.length <= 1
          ? ["Map the full buying committee on LinkedIn (economic buyer, technical evaluator, finance)"]
          : []),
        "Check recent news and press releases for time-sensitive triggers",
        "Review contact's recent LinkedIn activity for personalization material",
      ],
    },
  };
}

function guessTechCategory(tool: string): string {
  const t = tool.toLowerCase();
  if (/salesforce|hubspot|dynamics|pipedrive/.test(t)) return "CRM";
  if (/outreach|apollo|salesloft|lemlist/.test(t)) return "Sales software";
  if (/snowflake|bigquery|looker|tableau|redshift/.test(t)) return "Analytics";
  if (/aws|azure|gcp|google cloud/.test(t)) return "Cloud Platform";
  if (/marketo|pardot|mailchimp|braze/.test(t)) return "Marketing Automation";
  if (/zendesk|intercom|freshdesk/.test(t)) return "Customer Support";
  if (/stripe|adyen|checkout/.test(t)) return "Payment platform";
  if (/sap|oracle|netsuite/.test(t)) return "Enterprise systems";
  return "Other";
}

function guessDepartment(title: string): string {
  const t = title.toLowerCase();
  if (/revenue|revops|sales/.test(t)) return "Revenue / Sales";
  if (/market|growth/.test(t)) return "Marketing / Growth";
  if (/operat|coo/.test(t)) return "Operations";
  if (/tech|engineer|cto|it/.test(t)) return "Technology";
  if (/financ|cfo/.test(t)) return "Finance";
  if (/founder|ceo/.test(t)) return "Executive";
  return "Unknown";
}
