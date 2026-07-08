import { RunSchedulerRuntimeButton } from "@/components/run-scheduler-runtime-button";
import { getSchedulerRuntimeReports } from "@/lib/scheduler-runtime-store";
import { SchedulerRuntimeReport, RiskLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RuntimePage() {
  const reports = await getSchedulerRuntimeReports();
  const latest: SchedulerRuntimeReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Scheduler Runtime</h1>
          <p className="text-sm text-muted mt-1">
            Autonomous scheduler and worker heartbeat for continuous ApexGrowth cycles.
          </p>
        </div>
        <RunSchedulerRuntimeButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No runtime cycles yet. Run one to execute scheduled jobs and worker coordination.
          </p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}
    </div>
  );
}

function ReportView({ report }: { report: SchedulerRuntimeReport }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo"} · confidence:{" "}
        {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Queue Depth" value={String(report.runtimeStatus.queueDepth)} />
        <Stat label="Critical Backlog" value={String(report.runtimeStatus.criticalBacklog)} />
        <Stat label="Executed" value={String(report.jobsExecuted.length)} />
        <Stat label="Failures" value={String(report.failures.length)} />
        <Stat label="Health" value={report.workerHealth.status} />
      </div>

      <Card title="Runtime status">
        <p className="text-sm">{report.runtimeStatus.summary}</p>
        <p className="text-xs text-muted mt-1">{report.runtimeStatus.uptimeNote}</p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Scheduled jobs (${report.jobsScheduled.length})`}>
          <ul className="space-y-2 text-sm">
            {report.jobsScheduled.map((j) => (
              <li key={j.id} className="rounded-lg border border-line p-3">
                <p className="font-medium flex items-center gap-2">
                  <PriorityBadge level={j.priority} />
                  {j.name}
                </p>
                <p className="text-xs text-muted mt-1">
                  {j.frequency.replaceAll("_", " ")} · next {new Date(j.nextRun).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Jobs executed (${report.jobsExecuted.length})`}>
          <ul className="space-y-2 text-sm">
            {report.jobsExecuted.map((j) => (
              <li key={`${j.id}-${j.startedAt}`} className="rounded-lg border border-line p-3">
                <p className="font-medium">{j.name}</p>
                <p className="text-xs text-muted mt-1">
                  {j.status} · {new Date(j.startedAt).toLocaleTimeString()} -{" "}
                  {new Date(j.completedAt).toLocaleTimeString()}
                </p>
                <p className="text-xs mt-1">{j.result}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Agent activity (${report.agentActivity.length})`}>
          <ul className="space-y-2 text-sm">
            {report.agentActivity.map((a) => (
              <li key={a.agent} className="flex justify-between border-b border-line/50 pb-1.5 last:border-0">
                <span>{a.agent}</span>
                <span className="text-xs text-muted">{a.tasksRun} runs · {a.successRate}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Approvals (${report.approvals.length})`}>
          {report.approvals.length === 0 ? (
            <p className="text-sm text-muted">No approval requests.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.approvals.map((a) => (
                <li key={a.taskId} className="rounded-lg border border-warn/30 bg-warn/5 p-3">
                  <p className="font-medium flex items-center gap-2">
                    <PriorityBadge level={a.risk} />
                    {a.action}
                  </p>
                  <p className="text-xs text-muted mt-1">{a.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Worker health">
        <p className="text-sm">
          Status: <span className="font-medium">{report.workerHealth.status}</span>
        </p>
        <ul className="mt-2 list-disc list-inside text-xs text-muted space-y-0.5">
          {report.workerHealth.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Card>

      <Card title="Revenue impact">
        <p className="text-sm">{report.revenueImpact.summary}</p>
        <p className="text-xs text-muted mt-1">
          {report.revenueImpact.estimatedPipelineInfluence}
        </p>
      </Card>
    </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
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
