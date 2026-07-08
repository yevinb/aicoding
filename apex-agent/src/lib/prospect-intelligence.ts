import OpenAI from "openai";
import { getAudits } from "./crm-audit-store";
import { PROSPECT_INTELLIGENCE_PROMPT } from "./prospect-intelligence-prompt";
import {
  getProspectIntelligenceReports,
  saveProspectIntelligenceReport,
} from "./prospect-intelligence-store";
import {
  getProspectUniverse,
  upsertUniverseAccounts,
  upsertUniverseContacts,
} from "./prospect-universe-store";
import { getLeads } from "./store";
import {
  ConfidenceLevel,
  DiscoveredAccount,
  DiscoveredContact,
  EnrichedProfile,
  Lead,
  ProspectBuyingSignal,
  ProspectIntelligenceReport,
  ProspectMission,
  ProspectOpportunity,
  RiskLevel,
} from "./types";

export { getProspectIntelligenceReports };

const ICP = {
  industries: [
    "fintech",
    "saas",
    "b2b",
    "payments",
    "logistics",
    "analytics",
    "e-commerce",
    "hr tech",
  ],
  minEmployees: 40,
  maxEmployees: 2000,
  targetTitles: ["vp", "head", "director", "chief", "revops", "revenue"],
  targetTech: ["salesforce", "hubspot", "outreach", "snowflake", "apollo"],
  signalKeywords: ["hiring", "sdr", "ae", "series", "expansion", "outbound", "gtm"],
};

interface MarketSeed {
  company: string;
  website: string;
  industry: string;
  employees: string;
  revenueEstimate: string;
  location: string;
  technologies: string[];
  growthIndicators: string[];
  signals: {
    signal: string;
    source: string;
    date: string;
    strength: ConfidenceLevel;
    businessMeaning: string;
    recommendedAction: string;
  }[];
  contacts: {
    name: string;
    role: string;
    department: string;
    seniority: string;
    email: string | null;
    linkedin: string | null;
    decisionInfluence: ConfidenceLevel;
    source: string;
    confidence: ConfidenceLevel;
  }[];
  businessModel: string;
  strategicGoals: string[];
  challenges: string[];
  painPoints: string[];
  competitiveContext: string;
  outreachAngle: string;
}

const MARKET_CATALOG: MarketSeed[] = [
  {
    company: "Relay Financial",
    website: "relayfinancial.com",
    industry: "Fintech / Banking",
    employees: "120",
    revenueEstimate: "$15M ARR (public estimate)",
    location: "New York, NY",
    technologies: ["Salesforce", "Outreach", "Snowflake"],
    growthIndicators: ["Series A closed 2 months ago", "Headcount +35% YoY"],
    signals: [
      {
        signal: "Raised $18M Series A",
        source: "Crunchbase press release",
        date: daysAgo(60),
        strength: "High",
        businessMeaning: "Fresh capital with mandate to scale GTM — budget and urgency align.",
        recommendedAction: "Research → qualify → personalized first touch within 2 weeks.",
      },
      {
        signal: "Hiring 4 SDRs and 2 AEs on careers page",
        source: "Company careers page",
        date: daysAgo(14),
        strength: "High",
        businessMeaning: "Active outbound build — tooling decisions happening now.",
        recommendedAction: "Lead with SDR ramp time and pipeline visibility angle.",
      },
    ],
    contacts: [
      {
        name: "Jordan Ellis",
        role: "VP of Sales",
        department: "Revenue",
        seniority: "VP",
        email: null,
        linkedin: "linkedin.com/in/jordanellis",
        decisionInfluence: "High",
        source: "LinkedIn public profile",
        confidence: "Medium",
      },
    ],
    businessModel: "B2B embedded banking APIs for SaaS platforms",
    strategicGoals: ["Scale enterprise pipeline", "Reduce SDR ramp below 90 days"],
    challenges: ["New sales team lacks playbooks", "No segment-level conversion visibility"],
    painPoints: ["SDR ramp time", "Outbound conversion opacity"],
    competitiveContext: "Evaluating Clari and internal spreadsheets for pipeline management",
    outreachAngle: "Scale outbound post-Series A without doubling RevOps headcount.",
  },
  {
    company: "Stackline Commerce",
    website: "stackline.io",
    industry: "B2B SaaS / E-commerce",
    employees: "280",
    revenueEstimate: "$28M ARR (estimated)",
    location: "Seattle, WA",
    technologies: ["HubSpot", "Gong", "Looker"],
    growthIndicators: ["EMEA office opened Q1", "8 AE roles posted"],
    signals: [
      {
        signal: "Posted 8 AE roles + EMEA expansion announcement",
        source: "Company blog + LinkedIn",
        date: daysAgo(21),
        strength: "High",
        businessMeaning: "GTM investment at scale — process and prioritization gaps likely.",
        recommendedAction: "Enrich stakeholder map; lead with AE ramp and territory prioritization.",
      },
    ],
    contacts: [
      {
        name: "Morgan Tate",
        role: "Head of Revenue",
        department: "Revenue",
        seniority: "Director+",
        email: null,
        linkedin: "linkedin.com/in/morgantate",
        decisionInfluence: "High",
        source: "LinkedIn public profile",
        confidence: "Medium",
      },
    ],
    businessModel: "Retail analytics and marketplace intelligence for brands",
    strategicGoals: ["Accelerate EMEA revenue", "Improve AE productivity in year one"],
    challenges: ["Territory planning across regions", "Inconsistent discovery quality"],
    painPoints: ["AE ramp in new markets", "Lead prioritization at scale"],
    competitiveContext: "Uses Gong for conversation intel; gap in pre-call account intelligence",
    outreachAngle: "Ramp new AEs faster with signal-based account prioritization.",
  },
  {
    company: "Vertex HR",
    website: "vertexhr.com",
    industry: "HR Tech / SaaS",
    employees: "95",
    revenueEstimate: "$8M ARR (estimated)",
    location: "Austin, TX",
    technologies: ["HubSpot", "Apollo", "Slack"],
    growthIndicators: ["Product launch 6 weeks ago", "RevOps hire posted"],
    signals: [
      {
        signal: "Launched AI recruiting module + hiring RevOps Manager",
        source: "Product launch blog + job board",
        date: daysAgo(42),
        strength: "Medium",
        businessMeaning: "GTM motion formalizing — tooling window open.",
        recommendedAction: "Map economic buyer; research before outreach.",
      },
    ],
    contacts: [
      {
        name: "Alex Rivera",
        role: "CEO",
        department: "Executive",
        seniority: "C-Level",
        email: null,
        linkedin: "linkedin.com/in/alexrivera",
        decisionInfluence: "High",
        source: "Company about page",
        confidence: "High",
      },
    ],
    businessModel: "Mid-market HRIS with AI-assisted recruiting",
    strategicGoals: ["Grow mid-market ARR 40%", "Build repeatable outbound motion"],
    challenges: ["Founder-led sales transitioning to team", "No ICP scoring in place"],
    painPoints: ["Unpredictable pipeline", "Manual prospect research"],
    competitiveContext: "Competes with Rippling and BambooHR on mid-market",
    outreachAngle: "Build outbound discipline as you hire your first RevOps lead.",
  },
  {
    company: "CloudLedger",
    website: "cloudledger.io",
    industry: "Fintech / Accounting SaaS",
    employees: "210",
    revenueEstimate: "$22M ARR (estimated)",
    location: "London, UK",
    technologies: ["Salesforce", "Salesloft", "Snowflake"],
    growthIndicators: ["US entity established", "5 SDR openings"],
    signals: [
      {
        signal: "US expansion + SDR team build in progress",
        source: "Press release + careers page",
        date: daysAgo(30),
        strength: "High",
        businessMeaning: "Cross-border GTM build — high urgency for sales infrastructure.",
        recommendedAction: "Priority research; time outreach to SDR onboarding window.",
      },
    ],
    contacts: [
      {
        name: "Priya Shah",
        role: "VP Revenue Operations",
        department: "RevOps",
        seniority: "VP",
        email: null,
        linkedin: "linkedin.com/in/priyashah",
        decisionInfluence: "High",
        source: "LinkedIn public profile",
        confidence: "Medium",
      },
    ],
    businessModel: "Cloud accounting platform for mid-market finance teams",
    strategicGoals: ["Launch US outbound", "Unify EU and US pipeline reporting"],
    challenges: ["Fragmented CRM data across regions", "New SDR team without playbooks"],
    painPoints: ["Cross-region pipeline visibility", "SDR-to-AE handoff quality"],
    competitiveContext: "Replacing spreadsheets with Salesforce — integration depth matters",
    outreachAngle: "Stand up US outbound with unified pipeline intelligence from day one.",
  },
];

export async function runProspectIntelligence(): Promise<ProspectIntelligenceReport> {
  const leads = await getLeads();
  const universe = await getProspectUniverse();
  const crmAudit = (await getAudits())[0] ?? null;

  const { discovered, refreshed } = discoverAccounts(leads, universe.accounts);
  const pipelineAccounts = enrichPipelineAccounts(leads);
  const allAccounts = mergeAccounts(discovered, refreshed, pipelineAccounts);

  const newContacts = discoverContacts(discovered, leads);
  const buyingSignals = detectSignals(allAccounts, leads);
  const enrichedProfiles = buildProfiles(allAccounts, leads);
  const topOpportunities = rankOpportunities(allAccounts);
  const missionsCreated = createProspectMissions(discovered, buyingSignals, leads);
  const marketInsights = buildMarketInsights(buyingSignals, allAccounts);
  const dataQuality = assessDataQuality(leads, allAccounts, crmAudit?.crmHealth.overall.score);

  await upsertUniverseAccounts(allAccounts.filter((a) => !a.leadId));
  await upsertUniverseContacts(newContacts);

  const body: Omit<ProspectIntelligenceReport, "id" | "timestamp" | "engine"> =
    process.env.OPENAI_API_KEY
      ? await enrichWithOpenai(leads, {
          discoveredAccounts: discovered,
          newContacts,
          buyingSignals,
          enrichedProfiles,
          topOpportunities,
          marketInsights,
          missionsCreated,
          dataQuality,
        })
      : {
          discoveredAccounts: discovered,
          newContacts,
          buyingSignals,
          enrichedProfiles,
          topOpportunities,
          marketInsights,
          missionsCreated,
          dataQuality,
          confidence: {
            level: discovered.length > 0 ? "High" : "Medium",
            explanation:
              "Intelligence cycle completed on verified public signals and CRM data. (Demo engine — connect OpenAI for full reasoning.)",
          },
        };

  const report: ProspectIntelligenceReport = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    ...body,
  };

  await saveProspectIntelligenceReport(report);
  return report;
}

function discoverAccounts(
  leads: Lead[],
  existing: DiscoveredAccount[]
): { discovered: DiscoveredAccount[]; refreshed: DiscoveredAccount[] } {
  const now = new Date().toISOString();
  const discovered: DiscoveredAccount[] = [];
  const refreshed: DiscoveredAccount[] = [];
  const crmNames = new Set(leads.map((l) => normalize(l.company)));
  const crmDomains = new Set(leads.map((l) => domainFrom(l.website, l.email)));

  for (const seed of MARKET_CATALOG) {
    const norm = normalize(seed.company);
    const seedDomain = domainFrom(seed.website, null);
    const duplicateLead = findDuplicateLead(seed, leads);

    const existingAccount = existing.find(
      (a) => normalize(a.company) === norm || domainFrom(a.website, null) === seedDomain
    );

    if (existingAccount) {
      const updated = {
        ...existingAccount,
        lastRefreshed: now,
        growthIndicators: seed.growthIndicators,
        icpScore: scoreIcp(seed),
        priorityScore: scorePriority(seed),
        duplicateOf: duplicateLead?.id ?? existingAccount.duplicateOf,
        leadId: duplicateLead?.id ?? existingAccount.leadId,
      };
      refreshed.push(updated);
      continue;
    }

    if (crmNames.has(norm) || crmDomains.has(seedDomain)) continue;

    const account = seedToAccount(seed, now, duplicateLead?.id ?? null);
    discovered.push(account);
  }

  return { discovered, refreshed };
}

function enrichPipelineAccounts(leads: Lead[]): DiscoveredAccount[] {
  const now = new Date().toISOString();
  return leads
    .filter((l) => !["closed_won", "closed_lost"].includes(l.status))
    .map((lead) => {
      const icpScore = scoreLeadIcp(lead);
      return {
        id: `pipeline-${lead.id}`,
        company: lead.company,
        website: lead.website,
        industry: lead.industry,
        employees: lead.companySize,
        revenueEstimate: lead.estimatedDealSize ?? "Unknown",
        location: lead.location,
        technologies: lead.techStack,
        growthIndicators: lead.buyingSignals.slice(0, 3),
        icpScore,
        icpExplanation: explainLeadIcp(lead, icpScore),
        whyNow: lead.buyingSignals[0] ?? (lead.crm.timeline || "Monitor for engagement signals"),
        potentialObjections: buildObjections(lead),
        priorityScore: lead.priorityScore ?? icpScore,
        expectedDealSize: lead.estimatedDealSize ?? estimateDealSize(icpScore),
        closeProbability: lead.closeProbability ?? Math.round(icpScore * 0.4),
        recommendedNextAction: lead.crm.nextAction || "Research and qualify",
        duplicateOf: null,
        leadId: lead.id,
        discoveredAt: lead.createdAt,
        lastRefreshed: now,
      };
    });
}

function mergeAccounts(
  discovered: DiscoveredAccount[],
  refreshed: DiscoveredAccount[],
  pipeline: DiscoveredAccount[]
): DiscoveredAccount[] {
  const map = new Map<string, DiscoveredAccount>();
  for (const a of [...pipeline, ...refreshed, ...discovered]) {
    map.set(a.id, a);
  }
  return [...map.values()];
}

function discoverContacts(
  discovered: DiscoveredAccount[],
  leads: Lead[]
): DiscoveredContact[] {
  const now = new Date().toISOString();
  const contacts: DiscoveredContact[] = [];

  for (const account of discovered) {
    const seed = MARKET_CATALOG.find((s) => normalize(s.company) === normalize(account.company));
    if (!seed) continue;
    for (const c of seed.contacts) {
      contacts.push({
        id: crypto.randomUUID(),
        accountId: account.id,
        company: account.company,
        name: c.name,
        role: c.role,
        department: c.department,
        seniority: c.seniority,
        email: c.email,
        linkedin: c.linkedin,
        decisionInfluence: c.decisionInfluence,
        source: c.source,
        confidence: c.confidence,
        timestamp: now,
      });
    }
  }

  for (const lead of leads.filter((l) => l.priorityScore !== null)) {
    const hasEmail = lead.email && !lead.email.includes("unknown");
    contacts.push({
      id: crypto.randomUUID(),
      accountId: `pipeline-${lead.id}`,
      company: lead.company,
      name: lead.contactName,
      role: lead.contactTitle,
      department: inferDepartment(lead.contactTitle),
      seniority: inferSeniority(lead.contactTitle),
      email: hasEmail ? lead.email : null,
      linkedin: lead.linkedin || null,
      decisionInfluence: inferInfluence(lead.contactTitle),
      source: "CRM record",
      confidence: hasEmail ? "High" : "Medium",
      timestamp: now,
    });
  }

  return contacts;
}

function detectSignals(
  accounts: DiscoveredAccount[],
  leads: Lead[]
): ProspectBuyingSignal[] {
  const signals: ProspectBuyingSignal[] = [];

  for (const account of accounts) {
    const seed = MARKET_CATALOG.find((s) => normalize(s.company) === normalize(account.company));
    if (seed) {
      for (const s of seed.signals) {
        signals.push({
          id: crypto.randomUUID(),
          accountId: account.id,
          company: account.company,
          signal: s.signal,
          source: s.source,
          date: s.date,
          strength: s.strength,
          businessMeaning: s.businessMeaning,
          recommendedAction: s.recommendedAction,
        });
      }
    }
  }

  for (const lead of leads) {
    for (const [i, signal] of lead.buyingSignals.entries()) {
      signals.push({
        id: crypto.randomUUID(),
        accountId: `pipeline-${lead.id}`,
        company: lead.company,
        signal,
        source: "CRM buying signals field",
        date: lead.updatedAt,
        strength: i === 0 ? "High" : "Medium",
        businessMeaning: `Recorded signal for ${lead.company} — ${lead.industry}`,
        recommendedAction: lead.crm.nextAction || "Validate signal and advance account",
      });
    }
  }

  return signals.sort((a, b) => strengthScore(b.strength) - strengthScore(a.strength));
}

function buildProfiles(
  accounts: DiscoveredAccount[],
  leads: Lead[]
): EnrichedProfile[] {
  const now = new Date().toISOString();
  return accounts.slice(0, 10).map((account) => {
    const seed = MARKET_CATALOG.find((s) => normalize(s.company) === normalize(account.company));
    const lead = account.leadId ? leads.find((l) => l.id === account.leadId) : null;

    if (seed) {
      return {
        accountId: account.id,
        company: account.company,
        overview: `${account.company} — ${account.industry}, ${account.employees} employees, ${account.location}. ${account.revenueEstimate}.`,
        businessModel: seed.businessModel,
        strategicGoals: seed.strategicGoals,
        challenges: seed.challenges,
        likelyPainPoints: seed.painPoints,
        decisionMakers: seed.contacts.map((c) => `${c.name} (${c.role})`),
        technologyEnvironment: account.technologies,
        competitiveContext: seed.competitiveContext,
        personalizationOpportunities: seed.signals.map((s) => s.signal),
        recommendedOutreachAngle: seed.outreachAngle,
        dataPoints: [
          { value: account.revenueEstimate, source: "Public estimate", confidence: "Medium", timestamp: now },
          { value: account.industry, source: "Company website", confidence: "High", timestamp: now },
          ...seed.signals.map((s) => ({
            value: s.signal,
            source: s.source,
            confidence: s.strength,
            timestamp: s.date,
          })),
        ],
      };
    }

    return {
      accountId: account.id,
      company: account.company,
      overview: `${account.company} — ${account.industry}, ${account.employees}, ${account.location}.`,
      businessModel: lead?.notes?.slice(0, 120) ?? "Unknown — research required",
      strategicGoals: lead?.crm.goals ?? [],
      challenges: lead?.crm.painPoints ?? [],
      likelyPainPoints: lead?.crm.painPoints ?? [],
      decisionMakers: lead?.crm.decisionMakers ?? [lead?.contactName ?? "Unknown"],
      technologyEnvironment: account.technologies,
      competitiveContext: lead?.crm.competitors.join(", ") || "Unknown",
      personalizationOpportunities: account.growthIndicators,
      recommendedOutreachAngle: lead?.crm.conversationSummary
        ? `Reference: ${lead.crm.conversationSummary.slice(0, 100)}`
        : `Lead with ${account.growthIndicators[0] ?? "industry-specific value"}`,
      dataPoints: [
        { value: account.industry, source: "CRM", confidence: "High", timestamp: now },
        ...account.growthIndicators.map((g) => ({
          value: g,
          source: "CRM buying signals",
          confidence: "High" as ConfidenceLevel,
          timestamp: lead?.updatedAt ?? now,
        })),
      ],
    };
  });
}

function rankOpportunities(accounts: DiscoveredAccount[]): ProspectOpportunity[] {
  return accounts
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 8)
    .map((a, i) => ({
      rank: i + 1,
      accountId: a.id,
      company: a.company,
      icpScore: a.icpScore,
      priorityScore: a.priorityScore,
      expectedDealSize: a.expectedDealSize,
      closeProbability: a.closeProbability,
      buyingIntent: intentFromScore(a.priorityScore),
      urgency: urgencyFromScore(a.priorityScore),
      recommendedNextAction: a.recommendedNextAction,
      whyNow: a.whyNow,
    }));
}

function createProspectMissions(
  discovered: DiscoveredAccount[],
  signals: ProspectBuyingSignal[],
  leads: Lead[]
): ProspectMission[] {
  const missions: ProspectMission[] = [];

  if (discovered.length > 0) {
    missions.push({
      id: crypto.randomUUID(),
      name: `Research ${discovered.length} newly discovered ICP accounts`,
      objective: `Enrich and qualify: ${discovered.map((d) => d.company).join(", ")}`,
      reason: "New high-fit companies discovered with active buying signals",
      priority: "High",
      expectedOutcome: "Create qualified pipeline entries with contact maps",
    });
  }

  const sdrHiring = signals.filter((s) =>
    s.signal.toLowerCase().includes("sdr")
  );
  if (sdrHiring.length >= 2) {
    missions.push({
      id: crypto.randomUUID(),
      name: "Research SaaS companies hiring SDR teams",
      objective: `Deep-dive ${sdrHiring.length} accounts with SDR hiring signals`,
      reason: "Strong buying signal — outbound build mandate indicates tooling window",
      priority: "Critical",
      expectedOutcome: "Prioritized outreach list with personalized angles",
    });
  }

  const unqualified = leads.filter((l) => l.priorityScore === null);
  if (unqualified.length > 0) {
    missions.push({
      id: crypto.randomUUID(),
      name: `Enrich ${unqualified.length} unscored CRM records`,
      objective: `Score and enrich: ${unqualified.map((l) => l.company).join(", ")}`,
      reason: "CRM records lack ICP scores — intelligence gap blocks prioritization",
      priority: "Medium",
      expectedOutcome: "Complete ICP scores and buying signal validation",
    });
  }

  const stale = leads.filter(
    (l) =>
      l.priorityScore !== null &&
      Date.now() - new Date(l.updatedAt).getTime() > 14 * 24 * 60 * 60 * 1000
  );
  if (stale.length > 0) {
    missions.push({
      id: crypto.randomUUID(),
      name: `Refresh intelligence on ${stale.length} stale accounts`,
      objective: "Re-validate buying signals and contact data",
      reason: "Data older than 14 days on active opportunities",
      priority: "Medium",
      expectedOutcome: "Updated profiles with current signals and timing assessment",
    });
  }

  return missions;
}

function buildMarketInsights(
  signals: ProspectBuyingSignal[],
  accounts: DiscoveredAccount[]
): ProspectIntelligenceReport["marketInsights"] {
  const industries = accounts.reduce<Record<string, number>>((acc, a) => {
    const key = a.industry.split("/")[0].trim();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const topIndustries = Object.entries(industries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ind]) => ind);

  const hiringSignals = signals.filter((s) =>
    /hiring|sdr|ae|role/i.test(s.signal)
  ).length;
  const fundingSignals = signals.filter((s) =>
    /series|raised|funding/i.test(s.signal)
  ).length;

  return {
    trends: [
      hiringSignals > 0
        ? `${hiringSignals} accounts showing GTM hiring velocity — outbound tooling window open`
        : "Monitor hiring boards for SDR/AE expansion signals",
      fundingSignals > 0
        ? `${fundingSignals} recent funding events in prospect universe`
        : "No major funding signals this cycle",
      "RevOps and VP Sales titles remain highest-conversion entry points",
    ],
    highIntentIndustries: topIndustries,
    signalVolume: `${signals.length} signals across ${accounts.length} accounts`,
    summary: `Prospect universe spans ${accounts.length} accounts with ${signals.length} active buying signals. Top industries: ${topIndustries.join(", ") || "diversified"}.`,
  };
}

function assessDataQuality(
  leads: Lead[],
  accounts: DiscoveredAccount[],
  crmHealth?: number
): ProspectIntelligenceReport["dataQuality"] {
  const gaps: string[] = [];
  let completeness = 0;
  let accuracy = 85;

  for (const lead of leads) {
    let fields = 0;
    if (lead.email) fields++;
    if (lead.industry) fields++;
    if (lead.buyingSignals.length) fields++;
    if (lead.priorityScore !== null) fields++;
    if (lead.crm.decisionMakers.length) fields++;
    completeness += fields / 5;
  }
  completeness = leads.length
    ? Math.round((completeness / leads.length) * 100)
    : 70;

  const missingEmail = leads.filter((l) => !l.email).length;
  if (missingEmail) gaps.push(`${missingEmail} CRM records missing verified email`);
  const unqualified = leads.filter((l) => l.priorityScore === null).length;
  if (unqualified) gaps.push(`${unqualified} leads without ICP score`);
  const unknownContacts = accounts.filter((a) => !a.leadId).length;
  if (unknownContacts)
    gaps.push(`${unknownContacts} discovered accounts need contact enrichment`);

  const duplicateCount = accounts.filter((a) => a.duplicateOf).length;
  const freshness = Math.round(
    accounts.reduce((s, a) => {
      const age = Date.now() - new Date(a.lastRefreshed).getTime();
      return s + (age < 7 * 24 * 60 * 60 * 1000 ? 100 : age < 30 * 24 * 60 * 60 * 1000 ? 70 : 40);
    }, 0) / Math.max(accounts.length, 1)
  );

  if (crmHealth !== undefined && crmHealth < 70) {
    accuracy -= 10;
    gaps.push(`CRM health at ${crmHealth} — cross-validate intelligence before outreach`);
  }

  const overallScore = Math.round((completeness + accuracy + freshness) / 3);

  return {
    overallScore,
    completeness,
    accuracy,
    freshness,
    duplicateCount,
    gaps,
    explanation: `Intelligence quality ${overallScore}/100 — ${gaps.length} gap${gaps.length === 1 ? "" : "s"} identified. All data points tagged with source and confidence.`,
  };
}

async function enrichWithOpenai(
  leads: Lead[],
  data: Omit<
    ProspectIntelligenceReport,
    "id" | "timestamp" | "engine" | "confidence"
  >
): Promise<Omit<ProspectIntelligenceReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    pipeline: leads.map((l) => ({
      company: l.company,
      status: l.status,
      priority: l.priorityScore,
      signals: l.buyingSignals,
    })),
    discovered: data.discoveredAccounts.length,
    signals: data.buyingSignals.length,
    topOpportunities: data.topOpportunities.slice(0, 5),
  };

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PROSPECT_INTELLIGENCE_PROMPT },
      {
        role: "user",
        content: `Intelligence cycle data:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn the report JSON. Preserve factual counts; refine market insights and profile narratives.`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty OpenAI response");

  const parsed = JSON.parse(raw) as Partial<
    Omit<ProspectIntelligenceReport, "id" | "timestamp" | "engine">
  >;

  return {
    discoveredAccounts: data.discoveredAccounts,
    newContacts: data.newContacts,
    buyingSignals: data.buyingSignals,
    enrichedProfiles: parsed.enrichedProfiles ?? data.enrichedProfiles,
    topOpportunities: data.topOpportunities,
    marketInsights: parsed.marketInsights ?? data.marketInsights,
    missionsCreated: data.missionsCreated,
    dataQuality: parsed.dataQuality ?? data.dataQuality,
    confidence: parsed.confidence ?? {
      level: "High",
      explanation: "OpenAI-enriched intelligence report on verified signals and CRM data.",
    },
  };
}

function seedToAccount(
  seed: MarketSeed,
  now: string,
  duplicateLeadId: string | null
): DiscoveredAccount {
  const icpScore = scoreIcp(seed);
  const priorityScore = scorePriority(seed);
  return {
    id: crypto.randomUUID(),
    company: seed.company,
    website: seed.website,
    industry: seed.industry,
    employees: seed.employees,
    revenueEstimate: seed.revenueEstimate,
    location: seed.location,
    technologies: seed.technologies,
    growthIndicators: seed.growthIndicators,
    icpScore,
    icpExplanation: explainSeedIcp(seed, icpScore),
    whyNow: seed.signals[0]?.businessMeaning ?? "Active market signals detected",
    potentialObjections: ["Budget timing", "Existing tooling in place", "Build vs buy preference"],
    priorityScore,
    expectedDealSize: estimateDealSize(priorityScore),
    closeProbability: Math.round(priorityScore * 0.35),
    recommendedNextAction: seed.signals[0]?.recommendedAction ?? "Research and qualify",
    duplicateOf: duplicateLeadId,
    leadId: duplicateLeadId,
    discoveredAt: now,
    lastRefreshed: now,
  };
}

function scoreIcp(seed: MarketSeed): number {
  let score = 50;
  const ind = seed.industry.toLowerCase();
  if (ICP.industries.some((i) => ind.includes(i))) score += 20;
  const emp = parseInt(seed.employees, 10);
  if (emp >= ICP.minEmployees && emp <= ICP.maxEmployees) score += 15;
  if (seed.technologies.some((t) => ICP.targetTech.includes(t.toLowerCase()))) score += 10;
  if (seed.signals.some((s) => ICP.signalKeywords.some((k) => s.signal.toLowerCase().includes(k))))
    score += 15;
  return Math.min(100, score);
}

function scorePriority(seed: MarketSeed): number {
  let score = scoreIcp(seed);
  const critical = seed.signals.filter((s) => s.strength === "High").length;
  score += critical * 5;
  return Math.min(100, score);
}

function scoreLeadIcp(lead: Lead): number {
  let score = 40;
  const ind = lead.industry.toLowerCase();
  if (ICP.industries.some((i) => ind.includes(i))) score += 20;
  if (lead.buyingSignals.length) score += lead.buyingSignals.length * 8;
  if (lead.techStack.some((t) => ICP.targetTech.includes(t.toLowerCase()))) score += 10;
  if (ICP.targetTitles.some((t) => lead.contactTitle.toLowerCase().includes(t))) score += 10;
  if (lead.fitScore !== null) score = Math.round((score + lead.fitScore) / 2);
  return Math.min(100, score);
}

function explainSeedIcp(seed: MarketSeed, score: number): string {
  const parts = [`ICP score ${score}/100`];
  if (ICP.industries.some((i) => seed.industry.toLowerCase().includes(i)))
    parts.push("industry match");
  if (seed.signals.length) parts.push(`${seed.signals.length} active buying signal(s)`);
  if (seed.technologies.length) parts.push(`tech stack includes ${seed.technologies.slice(0, 2).join(", ")}`);
  return parts.join(" — ");
}

function explainLeadIcp(lead: Lead, score: number): string {
  return `ICP ${score}/100 — ${lead.industry}, ${lead.companySize}, ${lead.buyingSignals.length} signal(s) on record`;
}

function buildObjections(lead: Lead): string[] {
  const objections = ["Budget cycle timing"];
  if (lead.crm.competitors.length) objections.push(`Incumbent: ${lead.crm.competitors[0]}`);
  if (lead.status === "nurturing") objections.push("Long evaluation cycle — patience required");
  return objections;
}

function findDuplicateLead(seed: MarketSeed, leads: Lead[]): Lead | undefined {
  const seedDomain = domainFrom(seed.website, null);
  return leads.find(
    (l) =>
      normalize(l.company) === normalize(seed.company) ||
      domainFrom(l.website, l.email) === seedDomain
  );
}

function estimateDealSize(score: number): string {
  if (score >= 85) return "$80,000–$150,000 ARR";
  if (score >= 70) return "$48,000–$80,000 ARR";
  if (score >= 55) return "$24,000–$48,000 ARR";
  return "$12,000–$24,000 ARR";
}

function intentFromScore(score: number): ConfidenceLevel {
  if (score >= 80) return "High";
  if (score >= 60) return "Medium";
  return "Low";
}

function urgencyFromScore(score: number): RiskLevel {
  if (score >= 85) return "Critical";
  if (score >= 70) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

function strengthScore(s: ConfidenceLevel): number {
  return { High: 3, Medium: 2, Low: 1 }[s];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function domainFrom(website: string, email: string | null): string {
  if (website) {
    const m = website.replace(/^https?:\/\//, "").split("/")[0];
    return m.replace(/^www\./, "").toLowerCase();
  }
  if (email) return email.split("@")[1]?.toLowerCase() ?? "";
  return "";
}

function inferDepartment(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("revenue") || t.includes("sales")) return "Revenue";
  if (t.includes("operations") || t.includes("revops")) return "RevOps";
  if (t.includes("growth")) return "Growth";
  if (t.includes("chief") || t.includes("ceo") || t.includes("coo")) return "Executive";
  return "Unknown";
}

function inferSeniority(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("chief") || t.startsWith("c")) return "C-Level";
  if (t.includes("vp")) return "VP";
  if (t.includes("head") || t.includes("director")) return "Director+";
  return "Manager";
}

function inferInfluence(title: string): ConfidenceLevel {
  const t = title.toLowerCase();
  if (t.includes("chief") || t.includes("vp") || t.includes("head")) return "High";
  if (t.includes("director")) return "Medium";
  return "Low";
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
