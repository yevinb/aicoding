import { RunLoopControllerButton } from "@/components/run-loop-controller-button";
import { getLoopReports } from "@/lib/loop-controller-store";
import { AutonomousLoopReport, RiskLevel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LoopPage() {
  const reports = await getLoopReports();
  const latest: AutonomousLoopReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Loop Controller</h1>
          <p className="text-sm text-muted mt-1">
            Permanent autonomous wake-observe-decide-act-verify heartbeat.
          </p>
        </div>
        <RunLoopControllerButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No loop cycles yet. Run one to coordinate full autonomous operation.
          </p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}
    </div>
  );
}

function ReportView({ report }: { report: AutonomousLoopReport }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · phase:{" "}
        {report.loopStatus.phase} · health: {report.loopStatus.systemHealth}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Observations" value={String(report.observations.length)} />
        <Stat label="Decisions" value={String(report.decisions.length)} />
        <Stat label="Triggered" value={String(report.actionsTriggered.length)} />
        <Stat label="Completed" value={String(report.completedWork.length)} />
        <Stat label="Blocked" value={String(report.blockedWork.length)} />
      </div>

      <Card title="Loop status">
        <p className="text-sm">{report.loopStatus.cycleSummary}</p>
        <p className="text-xs text-muted mt-1">Wake reason: {report.loopStatus.wakeReason}</p>
        <p className="text-xs text-muted">Next wake: {new Date(report.loopStatus.nextWake).toLocaleString()}</p>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Observations (${report.observations.length})`}>
          <ul className="space-y-2 text-sm">
            {report.observations.map((o, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <p className="font-medium flex items-center gap-2">
                  <PriorityBadge level={o.urgency} />
                  {o.area}: {o.change}
                </p>
                <p className="text-xs text-muted mt-1">{o.impact}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Decisions (${report.decisions.length})`}>
          <ul className="space-y-2 text-sm">
            {report.decisions.map((d, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <p className="font-medium">{d.decision}</p>
                <p className="text-xs text-muted mt-1">{d.reason}</p>
                <p className="text-xs mt-1">System: {d.assignedSystem}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Completed work (${report.completedWork.length})`}>
          <ul className="space-y-2 text-sm">
            {report.completedWork.map((w, i) => (
              <li key={i} className="rounded-lg border border-good/30 bg-good/5 p-3">
                <p className="font-medium">{w.system}</p>
                <p className="text-xs mt-1">{w.work}</p>
                <p className="text-xs text-muted mt-1">{w.result}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Blocked / approvals (${report.blockedWork.length + report.approvalsNeeded.length})`}>
          <ul className="space-y-2 text-sm">
            {report.blockedWork.map((b, i) => (
              <li key={`b-${i}`} className="rounded-lg border border-bad/30 bg-bad/5 p-3">
                <p className="font-medium">{b.system}</p>
                <p className="text-xs mt-1">{b.work}</p>
                <p className="text-xs text-muted mt-1">{b.reason}</p>
              </li>
            ))}
            {report.approvalsNeeded.map((a, i) => (
              <li key={`a-${i}`} className="rounded-lg border border-warn/30 bg-warn/5 p-3">
                <p className="font-medium flex items-center gap-2">
                  <PriorityBadge level={a.risk} />
                  {a.action}
                </p>
                <p className="text-xs text-muted mt-1">{a.reason}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
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
