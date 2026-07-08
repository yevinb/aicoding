export type LeadStatus =
  | "new"
  | "researching"
  | "contacted"
  | "engaged"
  | "meeting_booked"
  | "nurturing"
  | "closed_won"
  | "closed_lost";

export type NextActionType =
  | "send_email"
  | "send_linkedin"
  | "call"
  | "follow_up"
  | "wait"
  | "request_info"
  | "escalate"
  | "close_lost"
  | "book_meeting";

export interface ActivityEntry {
  id: string;
  timestamp: string;
  type: "agent_run" | "note" | "status_change" | "objection";
  summary: string;
  detail?: string;
}

export interface CrmRecord {
  leadStatus: LeadStatus;
  nextAction: string;
  followUpDate: string | null;
  conversationSummary: string;
  painPoints: string[];
  goals: string[];
  decisionMakers: string[];
  timeline: string;
  competitors: string[];
  notes: string;
}

export interface Lead {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Prospect
  contactName: string;
  contactTitle: string;
  email: string;
  linkedin: string;

  // Company
  company: string;
  website: string;
  industry: string;
  companySize: string;
  location: string;
  fundingStage: string;
  techStack: string[];
  buyingSignals: string[];
  notes: string;

  // Scores (set by agent)
  fitScore: number | null;
  intentScore: number | null;
  priorityScore: number | null;
  estimatedDealSize: string | null;
  closeProbability: number | null;

  status: LeadStatus;
  crm: CrmRecord;
  activity: ActivityEntry[];
}

export type SpecialistAgent =
  | "Research Agent"
  | "Lead Discovery Agent"
  | "Lead Enrichment Agent"
  | "Qualification Agent"
  | "Outreach Agent"
  | "Reply Analysis Agent"
  | "Objection Handling Agent"
  | "Meeting Scheduling Agent"
  | "CRM Agent"
  | "Analytics Agent";

export interface OpportunityRow {
  leadId: string;
  contactName: string;
  company: string;
  icpFit: number;
  buyingIntent: number;
  urgency: number;
  relationshipStrength: number;
  estimatedDealSize: string;
  closeProbability: number;
  expectedRevenue: number;
  priorityScore: number;
  rationale: string;
}

export interface CompletedAction {
  leadId: string | null;
  agent: SpecialistAgent;
  description: string;
}

export interface OrchestratorReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  executiveSummary: string;
  highestPriorityOpportunities: OpportunityRow[];
  actionsCompleted: CompletedAction[];
  actionsInProgress: string[];
  risks: string[];
  recommendedNextActions: string[];
  crmChanges: string[];
  confidenceAssessment: string;
}

export type ConfidenceLevel = "Low" | "Medium" | "High";

export interface TechFinding {
  category: string;
  tool: string;
  confidence: ConfidenceLevel;
}

export interface ResearchSignal {
  signal: string;
  strength: ConfidenceLevel;
  whyItMatters: string;
}

export interface ResearchDecisionMaker {
  name: string;
  role: string;
  department: string;
  buyingInfluence: ConfidenceLevel;
  decisionAuthority: ConfidenceLevel;
  likelyPriorities: string[];
  relationshipToProject: string;
}

export interface ResearchCompetitor {
  name: string;
  type: "competitor" | "incumbent";
  note: string;
}

export interface ResearchProfile {
  id: string;
  leadId: string;
  timestamp: string;
  engine: "openai" | "demo";
  company: {
    description: string;
    industry: string;
    businessModel: string;
    headquarters: string;
    regionsServed: string;
    employeeCount: string;
    companySize: string;
    revenueEstimate: string;
    growthStage: string;
    ownership: string;
  };
  businessHealth: {
    hiringActivity: string;
    fundingHistory: string;
    recentAcquisitions: string;
    productLaunches: string;
    marketExpansion: string;
    leadershipChanges: string;
    partnerships: string;
    awards: string;
    financialSignals: string;
    growthIndicators: string;
  };
  technology: TechFinding[];
  buyingSignals: ResearchSignal[];
  painPoints: {
    confirmed: string[];
    likely: string[];
    unknown: string[];
  };
  opportunities: {
    potentialValue: string;
    useCases: string[];
    likelihoodOfInterest: string;
    salesComplexity: string;
    implementationComplexity: string;
    estimatedSalesCycle: string;
    expansionPotential: string;
    crossSell: string[];
    upsell: string[];
  };
  decisionMakers: ResearchDecisionMaker[];
  competitors: ResearchCompetitor[];
  personalization: string[];
  qualification: {
    icpFit: number;
    buyingIntent: number;
    growthScore: number;
    technologyMatch: number;
    urgencyScore: number;
    strategicValue: number;
    priorityScore: number;
    expectedDealSize: string;
    overallConfidence: ConfidenceLevel;
    explanations: Record<string, string>;
  };
  recommendedStrategy: {
    primaryAngle: string;
    secondaryAngle: string;
    discoveryQuestions: string[];
    firstChannel: string;
    suggestedCta: string;
    meetingObjective: string;
    expectedObjections: string[];
    followUpCadence: string[];
  };
  confidence: {
    level: ConfidenceLevel;
    researchGaps: string[];
    additionalResearch: string[];
  };
}

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type AccountClassification =
  | "High Priority"
  | "Medium Priority"
  | "Low Priority"
  | "Disqualify";

export interface PlanOpportunity {
  rank: number;
  opportunity: string;
  category: string;
  businessDriver: string;
  expectedImpact: ConfidenceLevel;
}

export interface PlanStakeholder {
  name: string;
  role: string;
  influence: ConfidenceLevel;
  authority: ConfidenceLevel;
  likelyPriorities: string[];
  likelyConcerns: string[];
  communicationStyle: string;
  outcomesTheyCareAbout: string[];
  engagementOrder: number;
  decisionInfluenceScore: number;
}

export interface PlanObjection {
  objection: string;
  probability: ConfidenceLevel;
  severity: ConfidenceLevel;
  rootCause: string;
  recommendedResponse: string;
  evidenceNeeded: string;
}

export interface PlanRisk {
  area: string;
  risk: string;
  level: RiskLevel;
  mitigation: string;
}

export interface AccountPlan {
  id: string;
  leadId: string;
  timestamp: string;
  engine: "openai" | "demo";
  executiveAssessment: {
    company: string;
    currentSituation: string;
    strategicImportance: string;
    revenuePotential: string;
    recommendation: string;
    classification: AccountClassification;
    rationale: string;
  };
  opportunities: PlanOpportunity[];
  stakeholders: PlanStakeholder[];
  salesStrategy: {
    primaryValueProposition: string;
    secondaryValueProposition: string;
    businessCase: string;
    roiNarrative: string;
    competitivePositioning: string;
    riskReductionStrategy: string;
    proofPointsRequired: string[];
    successMetrics: string[];
    implementationStrategy: string;
    expansionOpportunities: string[];
  };
  discoveryPlan: { category: string; questions: string[] }[];
  objectionForecast: PlanObjection[];
  engagementStrategy: {
    firstContact: string;
    secondContact: string;
    thirdContact: string;
    preferredChannel: string;
    meetingObjective: string;
    meetingAgenda: string[];
    contentToShare: string[];
    caseStudyThemes: string[];
    timingRecommendations: string;
    followUpCadence: string[];
    escalationPath: string;
  };
  competitiveStrategy: {
    likelyCompetitors: string[];
    incumbentVendors: string[];
    switchingBarriers: string[];
    competitiveWeaknesses: string[];
    differentiatorsToEmphasize: string[];
    gapExposingQuestions: string[];
  };
  riskAssessment: PlanRisk[];
  successPlan: {
    dealProbability: number;
    salesCycleLength: string;
    expectedContractValue: string;
    expansionPotential: string;
    renewalProbability: number;
    accountHealth: string;
    topThreeActions: string[];
  };
  confidence: {
    level: ConfidenceLevel;
    verifiedBasis: string[];
    inferredElements: string[];
    gaps: string[];
  };
}

export interface OutreachTouch {
  touch: number;
  day: number;
  channel: string;
  objective: string;
  subject: string;
  message: string;
  cta: string;
  successCondition: string;
  fallbackAction: string;
}

export interface QualityScore {
  score: number;
  explanation: string;
}

export interface OutreachPlaybook {
  id: string;
  leadId: string;
  timestamp: string;
  engine: "openai" | "demo";
  decision: {
    outreachNow: boolean;
    reason: string;
    firstStakeholder: string;
    primaryBusinessProblem: string;
    outcomeEmphasized: string;
    supportingEvidence: string;
    lowestFrictionCta: string;
  };
  channelStrategy: {
    primaryChannel: string;
    rationale: string;
    alternates: string[];
  };
  sequence: OutreachTouch[];
  followUpLogic: { scenario: string; nextResponse: string }[];
  objectionResponses: {
    objection: string;
    response: string;
    riskReducer: string;
    advanceWith: string;
  }[];
  meetingPlan: {
    recommended: boolean;
    goal: string;
    agenda: string[];
    discoveryObjectives: string[];
    questionsToAsk: string[];
    expectedOutcome: string;
    successCriteria: string[];
  };
  qualityScores: {
    personalization: QualityScore;
    relevance: QualityScore;
    businessValue: QualityScore;
    clarity: QualityScore;
    trust: QualityScore;
    likelihoodOfReply: QualityScore;
    overallQuality: QualityScore;
  };
  abTests: {
    versionA: { subject: string; message: string };
    versionB: { subject: string; message: string };
    hypothesis: string;
    difference: string;
    whenToUseA: string;
    whenToUseB: string;
    expectedAudience: string;
  };
  confidence: {
    level: ConfidenceLevel;
    basedOn: string[];
    cautions: string[];
  };
}

export interface ScoredExplanation {
  score: number;
  explanation: string;
}

export interface AssessedMetric {
  value: number;
  change: string;
  reason: string;
}

export interface ReplyAnalysis {
  id: string;
  leadId: string;
  timestamp: string;
  engine: "openai" | "demo";
  incomingMessage: string;
  classification: {
    intents: { intent: string; confidence: number }[];
    primaryIntent: string;
  };
  sentiment: {
    overall: string;
    buyerEngagement: ScoredExplanation;
    buyingConfidence: ScoredExplanation;
    urgency: ScoredExplanation;
    emotionalTone: string;
    decisionReadiness: ScoredExplanation;
  };
  opportunityAssessment: {
    dealProbability: AssessedMetric;
    buyingIntent: AssessedMetric;
    priority: AssessedMetric;
    relationshipStrength: AssessedMetric;
    estimatedValue: string;
    salesStage: string;
    expectedCloseDate: string;
    riskLevel: RiskLevel;
  };
  conversationSummary: {
    questionsAsked: string[];
    questionsAnswered: string[];
    openQuestions: string[];
    concernsRaised: string[];
    businessObjectives: string[];
    decisionCriteria: string[];
    stakeholdersMentioned: string[];
    deadlines: string[];
    commitments: string[];
    agreedNextSteps: string[];
  };
  objectionAnalysis: {
    present: boolean;
    surfaceObjection: string;
    realObjection: string;
    hiddenConcern: string;
    rootCause: string;
    evidenceRequired: string;
    responseStrategy: string;
    riskLevel: RiskLevel;
  };
  recommendedAction: {
    action: string;
    reason: string;
  };
  responseDraft: {
    shouldSend: boolean;
    subject: string;
    body: string;
    cta: string;
    notesForHuman: string;
  };
  crmUpdates: Partial<{
    leadStatus: string;
    opportunityStage: string;
    latestSummary: string;
    painPoints: string[];
    goals: string[];
    decisionMakers: string[];
    risks: string[];
    competitors: string[];
    timeline: string;
    followUpDate: string;
    nextAction: string;
  }>;
  learning: {
    whatWeLearned: string[];
    assumptionsConfirmed: string[];
    assumptionsIncorrect: string[];
    accountStrategyChange: string;
    outreachStrategyChange: string;
    qualificationChange: string;
    improvements: string[];
  };
  escalation: {
    required: boolean;
    reasons: string[];
    urgency: "Low" | "Medium" | "High";
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export interface MeetingAttendee {
  name: string;
  role: string;
  department: string;
  influenceLevel: ConfidenceLevel;
  decisionAuthority: ConfidenceLevel;
  likelyPriorities: string[];
  potentialConcerns: string[];
  communicationStyle: string;
  personalSuccessMetrics: string[];
  recommendedApproach: string;
}

export interface MeetingObjectionPrep {
  objection: string;
  probability: ConfidenceLevel;
  whyItMayHappen: string;
  recommendedResponse: string;
  evidenceNeeded: string;
  followUpQuestion: string;
}

export interface MeetingReport {
  id: string;
  leadId: string;
  timestamp: string;
  engine: "openai" | "demo";
  meetingNotes: string | null;
  meetingBrief: {
    companyOverview: string;
    businessSituation: string;
    industryContext: string;
    recentEvents: string[];
    buyingSignals: string[];
    knownPainPoints: string[];
    businessObjectives: string[];
    relationshipStatus: string;
    previousConversations: string;
    knownObjections: string[];
    competitiveSituation: string;
    opportunitySize: string;
    dealProbability: number;
  };
  attendeeAnalysis: MeetingAttendee[];
  meetingObjective: {
    primaryObjective: string;
    secondaryObjectives: string[];
    desiredOutcome: string;
    minimumAcceptableOutcome: string;
    nextStepGoal: string;
    successCriteria: string[];
  };
  meetingStrategy: {
    openingStrategy: string;
    relationshipApproach: string;
    discoveryApproach: string;
    valueDiscussionStrategy: string;
    proofPointsToUse: string[];
    topicsToAvoid: string[];
    potentialRisks: string[];
    recommendedPositioning: string;
  };
  discoveryQuestions: { category: string; questions: string[] }[];
  objectionPreparation: MeetingObjectionPrep[];
  meetingAnalysis: {
    hasNotes: boolean;
    importantStatements: string[];
    painPoints: string[];
    goals: string[];
    requirements: string[];
    stakeholders: string[];
    buyingSignals: string[];
    objections: string[];
    competitorMentions: string[];
    budgetInformation: string;
    timeline: string;
    commitments: string[];
    actionItems: string[];
    summary: {
      whatHappened: string;
      whatWasLearned: string;
      customerPriorities: string[];
      businessImpact: string;
      opportunityChanges: string;
    };
  };
  qualificationUpdate: {
    icpFit: AssessedMetric;
    buyingIntent: AssessedMetric;
    urgency: AssessedMetric;
    dealProbability: AssessedMetric;
    expectedRevenue: string;
    opportunityStage: string;
    confidence: ConfidenceLevel;
  };
  followUpPlan: {
    nextAction: string;
    responsiblePerson: string;
    deadline: string;
    customerCommitment: string;
    internalCommitment: string;
    riskIfDelayed: string;
    followUpEmail: {
      subject: string;
      body: string;
      cta: string;
    };
  };
  crmUpdates: Partial<{
    opportunityStage: string;
    dealNotes: string;
    painPoints: string[];
    goals: string[];
    stakeholders: string[];
    timeline: string;
    nextAction: string;
    followUpDate: string;
    risks: string[];
  }>;
  qualityAnalysis: {
    preparationQuality: ScoredExplanation;
    discoveryDepth: ScoredExplanation;
    customerEngagement: ScoredExplanation;
    valueAlignment: ScoredExplanation;
    qualificationQuality: ScoredExplanation;
    nextStepClarity: ScoredExplanation;
    meetingEffectiveness: ScoredExplanation;
    improvements: string[];
  };
  escalation: {
    required: boolean;
    reasons: string[];
    urgency: "Low" | "Medium" | "High";
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export interface DataQualityIssue {
  leadId: string;
  company: string;
  category: "Completeness" | "Accuracy" | "Freshness";
  issue: string;
  recommendation: string;
  priority: RiskLevel;
}

export interface CrmAuditReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  crmHealth: {
    dataCompleteness: ScoredExplanation;
    dataAccuracy: ScoredExplanation;
    opportunityHygiene: ScoredExplanation;
    pipelineConfidence: ScoredExplanation;
    overall: ScoredExplanation;
  };
  dataQualityIssues: DataQualityIssue[];
  verifiedUpdates: {
    leadId: string;
    company: string;
    field: string;
    from: string;
    to: string;
    evidence: string;
  }[];
  recommendedActions: {
    action: string;
    reason: string;
    priority: RiskLevel;
  }[];
  pipelineRisks: {
    leadId: string;
    company: string;
    risk: string;
    impact: string;
    mitigation: string;
  }[];
  duplicateDetection: {
    leadIds: string[];
    companies: string[];
    matchedOn: string;
    confidence: number;
    recommendation: string;
  }[];
  memoryUpdates: {
    customerMemory: { leadId: string; company: string; facts: string[] }[];
    salesMemory: {
      whatWorked: string[];
      whatFailed: string[];
      objectionsSeen: string[];
      competitiveIntel: string[];
      buyingPatterns: string[];
    };
  };
  agentNotifications: {
    agent: string;
    leadId: string;
    company: string;
    notification: string;
  }[];
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export interface Bottleneck {
  problem: string;
  evidence: string;
  businessImpact: string;
  solution: string;
  priority: RiskLevel;
}

export interface VelocityEntry {
  leadId: string;
  company: string;
  note: string;
}

export interface AnalyticsReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  revenueTarget: number;
  executiveSummary: {
    currentSituation: string;
    revenueOutlook: string;
    biggestOpportunities: string[];
    biggestRisks: string[];
    topActionsNext7Days: string[];
    topActionsNext30Days: string[];
  };
  forecast: {
    currentPipelineValue: number;
    weightedPipelineValue: number;
    expectedRevenue: number;
    bestCase: number;
    worstCase: number;
    revenueGap: number;
    probabilityOfHittingTarget: number;
    forecastConfidence: ConfidenceLevel;
    timeToCloseEstimate: string;
    assumptions: string[];
  };
  pipelineHealth: {
    pipelineCoverage: ScoredExplanation;
    pipelineQuality: ScoredExplanation;
    dealVelocity: ScoredExplanation;
    opportunityHealth: ScoredExplanation;
    forecastReliability: ScoredExplanation;
    activityHealth: ScoredExplanation;
    overall: ScoredExplanation;
    bottlenecks: Bottleneck[];
  };
  funnelAnalysis: {
    stages: {
      stage: string;
      entered: number;
      converted: number;
      conversionRate: number;
    }[];
    strongestStage: string;
    weakestStage: string;
    biggestRevenueLeak: string;
    expectedImprovementImpact: string;
  };
  velocityAnalysis: {
    averageDealAgeDays: number;
    stageTimings: { transition: string; averageDays: string }[];
    fastMoving: VelocityEntry[];
    slowMoving: VelocityEntry[];
    stalled: VelocityEntry[];
    reasonsForDelay: string[];
    recommendedIntervention: string;
  };
  opportunities: {
    leadId: string;
    company: string;
    type: string;
    whyItMatters: string;
    recommendedAction: string;
    estimatedValue: string;
  }[];
  risks: {
    leadId: string;
    company: string;
    risk: string;
    level: RiskLevel;
    mitigation: string;
  }[];
  teamPerformance: {
    activityQuality: string;
    responseTimes: string;
    meetingEffectiveness: string;
    outreachPerformance: string;
    conversionPerformance: string;
    followUpDiscipline: string;
    whatWorks: string[];
    whatFails: string[];
    whatShouldChange: string[];
  };
  recommendations: {
    rank: number;
    action: string;
    expectedImpact: string;
    revenueOpportunity: string;
    effort: "Low" | "Medium" | "High";
    urgency: RiskLevel;
    confidence: ConfidenceLevel;
  }[];
  scenarioModels: {
    scenario: string;
    assumption: string;
    estimatedRevenueImpact: string;
    explanation: string;
  }[];
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
    facts: string[];
    calculations: string[];
    assumptions: string[];
  };
}

export interface ProspectingSegment {
  dimension: string;
  value: string;
  leads: number;
  engaged: number;
  conversionRate: number;
  avgPriority: number | null;
  revenuePotential: string;
  assessment: "Strong" | "Average" | "Weak";
}

export interface ProcessImprovement {
  stage: string;
  finding: string;
  evidence: string;
  recommendation: string;
  type: "Fact" | "Correlation" | "Hypothesis";
}

export interface AgentPerformanceReview {
  score: number;
  metrics: string[];
  strengths: string[];
  improvements: string[];
}

export interface LearningExperiment {
  hypothesis: string;
  change: string;
  targetAudience: string;
  successMetric: string;
  expectedImpact: string;
  duration: string;
  decisionRule: string;
  priority: "Low" | "Medium" | "High";
}

export interface LearningRecommendation {
  rank: number;
  problem: string;
  evidence: string;
  recommendedChange: string;
  expectedImpact: string;
  effort: "Low" | "Medium" | "High";
  confidence: ConfidenceLevel;
  priority: RiskLevel;
  type: "Fact" | "Correlation" | "Hypothesis";
}

export interface LearningReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  performanceAnalysis: {
    prospecting: {
      segments: ProspectingSegment[];
      highestPerforming: string[];
      lowestPerforming: string[];
      targetingChanges: string[];
    };
    optimizationScore: {
      revenueImprovementPotential: ScoredExplanation;
      confidence: ScoredExplanation;
      evidenceStrength: ScoredExplanation;
      implementationDifficulty: ScoredExplanation;
      expectedRoi: ScoredExplanation;
    };
  };
  outreachOptimization: {
    patternsBehindPositiveReplies: string[];
    patternsBehindIgnoredMessages: string[];
    patternsBehindObjections: string[];
    channelInsights: string[];
    timingInsights: string[];
    improvedStrategies: string[];
  };
  messageInsights: {
    wordsThatImproveResponses: string[];
    wordsThatReduceResponses: string[];
    effectiveValuePropositions: string[];
    effectivePainPoints: string[];
    effectiveProofPoints: string[];
    effectiveCtas: string[];
    themesToContinue: string[];
    themesToStop: string[];
  };
  processImprovements: ProcessImprovement[];
  agentPerformance: {
    researchAgent: AgentPerformanceReview;
    planningAgent: AgentPerformanceReview;
    outreachAgent: AgentPerformanceReview;
    replyAgent: AgentPerformanceReview;
    meetingAgent: AgentPerformanceReview;
    analyticsAgent: AgentPerformanceReview;
    crmAgent: AgentPerformanceReview;
  };
  experiments: LearningExperiment[];
  knowledgeUpdates: {
    winningPatterns: {
      industries: string[];
      personas: string[];
      messages: string[];
      objectionsHandled: string[];
      channels: string[];
    };
    losingPatterns: {
      failedApproaches: string[];
      poorFitSegments: string[];
      rejectionReasons: string[];
      failedAssumptions: string[];
    };
    marketIntelligence: {
      competitiveInsights: string[];
      industryTrends: string[];
      customerPatterns: string[];
      buyingBehaviorChanges: string[];
    };
  };
  recommendations: LearningRecommendation[];
  executiveSummary: {
    whatApexLearned: string[];
    whatImproved: string[];
    whatDeclined: string[];
    whatShouldChange: string[];
    whatShouldStop: string[];
    whatShouldBeTestedNext: string[];
    expectedRevenueImpact: string;
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
    facts: string[];
    correlations: string[];
    hypotheses: string[];
  };
}

export interface CroPriorityAction {
  rank: number;
  action: string;
  responsibleAgent: string;
  expectedImpact: string;
  urgency: RiskLevel;
  confidence: ConfidenceLevel;
  effort: "Low" | "Medium" | "High";
  strategicImportance: RiskLevel;
}

export interface CroStrategicDecision {
  decision: string;
  reason: string;
  evidence: string;
  expectedImpact: string;
  risk: string;
  confidence: ConfidenceLevel;
  timeframe: string;
}

export interface CroAgentDirective {
  agent: string;
  assessment: string;
  producingValue: boolean;
  priorityChange: string;
  behaviorChange: string;
  activate: boolean;
}

export interface CroReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  revenueTarget: number;
  executiveSummary: {
    situation: string;
    primaryQuestion: string;
    topPriority: string;
    doNothingRisk: string;
    biggestUpside: string;
    greatestThreat: string;
  };
  revenueStatus: {
    progressToGoal: string;
    forecast: string;
    forecastConfidence: ConfidenceLevel;
    pipelineCoverage: string;
    weightedPipeline: number;
    expectedRevenue: number;
    revenueGap: number;
    probabilityOfHittingTarget: number;
  };
  strategicDiagnosis: {
    revenueGaps: string[];
    pipelineProblems: string[];
    conversionProblems: string[];
    processFailures: string[];
    marketOpportunities: string[];
    agentInefficiencies: string[];
    strategicRisks: string[];
  };
  priorityActions: CroPriorityAction[];
  pipelineDirection: {
    focusAccounts: { leadId: string; company: string; reason: string; action: string }[];
    interventionRequired: { leadId: string; company: string; risk: string; directive: string }[];
    abandonOrNurture: { leadId: string; company: string; reason: string }[];
    coverageAssessment: string;
    qualityAssessment: string;
    velocityAssessment: string;
  };
  agentManagement: {
    agents: CroAgentDirective[];
    orchestratorDirective: string;
  };
  resourceAllocation: {
    moreResearch: string[];
    moreOutreach: string[];
    moreFollowUp: string[];
    moreMeetings: string[];
    reduceEffort: string[];
    rationale: string;
  };
  strategicDecisions: CroStrategicDecision[];
  weeklyOperatingReview: {
    revenueSummary: string;
    wins: string[];
    problems: string[];
    strategicDecisions: string[];
    nextWeekPriorities: {
      action: string;
      expectedOutcome: string;
      responsibleAgent: string;
      priority: RiskLevel;
    }[];
  };
  risks: {
    category: "Deal" | "Forecast" | "Pipeline" | "Customer" | "Competitive" | "Agent" | "Data";
    description: string;
    level: RiskLevel;
    mitigation: string;
    emergency: boolean;
  }[];
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
    evidenceUsed: string[];
    assumptions: string[];
  };
}

export interface OsPlannedTask {
  task: string;
  reason: string;
  expectedOutcome: string;
  agent: string;
  leadId: string;
  company: string;
  priority: RiskLevel;
  confidence: ConfidenceLevel;
  riskLevel: RiskLevel;
  executed?: boolean;
}

export interface OsBuyingSignal {
  signal: string;
  rank: "Critical" | "High" | "Medium" | "Low";
  whyItMatters: string;
  contact: string;
  messageAngle: string;
}

export interface OsDiscoveredOpportunity {
  company: string;
  industry: string;
  fitScore: number;
  leadId: string | null;
  signals: OsBuyingSignal[];
  recommendedAction: string;
  source: "market_discovery" | "pipeline";
}

export interface EmployeeOsReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  operatingLoop: {
    observe: {
      summary: string;
      changesDetected: string[];
      risksIdentified: string[];
      actionsRequired: string[];
    };
    think: {
      highestImpactAction: string;
      reasoning: string;
      alternativesConsidered: string[];
    };
    plan: { tasks: OsPlannedTask[] };
    execute: { summary: string; delegatedAgents: string[] };
  };
  revenueBrief: {
    whatChanged: string[];
    marketSignals: string[];
    pipelineSnapshot: string;
  };
  opportunityDiscovery: OsDiscoveredOpportunity[];
  priorityActions: OsPlannedTask[];
  completedWork: {
    agent: string;
    action: string;
    leadId: string;
    company: string;
    outcome: string;
  }[];
  pipelineImpact: {
    expectedRevenueDelta: string;
    leadsWorked: number;
    artifactsCreated: number;
    explanation: string;
  };
  risks: {
    description: string;
    level: RiskLevel;
    mitigation: string;
  }[];
  learning: {
    whatImproved: string[];
    whatToChange: string[];
    patternsApplied: string[];
  };
  memorySnapshot: {
    accountFacts: { leadId: string; company: string; facts: string[] }[];
    salesPatterns: string[];
  };
  performanceMetrics: {
    qualifiedOpportunities: number;
    actionsExecuted: number;
    activePipeline: number;
    summary: string;
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export type MissionStatus =
  | "created"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "waiting_approval";

export interface Mission {
  id: string;
  name: string;
  objective: string;
  reason: string;
  priority: RiskLevel;
  expectedRevenueImpact: string;
  requiredAgents: string[];
  deadline: string;
  successCriteria: string;
  riskLevel: RiskLevel;
  confidence: ConfidenceLevel;
  leadId: string;
  company: string;
  status: MissionStatus;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  actualOutcome: string | null;
  learningGenerated: string | null;
}

export interface MissionControlReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  revenueSituation: {
    summary: string;
    pipelineValue: string;
    activeAccounts: number;
    urgentItems: string[];
    revenueGap: string | null;
  };
  missionsCreated: Mission[];
  missionsActive: Mission[];
  missionsCompleted: Mission[];
  blockedMissions: Mission[];
  risks: {
    description: string;
    level: RiskLevel;
    mitigation: string;
  }[];
  recommendations: {
    action: string;
    reason: string;
    humanRequired: boolean;
    priority: RiskLevel;
  }[];
  learning: {
    succeeded: string[];
    failed: string[];
    improvements: string[];
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export type ExecutionTaskType =
  | "email"
  | "calendar"
  | "crm"
  | "research"
  | "prospect_discovery"
  | "qualification"
  | "outreach"
  | "follow_up"
  | "planning";

export type ExecutionTaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "needs_approval";

export interface ExecutionTask {
  id: string;
  type: ExecutionTaskType;
  priority: RiskLevel;
  created: string;
  startedAt: string | null;
  completedAt: string | null;
  assignedAgent: string;
  status: ExecutionTaskStatus;
  objective: string;
  expectedOutcome: string;
  result: string | null;
  confidence: ConfidenceLevel;
  leadId: string | null;
  company: string | null;
  source: string;
  riskLevel: RiskLevel;
  approvalRequired: boolean;
  toolsUsed: string[];
  missionId: string | null;
}

export interface ExecutionPendingApproval {
  id: string;
  taskId: string;
  action: string;
  reason: string;
  expectedImpact: string;
  risk: RiskLevel;
  confidence: ConfidenceLevel;
  leadId: string | null;
  company: string | null;
  createdAt: string;
}

export interface ExecutionEngineReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  executionSummary: {
    summary: string;
    tasksReceived: number;
    tasksValidated: number;
    tasksExecuted: number;
    tasksBlocked: number;
    sources: string[];
  };
  tasksCreated: ExecutionTask[];
  tasksCompleted: ExecutionTask[];
  tasksFailed: ExecutionTask[];
  pendingApprovals: ExecutionPendingApproval[];
  automationStatus: {
    health: "Healthy" | "Degraded" | "Critical";
    scheduledJobs: { job: string; cadence: string; lastRun: string; status: string }[];
    agentActivity: { agent: string; tasksCompleted: number; successRate: string }[];
  };
  revenueImpact: {
    leadsAdvanced: number;
    artifactsCreated: number;
    crmUpdatesApplied: number;
    estimatedImpact: string;
    explanation: string;
  };
  learning: {
    succeeded: string[];
    failed: string[];
    patterns: string[];
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export interface ProspectDataPoint {
  value: string;
  source: string;
  confidence: ConfidenceLevel;
  timestamp: string;
}

export interface DiscoveredAccount {
  id: string;
  company: string;
  website: string;
  industry: string;
  employees: string;
  revenueEstimate: string;
  location: string;
  technologies: string[];
  growthIndicators: string[];
  icpScore: number;
  icpExplanation: string;
  whyNow: string;
  potentialObjections: string[];
  priorityScore: number;
  expectedDealSize: string;
  closeProbability: number;
  recommendedNextAction: string;
  duplicateOf: string | null;
  leadId: string | null;
  discoveredAt: string;
  lastRefreshed: string;
}

export interface DiscoveredContact {
  id: string;
  accountId: string;
  company: string;
  name: string;
  role: string;
  department: string;
  seniority: string;
  email: string | null;
  linkedin: string | null;
  decisionInfluence: ConfidenceLevel;
  source: string;
  confidence: ConfidenceLevel;
  timestamp: string;
}

export interface ProspectBuyingSignal {
  id: string;
  accountId: string;
  company: string;
  signal: string;
  source: string;
  date: string;
  strength: ConfidenceLevel;
  businessMeaning: string;
  recommendedAction: string;
}

export interface EnrichedProfile {
  accountId: string;
  company: string;
  overview: string;
  businessModel: string;
  strategicGoals: string[];
  challenges: string[];
  likelyPainPoints: string[];
  decisionMakers: string[];
  technologyEnvironment: string[];
  competitiveContext: string;
  personalizationOpportunities: string[];
  recommendedOutreachAngle: string;
  dataPoints: ProspectDataPoint[];
}

export interface ProspectOpportunity {
  rank: number;
  accountId: string;
  company: string;
  icpScore: number;
  priorityScore: number;
  expectedDealSize: string;
  closeProbability: number;
  buyingIntent: ConfidenceLevel;
  urgency: RiskLevel;
  recommendedNextAction: string;
  whyNow: string;
}

export interface ProspectMission {
  id: string;
  name: string;
  objective: string;
  reason: string;
  priority: RiskLevel;
  expectedOutcome: string;
}

export interface ProspectIntelligenceReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  discoveredAccounts: DiscoveredAccount[];
  newContacts: DiscoveredContact[];
  buyingSignals: ProspectBuyingSignal[];
  enrichedProfiles: EnrichedProfile[];
  topOpportunities: ProspectOpportunity[];
  marketInsights: {
    trends: string[];
    highIntentIndustries: string[];
    signalVolume: string;
    summary: string;
  };
  missionsCreated: ProspectMission[];
  dataQuality: {
    overallScore: number;
    completeness: number;
    accuracy: number;
    freshness: number;
    duplicateCount: number;
    gaps: string[];
    explanation: string;
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export type RevenueSignalCategory =
  | "company_growth"
  | "buying_intent"
  | "contact_change"
  | "sales_activity";

export interface RevenueSignal {
  id: string;
  event: string;
  source: string;
  date: string;
  company: string;
  contact: string | null;
  signalType: RevenueSignalCategory;
  strength: ConfidenceLevel;
  confidence: number;
  urgency: number;
  revenueImpact: number;
  priority: number;
  businessMeaning: string;
  recommendedAction: string;
  leadId: string | null;
}

export interface RevenueOpportunityCandidate {
  id: string;
  company: string;
  contact: string | null;
  reason: string;
  signalEvidence: string[];
  estimatedValue: string;
  recommendedApproach: string;
  priority: RiskLevel;
  leadId: string | null;
}

export interface RevenueSignalAlert {
  id: string;
  level: RiskLevel;
  signalId: string;
  title: string;
  reason: string;
  actionWindow: string;
}

export interface RevenueSignalMissionTrigger {
  id: string;
  name: string;
  reason: string;
  recommendedWorkflow: string;
  priority: RiskLevel;
  leadId: string | null;
  missionId: string | null;
}

export interface RevenueSignalReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  signalsDetected: RevenueSignal[];
  highPriorityAlerts: RevenueSignalAlert[];
  opportunitiesCreated: RevenueOpportunityCandidate[];
  missionsTriggered: RevenueSignalMissionTrigger[];
  marketTrends: {
    summary: string;
    trendingSignals: string[];
    industriesHeatingUp: string[];
    notableChanges: string[];
  };
  signalPerformance: {
    totalSignals: number;
    highPriorityCount: number;
    falsePositiveRate: string;
    avgUrgency: number;
    avgImpact: number;
    byCategory: { category: RevenueSignalCategory; count: number }[];
  };
  learning: {
    strongestSignals: string[];
    weakSignals: string[];
    timingPatterns: string[];
    improvements: string[];
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export type RuntimeJobFrequency =
  | "every_15_min"
  | "hourly"
  | "daily"
  | "weekly"
  | "event";

export type RuntimeWorkerStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked"
  | "waiting_approval";

export interface RuntimeWorkerTask {
  id: string;
  type: string;
  priority: RiskLevel;
  createdAt: string;
  scheduledFor: string;
  status: RuntimeWorkerStatus;
  assignedAgent: string;
  result: string | null;
  error: string | null;
}

export interface SchedulerRuntimeReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  runtimeStatus: {
    mode: "continuous" | "manual";
    summary: string;
    uptimeNote: string;
    queueDepth: number;
    criticalBacklog: number;
  };
  jobsScheduled: {
    id: string;
    name: string;
    frequency: RuntimeJobFrequency;
    nextRun: string;
    priority: RiskLevel;
    enabled: boolean;
  }[];
  jobsExecuted: {
    id: string;
    name: string;
    startedAt: string;
    completedAt: string;
    status: "completed" | "failed" | "skipped";
    result: string;
  }[];
  workerHealth: {
    status: "Healthy" | "Warning" | "Critical";
    activeWorkers: number;
    queued: number;
    failed: number;
    waitingApproval: number;
    retriesScheduled: number;
    notes: string[];
  };
  agentActivity: {
    agent: string;
    tasksRun: number;
    successRate: string;
    lastActivity: string;
  }[];
  failures: {
    taskId: string;
    job: string;
    reason: string;
    retryAt: string | null;
    escalated: boolean;
  }[];
  approvals: {
    taskId: string;
    action: string;
    reason: string;
    expectedImpact: string;
    risk: RiskLevel;
    confidence: ConfidenceLevel;
  }[];
  revenueImpact: {
    opportunitiesActivated: number;
    missionsCreated: number;
    tasksCompleted: number;
    estimatedPipelineInfluence: string;
    summary: string;
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export interface LoopObservation {
  area: string;
  change: string;
  impact: string;
  urgency: RiskLevel;
  source: string;
}

export interface LoopDecision {
  decision: string;
  reason: string;
  expectedImpact: string;
  assignedSystem: string;
  approvalRequired: boolean;
  priority: RiskLevel;
}

export interface LoopAction {
  id: string;
  action: string;
  target: string;
  assignedSystem: string;
  status: "triggered" | "queued" | "running" | "completed" | "blocked";
  priority: RiskLevel;
}

export interface AutonomousLoopReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  loopStatus: {
    phase: "wake" | "observe" | "decide" | "activate" | "execute" | "verify";
    cycleSummary: string;
    systemHealth: "Healthy" | "Warning" | "Critical";
    wakeReason: string;
    nextWake: string;
  };
  observations: LoopObservation[];
  decisions: LoopDecision[];
  actionsTriggered: LoopAction[];
  completedWork: {
    system: string;
    work: string;
    result: string;
  }[];
  blockedWork: {
    system: string;
    work: string;
    reason: string;
  }[];
  approvalsNeeded: {
    action: string;
    reason: string;
    expectedImpact: string;
    risk: RiskLevel;
    confidence: ConfidenceLevel;
  }[];
  learning: {
    successfulPatterns: string[];
    failurePatterns: string[];
    timingInsights: string[];
    improvements: string[];
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export type CommunicationChannel = "email" | "calendar" | "internal_notification";
export type CommunicationStatus =
  | "draft"
  | "scheduled"
  | "sent"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "blocked"
  | "waiting_approval";

export interface CommunicationMessage {
  id: string;
  leadId: string | null;
  company: string;
  contact: string | null;
  channel: CommunicationChannel;
  subject: string;
  body: string;
  cta: string;
  objective: string;
  scheduledFor: string | null;
  status: CommunicationStatus;
  provider: string;
  threadId: string;
  createdAt: string;
  sentAt: string | null;
}

export interface CommunicationReply {
  id: string;
  leadId: string;
  company: string;
  contact: string;
  message: string;
  intent: string;
  sentiment: string;
  opportunityImpact: string;
  nextAction: string;
  detectedAt: string;
}

export interface CommunicationConversation {
  id: string;
  leadId: string | null;
  company: string;
  contact: string | null;
  threadId: string;
  intent: string;
  sentiment: string;
  opportunityImpact: string;
  nextRecommendedAction: string;
  lastActivityAt: string;
  messageCount: number;
}

export interface CommunicationApproval {
  id: string;
  action: string;
  messageId: string;
  reason: string;
  risk: RiskLevel;
  confidence: ConfidenceLevel;
  expectedImpact: string;
}

export interface CommunicationOsReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  communicationsProcessed: {
    source: string;
    count: number;
    summary: string;
  }[];
  messagesCreated: CommunicationMessage[];
  messagesSent: CommunicationMessage[];
  repliesDetected: CommunicationReply[];
  conversationsUpdated: CommunicationConversation[];
  approvalsRequired: CommunicationApproval[];
  analytics: {
    messagesSent: number;
    repliesReceived: number;
    positiveReplies: number;
    meetingsGenerated: number;
    conversionRate: string;
    bestChannels: string[];
    bestTiming: string;
    communicationHealth: "Healthy" | "Warning" | "Critical";
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export type ProviderType = "mock" | "smtp" | "imap" | "google" | "microsoft";
export type ProviderHealthStatus = "connected" | "degraded" | "disconnected";
export type DeliveryStatus = "queued" | "sent" | "failed" | "received";

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  enabled: boolean;
  status: ProviderHealthStatus;
  lastSync: string | null;
  capabilities: string[];
  priority: number;
}

export interface ProviderSendInput {
  recipient: string;
  subject: string;
  content: string;
  threadId: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ProviderSendResult {
  messageId: string;
  provider: string;
  status: DeliveryStatus;
  timestamp: string;
  error?: string;
}

export interface ProviderReceiveResult {
  sender: string;
  recipient: string;
  content: string;
  timestamp: string;
  threadId: string;
  attachments: string[];
}

export interface ProviderSyncResult {
  messages: number;
  threads: number;
  statuses: number;
  replies: number;
  timestamp: string;
}

export interface ProviderStatusResult {
  connected: boolean;
  authenticationStatus: "ok" | "invalid" | "expired" | "missing";
  rateLimits: string;
  errors: string[];
  lastSync: string | null;
}

export interface ProviderAdapterReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  providers: ProviderConfig[];
  messagesSent: ProviderSendResult[];
  messagesReceived: ProviderReceiveResult[];
  syncStatus: {
    summary: string;
    byProvider: {
      providerId: string;
      status: ProviderHealthStatus;
      lastSync: string | null;
      syncedMessages: number;
      syncedReplies: number;
    }[];
  };
  errors: {
    provider: string;
    stage: "send" | "receive" | "sync" | "status";
    error: string;
    retryScheduledAt: string | null;
  }[];
  health: {
    overall: "Healthy" | "Warning" | "Critical";
    connectedProviders: number;
    fallbackUsed: boolean;
    pendingActions: string[];
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export type MemoryEntityType =
  | "company"
  | "person"
  | "conversation"
  | "decision"
  | "action"
  | "outcome"
  | "pattern"
  | "agent";

export interface MemoryItem {
  id: string;
  entityType: MemoryEntityType;
  entityId: string;
  title: string;
  information: string;
  source: string;
  timestamp: string;
  confidence: ConfidenceLevel;
  importance: RiskLevel;
  expiration: string | null;
  permanent: boolean;
}

export interface KnowledgeRelationship {
  id: string;
  fromType: MemoryEntityType;
  fromId: string;
  toType: MemoryEntityType;
  toId: string;
  relation: string;
  source: string;
  confidence: ConfidenceLevel;
  timestamp: string;
}

export interface MemoryRetrievalResult {
  query: string;
  matches: {
    memoryId: string;
    title: string;
    relevance: number;
    reason: string;
  }[];
}

export interface MemoryInsight {
  id: string;
  type: "success_pattern" | "failure_pattern" | "timing_pattern" | "objection_pattern";
  insight: string;
  evidence: string[];
  recommendation: string;
  confidence: ConfidenceLevel;
}

export interface MemoryGraphReport {
  id: string;
  timestamp: string;
  engine: "openai" | "demo";
  memoriesCreated: MemoryItem[];
  memoriesUpdated: MemoryItem[];
  relationshipsCreated: KnowledgeRelationship[];
  insightsGenerated: MemoryInsight[];
  retrievalResults: MemoryRetrievalResult[];
  learning: {
    whatWorked: string[];
    whatFailed: string[];
    updatedStrategies: string[];
    priorityAdjustments: string[];
  };
  confidence: {
    level: ConfidenceLevel;
    explanation: string;
  };
}

export interface AgentOutput {
  leadSummary: string;
  qualification: {
    fitScore: number;
    intentScore: number;
    priorityScore: number;
    estimatedDealSize: string;
    closeProbability: number;
  };
  recommendedNextAction: {
    action: NextActionType;
    label: string;
    reason: string;
  };
  outreachMessage: {
    channel: "email" | "linkedin" | "call_script";
    subject?: string;
    body: string;
  } | null;
  followUpPlan: string[];
  crmUpdate: CrmRecord;
  confidenceLevel: "Low" | "Medium" | "High";
  engine: "openai" | "demo";
}
