import OpenAI from "openai";
import { runExecutionEngine } from "./execution-engine";
import { runMissionControl } from "./mission-control";
import { runProspectIntelligence } from "./prospect-intelligence";
import { runRevenueSignalEngine } from "./revenue-signal";
import { runSchedulerRuntime } from "./scheduler-runtime";
import { LOOP_CONTROLLER_PROMPT } from "./loop-controller-prompt";
import { getLoopReports, saveLoopReport } from "./loop-controller-store";
import { getLeads } from "./store";
import { AutonomousLoopReport, LoopAction, LoopDecision, LoopObservation } from "./types";

export { getLoopReports };

export async function runAutonomousLoop(): Promise<AutonomousLoopReport> {
  const now = new Date().toISOString();
  const wakeReason = "Scheduled trigger + event scan";

  // WAKE + OBSERVE
  const leads = await getLeads();
  const observations: LoopObservation[] = [];
  const overdue = leads.filter(
    (l) => l.crm.followUpDate && new Date(l.crm.followUpDate).getTime() <= Date.now()
  );
  if (overdue.length) {
    observations.push({
      area: "CRM",
      change: `${overdue.length} overdue follow-up(s) detected`,
      impact: "Revenue decay risk on active opportunities",
      urgency: "High",
      source: "CRM timeline",
    });
  }
  const engaged = leads.filter((l) => l.status === "engaged");
  observations.push({
    area: "Pipeline",
    change: `${engaged.length} engaged account(s) currently active`,
    impact: "High-likelihood conversion window",
    urgency: engaged.length > 0 ? "Medium" : "Low",
    source: "Lead store",
  });

  // DECIDE
  const decisions: LoopDecision[] = [
    {
      decision: "Run scheduler runtime heartbeat",
      reason: "Coordinate all frequency bands and worker health",
      expectedImpact: "Continuous operation with queue reliability",
      assignedSystem: "Scheduler Runtime",
      approvalRequired: false,
      priority: "Critical",
    },
    {
      decision: "Prioritize urgent signal and mission refresh",
      reason: "Overdue/active accounts require immediate re-evaluation",
      expectedImpact: "Prevent missed opportunities",
      assignedSystem: "Revenue Signals + Mission Control",
      approvalRequired: false,
      priority: "High",
    },
  ];

  // ACTIVATE + EXECUTE
  const actionsTriggered: LoopAction[] = [];
  const completedWork: AutonomousLoopReport["completedWork"] = [];
  const blockedWork: AutonomousLoopReport["blockedWork"] = [];
  const approvalsNeeded: AutonomousLoopReport["approvalsNeeded"] = [];

  try {
    const runtime = await runSchedulerRuntime();
    actionsTriggered.push({
      id: crypto.randomUUID(),
      action: "Run scheduler cycle",
      target: "Runtime queues",
      assignedSystem: "Scheduler Runtime",
      status: "completed",
      priority: "Critical",
    });
    completedWork.push({
      system: "Scheduler Runtime",
      work: "Cycle execution",
      result: runtime.runtimeStatus.summary,
    });
    approvalsNeeded.push(
      ...runtime.approvals.map((a) => ({
        action: a.action,
        reason: a.reason,
        expectedImpact: a.expectedImpact,
        risk: a.risk,
        confidence: a.confidence,
      }))
    );
  } catch (err) {
    blockedWork.push({
      system: "Scheduler Runtime",
      work: "Cycle execution",
      reason: err instanceof Error ? err.message : "Unknown runtime error",
    });
  }

  // targeted wake actions
  const [signals, missions, execution, prospect] = await Promise.allSettled([
    runRevenueSignalEngine(),
    runMissionControl(),
    runExecutionEngine(),
    runProspectIntelligence(),
  ]);

  captureResult(
    signals,
    "Revenue Signals",
    "Signal scan",
    actionsTriggered,
    completedWork,
    blockedWork
  );
  captureResult(
    missions,
    "Mission Control",
    "Mission prioritization",
    actionsTriggered,
    completedWork,
    blockedWork
  );
  captureResult(
    execution,
    "Execution Engine",
    "Approved execution cycle",
    actionsTriggered,
    completedWork,
    blockedWork
  );
  captureResult(
    prospect,
    "Prospect Intelligence",
    "Prospect refresh",
    actionsTriggered,
    completedWork,
    blockedWork
  );

  // VERIFY + LEARN
  const learning: AutonomousLoopReport["learning"] = {
    successfulPatterns: completedWork.map((c) => `${c.system}: ${c.work}`),
    failurePatterns: blockedWork.map((b) => `${b.system}: ${b.reason}`),
    timingInsights: [
      "15-minute wake loop catches urgent follow-up and signal decay quickly",
      "Hourly intelligence refresh keeps opportunity timing current",
    ],
    improvements: [
      "Increase event-source integration for website intent and inbox webhooks",
      "Auto-close duplicate low-value loops when critical backlog exists",
    ],
  };

  const loopStatus: AutonomousLoopReport["loopStatus"] = {
    phase: "verify",
    cycleSummary: `Observed ${observations.length} change(s), triggered ${actionsTriggered.length} action(s), completed ${completedWork.length} work item(s).`,
    systemHealth: blockedWork.length > 1 ? "Warning" : "Healthy",
    wakeReason,
    nextWake: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };

  const base: Omit<AutonomousLoopReport, "id" | "timestamp" | "engine"> = {
    loopStatus,
    observations,
    decisions,
    actionsTriggered,
    completedWork,
    blockedWork,
    approvalsNeeded,
    learning,
    confidence: {
      level: blockedWork.length === 0 ? "High" : "Medium",
      explanation:
        "Loop controller executed full observe-decide-act-verify cycle using live Apex subsystems.",
    },
  };

  const body =
    process.env.OPENAI_API_KEY
      ? await enrichWithOpenAI(base)
      : base;

  const report: AutonomousLoopReport = {
    id: crypto.randomUUID(),
    timestamp: now,
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
    ...body,
  };
  await saveLoopReport(report);
  return report;
}

function captureResult(
  result: PromiseSettledResult<unknown>,
  system: string,
  work: string,
  actions: LoopAction[],
  completed: AutonomousLoopReport["completedWork"],
  blocked: AutonomousLoopReport["blockedWork"]
) {
  if (result.status === "fulfilled") {
    actions.push({
      id: crypto.randomUUID(),
      action: work,
      target: system,
      assignedSystem: system,
      status: "completed",
      priority: "High",
    });
    completed.push({
      system,
      work,
      result: "Completed successfully",
    });
  } else {
    actions.push({
      id: crypto.randomUUID(),
      action: work,
      target: system,
      assignedSystem: system,
      status: "blocked",
      priority: "High",
    });
    blocked.push({
      system,
      work,
      reason: result.reason instanceof Error ? result.reason.message : "Execution failed",
    });
  }
}

async function enrichWithOpenAI(
  data: Omit<AutonomousLoopReport, "id" | "timestamp" | "engine">
): Promise<Omit<AutonomousLoopReport, "id" | "timestamp" | "engine">> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = {
    loopStatus: data.loopStatus,
    observations: data.observations,
    decisions: data.decisions,
    actionsTriggered: data.actionsTriggered.length,
    completedWork: data.completedWork.length,
    blockedWork: data.blockedWork.length,
  };

  const res = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: LOOP_CONTROLLER_PROMPT },
      {
        role: "user",
        content: `Loop snapshot:\n${JSON.stringify(snapshot, null, 2)}\n\nReturn JSON preserving all factual counts and statuses.`,
      },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) return data;
  const parsed = JSON.parse(raw) as Partial<
    Omit<AutonomousLoopReport, "id" | "timestamp" | "engine">
  >;
  return {
    ...data,
    confidence: parsed.confidence ?? data.confidence,
    learning: parsed.learning ?? data.learning,
  };
}
