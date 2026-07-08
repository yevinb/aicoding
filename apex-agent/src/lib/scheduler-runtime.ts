import OpenAI from "openai";
import { runAnalytics } from "./analytics";
import { runCrmAudit } from "./crm-audit";
import { runCroReview } from "./cro";
import { runExecutionEngine } from "./execution-engine";
import { runLearning } from "./learning";
import { runMissionControl } from "./mission-control";
import { runProspectIntelligence } from "./prospect-intelligence";
import { runRevenueSignalEngine } from "./revenue-signal";
import { SCHEDULER_RUNTIME_PROMPT } from "./scheduler-runtime-prompt";
import {
  getRuntimeWorkerTasks,
  getSchedulerRuntimeReports,
  saveSchedulerRuntimeReport,
  upsertRuntimeWorkerTask,
} from "./scheduler-runtime-store";
import { SchedulerRuntimeReport, RuntimeWorkerTask, RiskLevel } from "./types";

export { getSchedulerRuntimeReports };

type JobDef = {
  id: string;
  name: string;
  frequency: SchedulerRuntimeReport["jobsScheduled"][number]["frequency"];
  priority: RiskLevel;
  enabled: boolean;
  nextRun: string;
  runner: () => Promise<string>;
  assignedAgent: string;
  approvalRequired?: boolean;
  approvalReason?: string;
};

const DEFAULT_TARGET = 100000;

export async function runSchedulerRuntime(): Promise<SchedulerRuntimeReport> {
  const now = new Date();
  const allTasks = await getRuntimeWorkerTasks();
  const jobs = buildJobSchedule(now);
  const runJobs = jobs.filter((j) => shouldRunNow(j, now));

  const executed: SchedulerRuntimeReport["jobsExecuted"] = [];
  const failures: SchedulerRuntimeReport["failures"] = [];
  const approvals: SchedulerRuntimeReport["approvals"] = [];
  const agentActivityMap = new Map<string, { total: number; success: number; last: string }>();
  let retriesScheduled = 0;

  for (const job of runJobs) {
    const duplicateRunning = allTasks.find(
      (t) => t.type === job.id && (t.status === "running" || t.status === "queued")
    );
    if (duplicateRunning) {
      executed.push({
        id: job.id,
        name: job.name,
        startedAt: now.toISOString(),
        completedAt: now.toISOString(),
        status: "skipped",
        result: "Skipped duplicate active worker",
      });
      continue;
    }

    const task: RuntimeWorkerTask = {
      id: crypto.randomUUID(),
      type: job.id,
      priority: job.priority,
      createdAt: now.toISOString(),
      scheduledFor: job.nextRun,
      status: job.approvalRequired ? "waiting_approval" : "queued",
      assignedAgent: job.assignedAgent,
      result: null,
      error: null,
    };
    await upsertRuntimeWorkerTask(task);

    if (job.approvalRequired) {
      approvals.push({
        taskId: task.id,
        action: job.name,
        reason: job.approvalReason ?? "Requires human approval",
        expectedImpact: "High-risk customer or commercial action",
        risk: "High",
        confidence: "Medium",
      });
      continue;
    }

    const startAt = new Date().toISOString();
    task.status = "running";
    await upsertRuntimeWorkerTask(task);

    try {
      const result = await job.runner();
      task.status = "completed";
      task.result = result;
      await upsertRuntimeWorkerTask(task);
      executed.push({
        id: job.id,
        name: job.name,
        startedAt: startAt,
        completedAt: new Date().toISOString(),
        status: "completed",
        result,
      });
      updateAgentActivity(agentActivityMap, job.assignedAgent, true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown runtime error";
      task.status = "failed";
      task.error = message;
      await upsertRuntimeWorkerTask(task);
      failures.push({
        taskId: task.id,
        job: job.name,
        reason: message,
        retryAt: scheduleRetry(task.priority),
        escalated: task.priority === "Critical",
      });
      retriesScheduled += 1;
      updateAgentActivity(agentActivityMap, job.assignedAgent, false);
      executed.push({
        id: job.id,
        name: job.name,
        startedAt: startAt,
        completedAt: new Date().toISOString(),
        status: "failed",
        result: message,
      });
    }
  }

  const refreshedTasks = await getRuntimeWorkerTasks();
  const queued = refreshedTasks.filter((t) => t.status === "queued").length;
  const running = refreshedTasks.filter((t) => t.status === "running").length;
  const failed = refreshedTasks.filter((t) => t.status === "failed").length;
  const waitingApproval = refreshedTasks.filter(
    (t) => t.status === "waiting_approval"
  ).length;
  const criticalBacklog = refreshedTasks.filter(
    (t) => t.priority === "Critical" && (t.status === "queued" || t.status === "failed")
  ).length;

  const runtimeStatus: SchedulerRuntimeReport["runtimeStatus"] = {
    mode: "continuous",
    summary: `Executed ${executed.filter((e) => e.status === "completed").length}/${runJobs.length} scheduled jobs this cycle.`,
    uptimeNote: "Scheduler runtime is active and evaluating all frequency bands.",
    queueDepth: queued + running + waitingApproval,
    criticalBacklog,
  };

  const workerHealth: SchedulerRuntimeReport["workerHealth"] = {
    status:
      failed > 3 || criticalBacklog > 1
        ? "Critical"
        : failed > 0 || waitingApproval > 0
          ? "Warning"
          : "Healthy",
    activeWorkers: running,
    queued,
    failed,
    waitingApproval,
    retriesScheduled,
    notes: [
      waitingApproval > 0
        ? `${waitingApproval} worker(s) waiting human approval`
        : "No approval blockers",
      failed > 0 ? `${failed} failed worker(s) retained for retry` : "No worker failures",
      criticalBacklog > 0
        ? `${criticalBacklog} critical task(s) in backlog`
        : "No critical backlog",
    ],
  };

  const agentActivity = [...agentActivityMap.entries()].map(([agent, stats]) => ({
    agent,
    tasksRun: stats.total,
    successRate: `${Math.round((stats.success / Math.max(stats.total, 1)) * 100)}%`,
    lastActivity: stats.last,
  }));

  const jobsScheduled = jobs.map((j) => ({
    id: j.id,
    name: j.name,
    frequency: j.frequency,
    nextRun: j.nextRun,
    priority: j.priority,
    enabled: j.enabled,
  }));

  const revenueImpact = buildRevenueImpact(executed);

  const body: Omit<SchedulerRuntimeReport, "id" | "timestamp" | "engine"> =
    process.env.OPENAI_API_KEY
      ? await enrichWithOpenAI({
          runtimeStatus,
          jobsScheduled,
          jobsExecuted: executed,
          workerHealth,
          agentActivity,
          failures,
          approvals,
          revenueImpact,
        })
      : {
          runtimeStatus,
          jobsScheduled,
          jobsExecuted: executed,
          workerHealth,
          agentActivity,
          failures,
          approvals,
          revenueImpact,
          confidence: {
            level: failures.length === 0 ? "High" : "Medium",
            explanation:
              "Runtime executed scheduled autonomous cycles with queue, retry, and approval controls.",
          },
        };

  const report: SchedulerRuntimeReport = {
    id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    ...body,
  };
  await saveSchedulerRuntimeReport(report);
  return report;
}

function buildJobSchedule(now: Date): JobDef[] {
  return [
    // every 15 min
    {
      id: "q15-signal-monitor",
      name: "Signal monitoring pulse",
      frequency: "every_15_min",
      priority: "Critical",
      enabled: true,
      nextRun: plusMinutes(now, 15),
      runner: async () => {
        const r = await runRevenueSignalEngine();
        return `Detected ${r.signalsDetected.length} signals and ${r.highPriorityAlerts.length} alerts`;
      },
      assignedAgent: "Revenue Signal Engine",
    },
    {
      id: "q15-mission-status",
      name: "Mission status check",
      frequency: "every_15_min",
      priority: "High",
      enabled: true,
      nextRun: plusMinutes(now, 15),
      runner: async () => {
        const r = await runMissionControl();
        return `Missions active ${r.missionsActive.length}, blocked ${r.blockedMissions.length}`;
      },
      assignedAgent: "Mission Control",
    },
    {
      id: "q15-exec-failure-check",
      name: "Execution failure and approval queue check",
      frequency: "every_15_min",
      priority: "High",
      enabled: true,
      nextRun: plusMinutes(now, 15),
      runner: async () => {
        const r = await runExecutionEngine();
        return `Execution completed ${r.tasksCompleted.length}, failed ${r.tasksFailed.length}, approvals ${r.pendingApprovals.length}`;
      },
      assignedAgent: "Execution Engine",
    },

    // hourly
    {
      id: "h-prospect-refresh",
      name: "Prospect intelligence refresh",
      frequency: "hourly",
      priority: "High",
      enabled: true,
      nextRun: plusHours(now, 1),
      runner: async () => {
        const r = await runProspectIntelligence();
        return `Discovered ${r.discoveredAccounts.length} accounts`;
      },
      assignedAgent: "Prospect Intelligence",
    },
    {
      id: "h-crm-health",
      name: "CRM health check",
      frequency: "hourly",
      priority: "Medium",
      enabled: true,
      nextRun: plusHours(now, 1),
      runner: async () => {
        const r = await runCrmAudit();
        return `CRM overall ${r.crmHealth.overall.score}`;
      },
      assignedAgent: "CRM Agent",
    },

    // daily
    {
      id: "d-analytics",
      name: "Daily revenue intelligence analysis",
      frequency: "daily",
      priority: "High",
      enabled: true,
      nextRun: plusDays(now, 1),
      runner: async () => {
        const r = await runAnalytics(DEFAULT_TARGET);
        return `Target hit probability ${r.forecast.probabilityOfHittingTarget}%`;
      },
      assignedAgent: "Analytics Agent",
    },
    {
      id: "d-learning",
      name: "Daily learning optimization cycle",
      frequency: "daily",
      priority: "Medium",
      enabled: true,
      nextRun: plusDays(now, 1),
      runner: async () => {
        const r = await runLearning();
        return `Generated ${r.recommendations.length} recommendations`;
      },
      assignedAgent: "Learning Agent",
    },
    {
      id: "d-cro-briefing",
      name: "Daily CRO executive briefing",
      frequency: "daily",
      priority: "High",
      enabled: true,
      nextRun: plusDays(now, 1),
      runner: async () => {
        const r = await runCroReview(DEFAULT_TARGET);
        return `CRO priority actions ${r.priorityActions.length}`;
      },
      assignedAgent: "CRO Agent",
    },

    // weekly
    {
      id: "w-strategy-review",
      name: "Weekly performance and strategy optimization",
      frequency: "weekly",
      priority: "Medium",
      enabled: true,
      nextRun: plusDays(now, 7),
      runner: async () => {
        const [analytics, learning] = await Promise.all([
          runAnalytics(DEFAULT_TARGET),
          runLearning(),
        ]);
        return `Weekly synthesis: ${analytics.recommendations.length} analytics recs, ${learning.experiments.length} experiments`;
      },
      assignedAgent: "Analytics + Learning",
    },

    // event-driven simulated hooks
    {
      id: "evt-new-reply",
      name: "Event trigger: new reply workflow",
      frequency: "event",
      priority: "Critical",
      enabled: true,
      nextRun: plusMinutes(now, 1),
      runner: async () => {
        const r = await runExecutionEngine();
        return `Reply-triggered execution processed ${r.tasksCompleted.length} tasks`;
      },
      assignedAgent: "Reply + Execution",
    },
    {
      id: "evt-sensitive-approval",
      name: "Event trigger: sensitive executive communication",
      frequency: "event",
      priority: "High",
      enabled: true,
      nextRun: plusMinutes(now, 1),
      runner: async () => "Awaiting approval",
      assignedAgent: "Execution Engine",
      approvalRequired: true,
      approvalReason: "Sensitive executive communication requires human control",
    },
  ];
}

function shouldRunNow(job: JobDef, now: Date): boolean {
  const m = now.getMinutes();
  if (job.frequency === "every_15_min") return m % 15 === 0 || true;
  if (job.frequency === "hourly") return now.getMinutes() < 5 || true;
  if (job.frequency === "daily") return now.getHours() === 8 || true;
  if (job.frequency === "weekly") return now.getDay() === 1 || true;
  return true;
}

function buildRevenueImpact(
  executed: SchedulerRuntimeReport["jobsExecuted"]
): SchedulerRuntimeReport["revenueImpact"] {
  const completed = executed.filter((e) => e.status === "completed");
  const opportunitiesActivated = completed.filter((e) =>
    /signal|prospect|mission|execution/i.test(e.name)
  ).length;
  const missionsCreated = completed.filter((e) => /mission/i.test(e.name)).length;
  const tasksCompleted = completed.length;
  return {
    opportunitiesActivated,
    missionsCreated,
    tasksCompleted,
    estimatedPipelineInfluence: `$${(tasksCompleted * 18000).toLocaleString()}–$${(tasksCompleted * 36000).toLocaleString()} influence`,
    summary: `${tasksCompleted} autonomous jobs completed; ${opportunitiesActivated} revenue-opportunity workflows activated.`,
  };
}

async function enrichWithOpenAI(
  data: Omit<SchedulerRuntimeReport, "id" | "timestamp" | "engine" | "confidence">
): Promise<Omit<SchedulerRuntimeReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    runtimeStatus: data.runtimeStatus,
    workerHealth: data.workerHealth,
    jobsExecuted: data.jobsExecuted.slice(0, 8),
    failures: data.failures,
    approvals: data.approvals,
  };

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SCHEDULER_RUNTIME_PROMPT },
      {
        role: "user",
        content: `Runtime cycle snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn scheduler runtime JSON preserving factual counts.`,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty OpenAI response");
  const parsed = JSON.parse(raw) as Partial<
    Omit<SchedulerRuntimeReport, "id" | "timestamp" | "engine">
  >;

  return {
    runtimeStatus: data.runtimeStatus,
    jobsScheduled: data.jobsScheduled,
    jobsExecuted: data.jobsExecuted,
    workerHealth: data.workerHealth,
    agentActivity: data.agentActivity,
    failures: data.failures,
    approvals: data.approvals,
    revenueImpact: data.revenueImpact,
    confidence: parsed.confidence ?? {
      level: data.workerHealth.status === "Healthy" ? "High" : "Medium",
      explanation: "OpenAI-enriched scheduler health and runtime narrative.",
    },
  };
}

function updateAgentActivity(
  map: Map<string, { total: number; success: number; last: string }>,
  agent: string,
  success: boolean
): void {
  const cur = map.get(agent) ?? { total: 0, success: 0, last: "" };
  cur.total += 1;
  if (success) cur.success += 1;
  cur.last = new Date().toISOString();
  map.set(agent, cur);
}

function scheduleRetry(priority: RiskLevel): string {
  const minutes = priority === "Critical" ? 5 : priority === "High" ? 15 : 60;
  return plusMinutes(new Date(), minutes);
}

function plusMinutes(d: Date, n: number): string {
  return new Date(d.getTime() + n * 60 * 1000).toISOString();
}
function plusHours(d: Date, n: number): string {
  return new Date(d.getTime() + n * 60 * 60 * 1000).toISOString();
}
function plusDays(d: Date, n: number): string {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
}
