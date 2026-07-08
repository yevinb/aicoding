import OpenAI from "openai";
import { getCommunicationMessages, saveCommunicationMessages } from "./communication-os-store";
import { PROVIDER_ADAPTER_PROMPT } from "./provider-adapter-prompt";
import {
  getProviderAdapterReports,
  getProviderConfigs,
  saveProviderAdapterReport,
  saveProviderConfigs,
} from "./provider-adapter-store";
import { getReplyAnalyses } from "./reply-store";
import { getLeads } from "./store";
import {
  CommunicationMessage,
  ProviderAdapterReport,
  ProviderConfig,
  ProviderReceiveResult,
  ProviderSendInput,
  ProviderSendResult,
  ProviderStatusResult,
  ProviderSyncResult,
} from "./types";

export { getProviderAdapterReports };

interface CommunicationProviderAdapter {
  config: ProviderConfig;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
  receive(): Promise<ProviderReceiveResult[]>;
  sync(): Promise<ProviderSyncResult>;
  status(): Promise<ProviderStatusResult>;
}

class MockProviderAdapter implements CommunicationProviderAdapter {
  constructor(public config: ProviderConfig) {}

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const fail = input.recipient.includes("fail") || Math.random() < 0.03;
    return {
      messageId: `mock-${crypto.randomUUID()}`,
      provider: this.config.name,
      status: fail ? "failed" : "sent",
      timestamp: new Date().toISOString(),
      error: fail ? "Mock transient send failure" : undefined,
    };
  }

  async receive(): Promise<ProviderReceiveResult[]> {
    return [];
  }

  async sync(): Promise<ProviderSyncResult> {
    return {
      messages: 0,
      threads: 0,
      statuses: 0,
      replies: 0,
      timestamp: new Date().toISOString(),
    };
  }

  async status(): Promise<ProviderStatusResult> {
    return {
      connected: true,
      authenticationStatus: "ok",
      rateLimits: "500/min",
      errors: [],
      lastSync: this.config.lastSync,
    };
  }
}

class SmtpAdapter implements CommunicationProviderAdapter {
  constructor(public config: ProviderConfig) {}

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const host = process.env.SMTP_HOST;
    if (!host) {
      return {
        messageId: `smtp-${crypto.randomUUID()}`,
        provider: this.config.name,
        status: "failed",
        timestamp: new Date().toISOString(),
        error: "SMTP_HOST not configured",
      };
    }
    return {
      messageId: `smtp-${crypto.randomUUID()}`,
      provider: this.config.name,
      status: "sent",
      timestamp: new Date().toISOString(),
    };
  }

  async receive(): Promise<ProviderReceiveResult[]> {
    return [];
  }

  async sync(): Promise<ProviderSyncResult> {
    return {
      messages: 0,
      threads: 0,
      statuses: 0,
      replies: 0,
      timestamp: new Date().toISOString(),
    };
  }

  async status(): Promise<ProviderStatusResult> {
    return {
      connected: Boolean(process.env.SMTP_HOST),
      authenticationStatus: process.env.SMTP_HOST ? "ok" : "missing",
      rateLimits: "provider-defined",
      errors: process.env.SMTP_HOST ? [] : ["SMTP config missing"],
      lastSync: this.config.lastSync,
    };
  }
}

class ImapAdapter implements CommunicationProviderAdapter {
  constructor(public config: ProviderConfig) {}

  async send(): Promise<ProviderSendResult> {
    return {
      messageId: `imap-${crypto.randomUUID()}`,
      provider: this.config.name,
      status: "failed",
      timestamp: new Date().toISOString(),
      error: "IMAP adapter does not support send",
    };
  }

  async receive(): Promise<ProviderReceiveResult[]> {
    const leads = await getLeads();
    const out: ProviderReceiveResult[] = [];
    for (const lead of leads.slice(0, 6)) {
      const replies = await getReplyAnalyses(lead.id);
      if (!replies.length) continue;
      const latest = replies[0];
      out.push({
        sender: lead.email,
        recipient: "apex@company.local",
        content: latest.incomingMessage.slice(0, 320),
        timestamp: latest.timestamp,
        threadId: `thread-${lead.id}`,
        attachments: [],
      });
    }
    return out;
  }

  async sync(): Promise<ProviderSyncResult> {
    const received = await this.receive();
    return {
      messages: received.length,
      threads: new Set(received.map((r) => r.threadId)).size,
      statuses: received.length,
      replies: received.length,
      timestamp: new Date().toISOString(),
    };
  }

  async status(): Promise<ProviderStatusResult> {
    return {
      connected: true,
      authenticationStatus: process.env.IMAP_HOST ? "ok" : "missing",
      rateLimits: "sync every few minutes",
      errors: process.env.IMAP_HOST ? [] : ["IMAP_HOST not configured (demo receive still available)"],
      lastSync: this.config.lastSync,
    };
  }
}

class GoogleAdapter implements CommunicationProviderAdapter {
  constructor(public config: ProviderConfig) {}
  async send(): Promise<ProviderSendResult> {
    return {
      messageId: `google-${crypto.randomUUID()}`,
      provider: this.config.name,
      status: "failed",
      timestamp: new Date().toISOString(),
      error: "Google adapter disabled/optional",
    };
  }
  async receive(): Promise<ProviderReceiveResult[]> {
    return [];
  }
  async sync(): Promise<ProviderSyncResult> {
    return { messages: 0, threads: 0, statuses: 0, replies: 0, timestamp: new Date().toISOString() };
  }
  async status(): Promise<ProviderStatusResult> {
    return {
      connected: false,
      authenticationStatus: "missing",
      rateLimits: "google-api limits",
      errors: ["Optional adapter not configured"],
      lastSync: this.config.lastSync,
    };
  }
}

class MicrosoftAdapter implements CommunicationProviderAdapter {
  constructor(public config: ProviderConfig) {}
  async send(): Promise<ProviderSendResult> {
    return {
      messageId: `ms-${crypto.randomUUID()}`,
      provider: this.config.name,
      status: "failed",
      timestamp: new Date().toISOString(),
      error: "Microsoft adapter disabled/optional",
    };
  }
  async receive(): Promise<ProviderReceiveResult[]> {
    return [];
  }
  async sync(): Promise<ProviderSyncResult> {
    return { messages: 0, threads: 0, statuses: 0, replies: 0, timestamp: new Date().toISOString() };
  }
  async status(): Promise<ProviderStatusResult> {
    return {
      connected: false,
      authenticationStatus: "missing",
      rateLimits: "microsoft-api limits",
      errors: ["Optional adapter not configured"],
      lastSync: this.config.lastSync,
    };
  }
}

class ProviderManager {
  adapters: CommunicationProviderAdapter[];
  constructor(adapters: CommunicationProviderAdapter[]) {
    this.adapters = adapters;
  }

  getEnabled(): CommunicationProviderAdapter[] {
    return this.adapters
      .filter((a) => a.config.enabled)
      .sort((a, b) => a.config.priority - b.config.priority);
  }

  async sendWithFallback(input: ProviderSendInput): Promise<ProviderSendResult> {
    const enabled = this.getEnabled().filter((a) => a.config.capabilities.includes("send"));
    let lastFailure: ProviderSendResult | null = null;
    for (const adapter of enabled) {
      const status = await adapter.status();
      if (!status.connected) continue;
      const sent = await adapter.send(input);
      if (sent.status === "sent") return sent;
      lastFailure = sent;
    }
    return (
      lastFailure ?? {
        messageId: `none-${crypto.randomUUID()}`,
        provider: "none",
        status: "failed",
        timestamp: new Date().toISOString(),
        error: "No connected send-capable provider available",
      }
    );
  }
}

export async function runProviderAdapterLayer(): Promise<ProviderAdapterReport> {
  const providerConfigs = await getProviderConfigs();
  const adapters = buildAdapters(providerConfigs);
  const manager = new ProviderManager(adapters);
  const now = new Date().toISOString();

  const messages = await getCommunicationMessages();
  const pendingToSend = messages.filter(
    (m) => m.status === "sent" && !m.provider.startsWith("delivered:")
  );

  const messagesSent: ProviderSendResult[] = [];
  const messagesReceived: ProviderReceiveResult[] = [];
  const errors: ProviderAdapterReport["errors"] = [];
  const byProvider: ProviderAdapterReport["syncStatus"]["byProvider"] = [];
  let fallbackUsed = false;

  for (const msg of pendingToSend) {
    const result = await manager.sendWithFallback({
      recipient: msg.contact ? `${msg.contact} <${msg.contact}>` : msg.company,
      subject: msg.subject,
      content: msg.body,
      threadId: msg.threadId,
      metadata: { leadId: msg.leadId ?? "none", objective: msg.objective },
    });
    messagesSent.push(result);
    if (result.status === "sent") {
      const oldProvider = msg.provider;
      msg.provider = `delivered:${result.provider}`;
      if (oldProvider !== result.provider && oldProvider !== "adapter:email-demo") {
        fallbackUsed = true;
      }
    } else {
      errors.push({
        provider: result.provider,
        stage: "send",
        error: result.error ?? "Unknown send failure",
        retryScheduledAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
    }
  }
  if (pendingToSend.length > 0) {
    await saveCommunicationMessages(messages);
  }

  for (const adapter of manager.getEnabled()) {
    const stat = await adapter.status();
    if (!stat.connected) {
      errors.push({
        provider: adapter.config.name,
        stage: "status",
        error: stat.errors.join("; ") || "Disconnected",
        retryScheduledAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    }

    const received = adapter.config.capabilities.includes("receive")
      ? await adapter.receive()
      : [];
    messagesReceived.push(...received);

    const sync = adapter.config.capabilities.includes("sync")
      ? await adapter.sync()
      : { messages: 0, threads: 0, statuses: 0, replies: 0, timestamp: now };

    adapter.config.lastSync = sync.timestamp;
    adapter.config.status = stat.connected ? "connected" : "degraded";
    byProvider.push({
      providerId: adapter.config.id,
      status: adapter.config.status,
      lastSync: sync.timestamp,
      syncedMessages: sync.messages,
      syncedReplies: sync.replies,
    });
  }

  await saveProviderConfigs(adapters.map((a) => a.config));

  const connected = adapters.filter((a) => a.config.status === "connected").length;
  const health: ProviderAdapterReport["health"] = {
    overall: errors.length > 3 ? "Critical" : errors.length > 0 ? "Warning" : "Healthy",
    connectedProviders: connected,
    fallbackUsed,
    pendingActions: [
      ...new Set(
        errors.map((e) =>
          e.stage === "status"
            ? `Check ${e.provider} credentials`
            : `Retry ${e.stage} via ${e.provider}`
        )
      ),
    ].slice(0, 6),
  };

  const syncStatus: ProviderAdapterReport["syncStatus"] = {
    summary: `Processed ${pendingToSend.length} outbound delivery item(s), received ${messagesReceived.length} inbound item(s), and synced ${byProvider.length} provider adapter(s).`,
    byProvider,
  };

  const base: Omit<ProviderAdapterReport, "id" | "timestamp" | "engine"> = {
    providers: adapters.map((a) => a.config),
    messagesSent,
    messagesReceived,
    syncStatus,
    errors,
    health,
    confidence: {
      level: errors.length > 0 ? "Medium" : "High",
      explanation:
        "Provider manager executed adapter send/receive/sync/status workflow with fallback and health monitoring.",
    },
  };

  const body = process.env.OPENAI_API_KEY ? await enrichWithOpenAI(base) : base;

  const report: ProviderAdapterReport = {
    id: crypto.randomUUID(),
    timestamp: now,
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    ...body,
  };
  await saveProviderAdapterReport(report);
  return report;
}

function buildAdapters(configs: ProviderConfig[]): CommunicationProviderAdapter[] {
  return configs.map((c) => {
    if (c.type === "mock") return new MockProviderAdapter(c);
    if (c.type === "smtp") return new SmtpAdapter(c);
    if (c.type === "imap") return new ImapAdapter(c);
    if (c.type === "google") return new GoogleAdapter(c);
    return new MicrosoftAdapter(c);
  });
}

async function enrichWithOpenAI(
  data: Omit<ProviderAdapterReport, "id" | "timestamp" | "engine">
): Promise<Omit<ProviderAdapterReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    providers: data.providers.map((p) => ({
      id: p.id,
      status: p.status,
      enabled: p.enabled,
      capabilities: p.capabilities,
    })),
    totals: {
      sent: data.messagesSent.length,
      received: data.messagesReceived.length,
      errors: data.errors.length,
    },
    health: data.health,
  };
  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PROVIDER_ADAPTER_PROMPT },
      {
        role: "user",
        content: `Provider adapter cycle:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn valid JSON preserving factual counts.`,
      },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) return data;
  const parsed = JSON.parse(raw) as Partial<
    Omit<ProviderAdapterReport, "id" | "timestamp" | "engine">
  >;
  return {
    ...data,
    health: parsed.health ?? data.health,
    confidence: parsed.confidence ?? data.confidence,
  };
}
