import Link from "next/link";
import { getExecutionReports } from "@/lib/execution-engine-store";
import {
  ExecutionEngineReport,
  ExecutionPendingApproval,
  ExecutionTask,
  ExecutionTaskStatus,
  RiskLevel,
} from "@/lib/types";
import { RunExecutionButton } from "@/components/run-execution-button";

export const dynamic = "force-dynamic";

export default async function ExecutionEnginePage() {
  const reports = await getExecutionReports();
  const latest: ExecutionEngineReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Execution Engine</h1>
          <p className="text-sm text-muted mt-1">
            The action layer — receive decisions from Mission Control,
            Orchestrator, and CRO; validate, execute safely, verify outcomes,
            and maintain full audit trails.
          </p>
        </div>
        <RunExecutionButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No execution cycles yet. Run a cycle and the engine will receive
            work from intelligence systems, validate each action, delegate to
            specialist tools, and track every outcome.
          </p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}

      {reports.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Previous cycles
          </h2>
          <ul className="space-y-2">
            {reports.slice(1, 8).map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm flex justify-between gap-3"
              >
                <span className="text-xs text-muted">
                  {new Date(r.timestamp).toLocaleString()}
                </span>
                <span className="text-xs">
                  {r.tasksCompleted.length} completed ·{" "}
                  {r.pendingApprovals.length} approvals · health{" "}
                  {r.automationStatus.health}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReportView({ report }: { report: ExecutionEngineReport }) {
  const es = report.executionSummary;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo"} · confidence:{" "}
        {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Received" value={String(es.tasksReceived)} />
        <Stat label="Validated" value={String(es.tasksValidated)} />
        <Stat label="Executed" value={String(es.tasksExecuted)} />
        <Stat label="Blocked" value={String(es.tasksBlocked)} />
        <Stat
          label="Automation"
          value={report.automationStatus.health}
          warn={report.automationStatus.health !== "Healthy"}
        />
      </div>

      <Card title="Execution summary">
        <p className="text-sm">{es.summary}</p>
        {es.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {es.sources.map((s) => (
              <span
                key={s}
                className="text-[10px] px-2 py-0.5 rounded-full bg-accent-soft text-accent"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TaskList
          title={`Tasks created (${report.tasksCreated.length})`}
          tasks={report.tasksCreated}
          empty="No new tasks this cycle."
        />
        <TaskList
          title={`Completed (${report.tasksCompleted.length})`}
          tasks={report.tasksCompleted}
          empty="No tasks completed this cycle."
          done
        />
        <TaskList
          title={`Failed (${report.tasksFailed.length})`}
          tasks={report.tasksFailed}
          empty="No failures this cycle."
          warn
        />
        <ApprovalList
          title={`Pending approvals (${report.pendingApprovals.length})`}
          approvals={report.pendingApprovals}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Revenue impact">
          <p className="text-sm font-medium">{report.revenueImpact.estimatedImpact}</p>
          <p className="text-xs text-muted mt-1">{report.revenueImpact.explanation}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted">Leads advanced</p>
              <p className="font-semibold">{report.revenueImpact.leadsAdvanced}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Artifacts</p>
              <p className="font-semibold">{report.revenueImpact.artifactsCreated}</p>
            </div>
            <div>
              <p className="text-xs text-muted">CRM updates</p>
              <p className="font-semibold">{report.revenueImpact.crmUpdatesApplied}</p>
            </div>
          </div>
        </Card>

        <Card title="Automation health">
          <p className="text-sm mb-3">
            Status:{" "}
            <span
              className={
                report.automationStatus.health === "Healthy"
                  ? "text-good"
                  : report.automationStatus.health === "Degraded"
                    ? "text-warn"
                    : "text-bad"
              }
            >
              {report.automationStatus.health}
            </span>
          </p>
          <ul className="space-y-1.5 text-xs text-muted">
            {report.automationStatus.scheduledJobs.map((j) => (
              <li key={j.job} className="flex justify-between gap-2">
                <span>
                  {j.job} <span className="text-muted/70">({j.cadence})</span>
                </span>
                <span className={j.status === "OK" ? "text-good" : "text-warn"}>
                  {j.status}
                </span>
              </li>
            ))}
          </ul>
          {report.automationStatus.agentActivity.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-medium text-muted mb-2">Agent activity</p>
              <ul className="space-y-1 text-xs">
                {report.automationStatus.agentActivity.map((a) => (
                  <li key={a.agent} className="flex justify-between">
                    <span>{a.agent}</span>
                    <span className="text-muted">
                      {a.tasksCompleted} done · {a.successRate}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card title="Learning">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-good mb-1">Succeeded</p>
            <List items={report.learning.succeeded} />
          </div>
          <div>
            <p className="text-xs font-medium text-bad mb-1">Failed</p>
            <List items={report.learning.failed} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-1">Patterns</p>
            <List items={report.learning.patterns} />
          </div>
        </div>
      </Card>

      <p className="text-xs text-muted">{report.confidence.explanation}</p>
    </div>
  );
}

function TaskList({
  title,
  tasks,
  empty,
  done,
  warn,
}: {
  title: string;
  tasks: ExecutionTask[];
  empty: string;
  done?: boolean;
  warn?: boolean;
}) {
  return (
    <Card title={title}>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={`rounded-lg border p-3 text-sm ${
                warn
                  ? "border-bad/30 bg-bad/5"
                  : done
                    ? "border-good/30 bg-good/5"
                    : "border-line bg-surface-2/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">
                  {t.leadId ? (
                    <Link
                      href={`/leads/${t.leadId}`}
                      className="hover:text-accent transition"
                    >
                      {t.objective}
                    </Link>
                  ) : (
                    t.objective
                  )}
                </p>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-xs text-muted mt-1">{t.expectedOutcome}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <TypeBadge type={t.type} />
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                  {t.source}
                </span>
                <PriorityBadge level={t.priority} />
              </div>
              {t.result && (
                <p className="text-xs mt-2 text-good">→ {t.result}</p>
              )}
              {t.toolsUsed.length > 0 && (
                <p className="text-[10px] text-muted mt-1">
                  Tools: {t.toolsUsed.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ApprovalList({
  title,
  approvals,
}: {
  title: string;
  approvals: ExecutionPendingApproval[];
}) {
  return (
    <Card title={title}>
      {approvals.length === 0 ? (
        <p className="text-sm text-muted">No pending approvals.</p>
      ) : (
        <ul className="space-y-3">
          {approvals.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-warn/30 bg-warn/5 p-3 text-sm"
            >
              <p className="font-medium flex items-center gap-2">
                <PriorityBadge level={a.risk} />
                {a.leadId ? (
                  <Link href={`/leads/${a.leadId}`} className="hover:text-accent">
                    {a.action}
                  </Link>
                ) : (
                  a.action
                )}
              </p>
              <p className="text-xs text-muted mt-1">{a.reason}</p>
              <p className="text-xs mt-1">
                <span className="text-muted">Impact:</span> {a.expectedImpact}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${warn ? "text-warn" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-xs text-muted">None</p>;
  return (
    <ul className="list-disc list-inside space-y-0.5 text-xs text-muted">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function PriorityBadge({ level }: { level: RiskLevel }) {
  const cls =
    level === "Critical"
      ? "bg-bad/20 text-bad"
      : level === "High"
        ? "bg-bad/10 text-bad"
        : level === "Medium"
          ? "bg-warn/10 text-warn"
          : "bg-surface-2 text-muted";
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {level}
    </span>
  );
}

function TypeBadge({ type }: { type: ExecutionTask["type"] }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-soft text-accent capitalize">
      {type.replace("_", " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: ExecutionTaskStatus }) {
  const cls: Record<ExecutionTaskStatus, string> = {
    pending: "bg-surface-2 text-muted",
    running: "bg-accent/20 text-accent",
    completed: "bg-good/10 text-good",
    failed: "bg-bad/10 text-bad",
    blocked: "bg-warn/10 text-warn",
    needs_approval: "bg-warn/20 text-warn",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
