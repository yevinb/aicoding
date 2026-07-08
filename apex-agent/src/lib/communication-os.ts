import OpenAI from "openai";
import { getExecutionTasks } from "./execution-task-store";
import { getPlaybook } from "./outreach-store";
import { getReplyAnalyses } from "./reply-store";
import { getLeads } from "./store";
import { COMMUNICATION_OS_PROMPT } from "./communication-os-prompt";
import {
  getCommunicationMessages,
  getCommunicationOsReports,
  getConversations,
  saveCommunicationMessages,
  saveCommunicationOsReport,
  saveConversations,
} from "./communication-os-store";
import {
  CommunicationApproval,
  CommunicationConversation,
  CommunicationMessage,
  CommunicationOsReport,
  CommunicationReply,
  Lead,
} from "./types";

export { getCommunicationOsReports };

export async function runCommunicationOs(): Promise<CommunicationOsReport> {
  const leads = await getLeads();
  const existingMessages = await getCommunicationMessages();
  const existingConversations = await getConversations();
  const executionTasks = await getExecutionTasks();

  const communicationsProcessed: CommunicationOsReport["communicationsProcessed"] = [];
  const messagesCreated: CommunicationMessage[] = [];
  const messagesSent: CommunicationMessage[] = [];
  const repliesDetected: CommunicationReply[] = [];
  const conversationsUpdated: CommunicationConversation[] = [...existingConversations];
  const approvalsRequired: CommunicationApproval[] = [];

  const now = new Date().toISOString();

  const actionableLeads = leads.filter(
    (l) => !["closed_won", "closed_lost"].includes(l.status)
  );
  communicationsProcessed.push({
    source: "CRM",
    count: actionableLeads.length,
    summary: `Loaded ${actionableLeads.length} active communication records.`,
  });

  for (const lead of actionableLeads) {
    const playbook = await getPlaybook(lead.id);
    const replies = await getReplyAnalyses(lead.id);

    if (replies.length > 0) {
      const latest = replies[0];
      repliesDetected.push({
        id: crypto.randomUUID(),
        leadId: lead.id,
        company: lead.company,
        contact: lead.contactName,
        message: latest.incomingMessage.slice(0, 280),
        intent: latest.classification.primaryIntent,
        sentiment: latest.sentiment.overall,
        opportunityImpact: latest.opportunityAssessment.riskLevel,
        nextAction: latest.recommendedAction.action,
        detectedAt: latest.timestamp,
      });
      upsertConversation(conversationsUpdated, {
        id: `conv-${lead.id}`,
        leadId: lead.id,
        company: lead.company,
        contact: lead.contactName,
        threadId: `thread-${lead.id}`,
        intent: latest.classification.primaryIntent,
        sentiment: latest.sentiment.overall,
        opportunityImpact: latest.opportunityAssessment.riskLevel,
        nextRecommendedAction: latest.recommendedAction.action,
        lastActivityAt: latest.timestamp,
        messageCount: countMessagesForThread(existingMessages, `thread-${lead.id}`),
      });
    }

    if (!playbook?.decision.outreachNow) continue;
    const hasRecentSent = existingMessages.some(
      (m) =>
        m.leadId === lead.id &&
        m.status === "sent" &&
        Date.now() - new Date(m.sentAt ?? m.createdAt).getTime() < 36 * 60 * 60 * 1000
    );
    if (hasRecentSent) continue;

    const touch = playbook.sequence[0];
    if (!touch) continue;

    const draft: CommunicationMessage = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      company: lead.company,
      contact: lead.contactName,
      channel: "email",
      subject: touch.subject || `Quick idea for ${lead.company}`,
      body: touch.message,
      cta: touch.cta,
      objective: touch.objective,
      scheduledFor: nextSendWindow(),
      status: "draft",
      provider: "adapter:email-demo",
      threadId: `thread-${lead.id}`,
      createdAt: now,
      sentAt: null,
    };

    if (requiresApproval(lead, draft)) {
      draft.status = "waiting_approval";
      approvalsRequired.push({
        id: crypto.randomUUID(),
        action: `Send email to ${lead.contactName} (${lead.company})`,
        messageId: draft.id,
        reason: approvalReason(lead),
        risk: lead.priorityScore !== null && lead.priorityScore >= 80 ? "High" : "Medium",
        confidence: "High",
        expectedImpact: lead.estimatedDealSize ?? "$24,000-$48,000 ARR influence",
      });
    } else {
      draft.status = "sent";
      draft.sentAt = now;
      messagesSent.push(draft);
    }

    messagesCreated.push(draft);
    upsertConversation(conversationsUpdated, {
      id: `conv-${lead.id}`,
      leadId: lead.id,
      company: lead.company,
      contact: lead.contactName,
      threadId: draft.threadId,
      intent: "outbound_prospecting",
      sentiment: "neutral",
      opportunityImpact: lead.status,
      nextRecommendedAction: lead.crm.nextAction,
      lastActivityAt: now,
      messageCount: countMessagesForThread(existingMessages, draft.threadId) + 1,
    });
  }

  const pendingCommTasks = executionTasks.filter((t) =>
    ["email", "follow_up", "calendar"].includes(t.type)
  );
  communicationsProcessed.push({
    source: "Execution Engine",
    count: pendingCommTasks.length,
    summary: `${pendingCommTasks.length} communication-related execution task(s) scanned.`,
  });

  // bounce/unsubscribe simulation from lead notes
  for (const lead of actionableLeads) {
    const note = lead.crm.notes.toLowerCase();
    if (note.includes("unsubscribe")) {
      const existing = messagesCreated.find((m) => m.leadId === lead.id);
      if (existing) existing.status = "unsubscribed";
    }
    if (note.includes("bounce") || note.includes("invalid email")) {
      const existing = messagesCreated.find((m) => m.leadId === lead.id);
      if (existing) existing.status = "bounced";
    }
  }

  const allMessages = [...messagesCreated, ...existingMessages]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 400);
  await saveCommunicationMessages(allMessages);
  await saveConversations(conversationsUpdated);

  const analytics = buildAnalytics(messagesCreated, messagesSent, repliesDetected);

  const base: Omit<CommunicationOsReport, "id" | "timestamp" | "engine"> = {
    communicationsProcessed,
    messagesCreated,
    messagesSent,
    repliesDetected,
    conversationsUpdated,
    approvalsRequired,
    analytics,
    confidence: {
      level: approvalsRequired.length > 0 ? "Medium" : "High",
      explanation:
        "Communication OS validated context, de-duplicated sends, applied approval controls, and updated conversation memory.",
    },
  };

  const body =
    process.env.OPENAI_API_KEY
      ? await enrichWithOpenAI(base)
      : base;

  const report: CommunicationOsReport = {
    id: crypto.randomUUID(),
    timestamp: now,
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    ...body,
  };
  await saveCommunicationOsReport(report);
  return report;
}

function buildAnalytics(
  created: CommunicationMessage[],
  sent: CommunicationMessage[],
  replies: CommunicationReply[]
): CommunicationOsReport["analytics"] {
  const positive = replies.filter((r) =>
    /(positive|interested|curious|meeting|pricing|demo)/i.test(
      `${r.intent} ${r.sentiment} ${r.message}`
    )
  ).length;
  const meetingsGenerated = replies.filter((r) =>
    /meeting|demo|call/.test(r.nextAction.toLowerCase())
  ).length;
  const conversion = sent.length === 0 ? 0 : Math.round((replies.length / sent.length) * 100);

  return {
    messagesSent: sent.length,
    repliesReceived: replies.length,
    positiveReplies: positive,
    meetingsGenerated,
    conversionRate: `${conversion}%`,
    bestChannels: ["email", "internal_notification"],
    bestTiming: "Tuesday-Thursday mornings in prospect timezone",
    communicationHealth:
      sent.length === 0 && created.length > 0
        ? "Warning"
        : conversion >= 20
          ? "Healthy"
          : "Warning",
  };
}

function requiresApproval(lead: Lead, message: CommunicationMessage): boolean {
  const executive = /(chief|ceo|cfo|cto|vp|president)/i.test(lead.contactTitle);
  const highValue = (lead.priorityScore ?? 0) >= 80;
  const sensitive = /(legal|contract|pricing|security|procurement)/i.test(
    `${message.subject} ${message.body} ${lead.crm.notes}`
  );
  return executive || highValue || sensitive;
}

function approvalReason(lead: Lead): string {
  if (/(chief|ceo|cfo|cto|vp|president)/i.test(lead.contactTitle)) {
    return "Executive communication requires human approval";
  }
  if ((lead.priorityScore ?? 0) >= 80) {
    return "High-value account requires approval gate";
  }
  return "Sensitive communication context detected";
}

function nextSendWindow(): string {
  const dt = new Date(Date.now() + 45 * 60 * 1000);
  return dt.toISOString();
}

function countMessagesForThread(messages: CommunicationMessage[], threadId: string): number {
  return messages.filter((m) => m.threadId === threadId).length;
}

function upsertConversation(
  list: CommunicationConversation[],
  conv: CommunicationConversation
) {
  const idx = list.findIndex((c) => c.id === conv.id);
  if (idx >= 0) list[idx] = conv;
  else list.unshift(conv);
}

async function enrichWithOpenAI(
  data: Omit<CommunicationOsReport, "id" | "timestamp" | "engine">
): Promise<Omit<CommunicationOsReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    processed: data.communicationsProcessed,
    counts: {
      created: data.messagesCreated.length,
      sent: data.messagesSent.length,
      replies: data.repliesDetected.length,
      approvals: data.approvalsRequired.length,
    },
    analytics: data.analytics,
  };
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: COMMUNICATION_OS_PROMPT },
      {
        role: "user",
        content: `Communication cycle snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn valid JSON preserving factual counts.`,
      },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) return data;
  const parsed = JSON.parse(raw) as Partial<
    Omit<CommunicationOsReport, "id" | "timestamp" | "engine">
  >;
  return {
    ...data,
    analytics: parsed.analytics ?? data.analytics,
    confidence: parsed.confidence ?? data.confidence,
  };
}
