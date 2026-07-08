import OpenAI from "openai";
import { getCommunicationMessages, getConversations } from "./communication-os-store";
import { getExecutionTasks } from "./execution-task-store";
import { getLearningReports } from "./learning-store";
import { MEMORY_GRAPH_PROMPT } from "./memory-graph-prompt";
import {
  getKnowledgeRelationships,
  getMemories,
  getMemoryGraphReports,
  saveKnowledgeRelationships,
  saveMemories,
  saveMemoryGraphReport,
} from "./memory-graph-store";
import { getMeetingReports } from "./meeting-store";
import { getMissions } from "./mission-store";
import { getReplyAnalyses } from "./reply-store";
import { getLeads } from "./store";
import {
  KnowledgeRelationship,
  Lead,
  MemoryGraphReport,
  MemoryInsight,
  MemoryItem,
  MemoryRetrievalResult,
} from "./types";

export { getMemoryGraphReports };

export async function runMemoryGraphEngine(): Promise<MemoryGraphReport> {
  const [
    leads,
    existingMemories,
    existingRelationships,
    communicationMessages,
    conversations,
    executionTasks,
    missions,
    learningReports,
  ] = await Promise.all([
    getLeads(),
    getMemories(),
    getKnowledgeRelationships(),
    getCommunicationMessages(),
    getConversations(),
    getExecutionTasks(),
    getMissions(),
    getLearningReports(),
  ]);

  const memoriesCreated: MemoryItem[] = [];
  const memoriesUpdated: MemoryItem[] = [];
  const relationshipsCreated: KnowledgeRelationship[] = [];
  const insightsGenerated: MemoryInsight[] = [];

  const now = new Date().toISOString();
  const updatedMemories = [...existingMemories];
  const updatedRels = [...existingRelationships];

  for (const lead of leads) {
    upsertMemory(
      updatedMemories,
      memoriesCreated,
      memoriesUpdated,
      {
        id: `company-${lead.id}`,
        entityType: "company",
        entityId: lead.id,
        title: `${lead.company} company memory`,
        information: `${lead.industry}, ${lead.companySize}, ${lead.location}. Goals: ${lead.crm.goals.join("; ") || "unknown"}. Challenges: ${lead.crm.painPoints.join("; ") || "unknown"}.`,
        source: "CRM",
        timestamp: lead.updatedAt,
        confidence: "High",
        importance: lead.priorityScore && lead.priorityScore >= 75 ? "High" : "Medium",
        expiration: null,
        permanent: true,
      }
    );

    upsertMemory(
      updatedMemories,
      memoriesCreated,
      memoriesUpdated,
      {
        id: `person-${lead.id}`,
        entityType: "person",
        entityId: lead.id,
        title: `${lead.contactName} contact memory`,
        information: `${lead.contactTitle}. Decision makers: ${lead.crm.decisionMakers.join("; ") || "unknown"}. Communication notes: ${lead.crm.notes || "none"}.`,
        source: "CRM",
        timestamp: lead.updatedAt,
        confidence: "High",
        importance: "Medium",
        expiration: null,
        permanent: true,
      }
    );

    upsertRelationship(updatedRels, relationshipsCreated, {
      id: `rel-company-person-${lead.id}`,
      fromType: "company",
      fromId: lead.id,
      toType: "person",
      toId: lead.id,
      relation: "has_contact",
      source: "CRM",
      confidence: "High",
      timestamp: now,
    });
  }

  for (const conv of conversations.slice(0, 300)) {
    upsertMemory(updatedMemories, memoriesCreated, memoriesUpdated, {
      id: `conversation-${conv.id}`,
      entityType: "conversation",
      entityId: conv.id,
      title: `${conv.company} conversation memory`,
      information: `Intent: ${conv.intent}. Sentiment: ${conv.sentiment}. Next action: ${conv.nextRecommendedAction}.`,
      source: "Communication OS",
      timestamp: conv.lastActivityAt,
      confidence: "Medium",
      importance: "Medium",
      expiration: plusDays(90),
      permanent: false,
    });
  }

  for (const task of executionTasks.slice(0, 300)) {
    upsertMemory(updatedMemories, memoriesCreated, memoriesUpdated, {
      id: `action-${task.id}`,
      entityType: "action",
      entityId: task.id,
      title: `Execution action ${task.type}`,
      information: `${task.objective}. Result: ${task.result ?? "pending"}. Status: ${task.status}.`,
      source: "Execution Engine",
      timestamp: task.completedAt ?? task.created,
      confidence: task.status === "completed" ? "High" : "Medium",
      importance: task.priority,
      expiration: plusDays(120),
      permanent: task.status === "completed",
    });
    if (task.leadId) {
      upsertRelationship(updatedRels, relationshipsCreated, {
        id: `rel-company-action-${task.leadId}-${task.id}`,
        fromType: "company",
        fromId: task.leadId,
        toType: "action",
        toId: task.id,
        relation: "executed_action",
        source: "Execution Engine",
        confidence: "High",
        timestamp: now,
      });
    }
  }

  for (const mission of missions.slice(0, 200)) {
    upsertMemory(updatedMemories, memoriesCreated, memoriesUpdated, {
      id: `decision-${mission.id}`,
      entityType: "decision",
      entityId: mission.id,
      title: `Mission decision ${mission.name}`,
      information: `${mission.reason}. Status: ${mission.status}. Outcome: ${mission.actualOutcome ?? "pending"}.`,
      source: "Mission Control",
      timestamp: mission.updatedAt,
      confidence: mission.status === "completed" ? "High" : "Medium",
      importance: mission.priority,
      expiration: null,
      permanent: true,
    });
  }

  const replySignals = await collectReplySignals(leads);
  for (const r of replySignals) {
    upsertMemory(updatedMemories, memoriesCreated, memoriesUpdated, r);
  }

  const insights = buildInsights(updatedMemories, learningReports[0] ?? null);
  insightsGenerated.push(...insights);
  for (const ins of insights) {
    upsertMemory(updatedMemories, memoriesCreated, memoriesUpdated, {
      id: `pattern-${ins.id}`,
      entityType: "pattern",
      entityId: ins.id,
      title: `Pattern: ${ins.type}`,
      information: `${ins.insight} Recommendation: ${ins.recommendation}`,
      source: "Memory Graph Engine",
      timestamp: now,
      confidence: ins.confidence,
      importance: "Medium",
      expiration: plusDays(180),
      permanent: false,
    });
  }

  const retrievalResults = buildRetrievalResults(updatedMemories);

  await saveMemories(updatedMemories);
  await saveKnowledgeRelationships(updatedRels);

  const base: Omit<MemoryGraphReport, "id" | "timestamp" | "engine"> = {
    memoriesCreated,
    memoriesUpdated,
    relationshipsCreated,
    insightsGenerated,
    retrievalResults,
    learning: {
      whatWorked: insights.filter((i) => i.type === "success_pattern").map((i) => i.insight),
      whatFailed: insights.filter((i) => i.type === "failure_pattern").map((i) => i.insight),
      updatedStrategies: insights.map((i) => i.recommendation).slice(0, 8),
      priorityAdjustments: [
        "Increase priority on accounts with positive reply and high urgency",
        "Decrease repeat outreach on threads with unsubscribe/negative patterns",
      ],
    },
    confidence: {
      level: memoriesCreated.length > 0 ? "High" : "Medium",
      explanation:
        "Memory graph updated from CRM, communication, mission, execution, and learning artifacts with relationship indexing.",
    },
  };

  const body = process.env.OPENAI_API_KEY ? await enrichWithOpenAI(base) : base;

  const report: MemoryGraphReport = {
    id: crypto.randomUUID(),
    timestamp: now,
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    ...body,
  };
  await saveMemoryGraphReport(report);
  return report;
}

function upsertMemory(
  memories: MemoryItem[],
  created: MemoryItem[],
  updated: MemoryItem[],
  incoming: MemoryItem
) {
  const idx = memories.findIndex((m) => m.id === incoming.id);
  if (idx >= 0) {
    memories[idx] = incoming;
    updated.push(incoming);
  } else {
    memories.unshift(incoming);
    created.push(incoming);
  }
}

function upsertRelationship(
  rels: KnowledgeRelationship[],
  created: KnowledgeRelationship[],
  incoming: KnowledgeRelationship
) {
  const exists = rels.some((r) => r.id === incoming.id);
  if (exists) return;
  rels.unshift(incoming);
  created.push(incoming);
}

async function collectReplySignals(leads: Lead[]): Promise<MemoryItem[]> {
  const out: MemoryItem[] = [];
  for (const lead of leads.slice(0, 150)) {
    const replies = await getReplyAnalyses(lead.id);
    if (!replies.length) continue;
    const latest = replies[0];
    out.push({
      id: `outcome-reply-${latest.id}`,
      entityType: "outcome",
      entityId: latest.id,
      title: `Reply outcome ${lead.company}`,
      information: `Primary intent: ${latest.classification.primaryIntent}. Sentiment: ${latest.sentiment.overall}. Next action: ${latest.recommendedAction.action}.`,
      source: "Reply Intelligence",
      timestamp: latest.timestamp,
      confidence: latest.confidence.level,
      importance: latest.opportunityAssessment.riskLevel,
      expiration: plusDays(120),
      permanent: false,
    });
  }
  return out;
}

function buildInsights(
  memories: MemoryItem[],
  learning: Awaited<ReturnType<typeof getLearningReports>>[0] | null
): MemoryInsight[] {
  const sentCount = memories.filter((m) => m.entityType === "action").length;
  const outcomeCount = memories.filter((m) => m.entityType === "outcome").length;
  const successRate = sentCount === 0 ? 0 : Math.round((outcomeCount / sentCount) * 100);

  const insights: MemoryInsight[] = [
    {
      id: crypto.randomUUID(),
      type: "success_pattern",
      insight: "Conversation-linked actions with explicit next CTA show better continuation outcomes.",
      evidence: memories
        .filter((m) => m.entityType === "conversation")
        .slice(0, 3)
        .map((m) => m.title),
      recommendation: "Always attach a single explicit CTA to outbound follow-ups.",
      confidence: "Medium",
    },
    {
      id: crypto.randomUUID(),
      type: "failure_pattern",
      insight: "Actions on stale accounts (>14 days) are less likely to generate timely replies.",
      evidence: memories
        .filter((m) => m.entityType === "action" && m.information.toLowerCase().includes("pending"))
        .slice(0, 3)
        .map((m) => m.title),
      recommendation: "Refresh account intelligence before repeating outbound actions.",
      confidence: "Medium",
    },
    {
      id: crypto.randomUUID(),
      type: "timing_pattern",
      insight: `Current observed action-to-outcome conversion proxy is ${successRate}%.`,
      evidence: [`actions:${sentCount}`, `outcomes:${outcomeCount}`],
      recommendation: "Prioritize execution windows where recent positive engagement exists.",
      confidence: "Low",
    },
  ];

  if (learning?.recommendations.length) {
    insights.push({
      id: crypto.randomUUID(),
      type: "objection_pattern",
      insight: "Learning engine highlights repeated objections tied to unclear ROI messaging.",
      evidence: learning.recommendations.slice(0, 2).map((r) => r.problem),
      recommendation: "Inject ROI proof points earlier in outreach and reply drafts.",
      confidence: "High",
    });
  }

  return insights;
}

function buildRetrievalResults(memories: MemoryItem[]): MemoryRetrievalResult[] {
  const queries = [
    "before outreach context",
    "before meeting commitments",
    "similar successful deal pattern",
  ];
  return queries.map((query) => ({
    query,
    matches: scoreRetrieval(query, memories).slice(0, 5),
  }));
}

function scoreRetrieval(query: string, memories: MemoryItem[]) {
  const q = query.toLowerCase();
  return memories
    .map((m) => {
      let relevance = 20;
      if (q.includes("outreach") && /conversation|person|pattern/.test(m.entityType)) relevance += 35;
      if (q.includes("meeting") && /conversation|decision|outcome/.test(m.entityType)) relevance += 35;
      if (q.includes("successful") && /pattern|outcome/.test(m.entityType)) relevance += 40;
      if (m.importance === "Critical") relevance += 10;
      if (m.confidence === "High") relevance += 10;
      return {
        memoryId: m.id,
        title: m.title,
        relevance: Math.min(100, relevance),
        reason: `${m.entityType} memory from ${m.source} (${m.confidence})`,
      };
    })
    .sort((a, b) => b.relevance - a.relevance);
}

async function enrichWithOpenAI(
  data: Omit<MemoryGraphReport, "id" | "timestamp" | "engine">
): Promise<Omit<MemoryGraphReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    counts: {
      created: data.memoriesCreated.length,
      updated: data.memoriesUpdated.length,
      relationships: data.relationshipsCreated.length,
      insights: data.insightsGenerated.length,
    },
    retrieval: data.retrievalResults,
  };
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: MEMORY_GRAPH_PROMPT },
      {
        role: "user",
        content: `Memory cycle snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn valid JSON preserving factual counts.`,
      },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) return data;
  const parsed = JSON.parse(raw) as Partial<
    Omit<MemoryGraphReport, "id" | "timestamp" | "engine">
  >;
  return {
    ...data,
    learning: parsed.learning ?? data.learning,
    confidence: parsed.confidence ?? data.confidence,
  };
}

function plusDays(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}
