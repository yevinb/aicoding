import Link from "next/link";
import { getMissionBriefings } from "@/lib/mission-control-store";
import { Mission, MissionControlReport, MissionStatus, RiskLevel } from "@/lib/types";
import { RunMissionControlButton } from "@/components/run-mission-control-button";

export const dynamic = "force-dynamic";

export default async function MissionControlPage() {
  const briefings = await getMissionBriefings();
  const latest: MissionControlReport | undefined = briefings[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mission Control</h1>
          <p className="text-sm text-muted mt-1">
            The COO layer — observe, understand, create missions, assign agents,
            execute safely, and measure outcomes across the revenue organization.
          </p>
        </div>
        <RunMissionControlButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No briefings yet. Run a cycle and Mission Control will detect
            opportunities, create prioritized missions, delegate to specialist
            agents, and track execution.
          </p>
        </div>
      ) : (
        <BriefingView report={latest} />
      )}

      {briefings.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Previous briefings
          </h2>
          <ul className="space-y-2">
            {briefings.slice(1, 8).map((b) => (
              <li
                key={b.id}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm flex justify-between gap-3"
              >
                <span className="text-xs text-muted">
                  {new Date(b.timestamp).toLocaleString()}
                </span>
                <span className="text-xs">
                  {b.missionsCreated.length} created · {b.missionsCompleted.length}{" "}
                  completed · {b.missionsActive.length} active
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BriefingView({ report }: { report: MissionControlReport }) {
  const rs = report.revenueSituation;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest briefing: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo"} · confidence:{" "}
        {report.confidence.level}
      </p>

      <Card title="Revenue situation">
        <p className="text-sm">{rs.summary}</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted">Pipeline</p>
            <p className="font-semibold">{rs.pipelineValue}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Active accounts</p>
            <p className="font-semibold">{rs.activeAccounts}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Revenue gap</p>
            <p className={`font-semibold ${rs.revenueGap ? "text-warn" : "text-good"}`}>
              {rs.revenueGap ?? "On track"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Urgent</p>
            <p className="font-semibold">{rs.urgentItems.length}</p>
          </div>
        </div>
        {rs.urgentItems.length > 0 && (
          <ul className="mt-3 list-disc list-inside text-xs text-muted">
            {rs.urgentItems.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MissionList
          title={`Missions created (${report.missionsCreated.length})`}
          missions={report.missionsCreated}
          empty="No new missions this cycle."
        />
        <MissionList
          title={`Active missions (${report.missionsActive.length})`}
          missions={report.missionsActive}
          empty="No active missions."
        />
        <MissionList
          title={`Completed (${report.missionsCompleted.length})`}
          missions={report.missionsCompleted}
          empty="No missions completed this cycle."
          done
        />
        <MissionList
          title={`Blocked / awaiting approval (${report.blockedMissions.length})`}
          missions={report.blockedMissions}
          empty="No blocked missions."
          warn
        />
      </div>

      <Card title={`Risks (${report.risks.length})`}>
        <ul className="space-y-2 text-sm">
          {report.risks.map((r, i) => (
            <li key={i} className="flex gap-2">
              <PriorityBadge level={r.level} />
              <span>
                {r.description}
                <span className="text-muted"> → {r.mitigation}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Human recommendations (${report.recommendations.length})`}>
        <ul className="space-y-3 text-sm">
          {report.recommendations.map((r, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface-2/40 p-3">
              <p className="flex items-center gap-2 font-medium">
                <PriorityBadge level={r.priority} />
                {r.action}
                {r.humanRequired && (
                  <span className="text-[10px] uppercase tracking-wide text-warn">
                    Human required
                  </span>
                )}
              </p>
              <p className="text-xs text-muted mt-1">{r.reason}</p>
            </li>
          ))}
        </ul>
      </Card>

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
            <p className="text-xs font-medium text-muted mb-1">Improvements</p>
            <List items={report.learning.improvements} />
          </div>
        </div>
      </Card>

      <p className="text-xs text-muted">{report.confidence.explanation}</p>
    </div>
  );
}

function MissionList({
  title,
  missions,
  empty,
  done,
  warn,
}: {
  title: string;
  missions: Mission[];
  empty: string;
  done?: boolean;
  warn?: boolean;
}) {
  return (
    <Card title={title}>
      {missions.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {missions.map((m) => (
            <li
              key={m.id}
              className={`rounded-lg border p-3 text-sm ${
                warn
                  ? "border-warn/30 bg-warn/5"
                  : done
                    ? "border-good/30 bg-good/5"
                    : "border-line bg-surface-2/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">
                  <Link href={`/leads/${m.leadId}`} className="hover:text-accent transition">
                    {m.name}
                  </Link>
                </p>
                <StatusBadge status={m.status} />
              </div>
              <p className="text-xs text-muted mt-1">{m.reason}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {m.requiredAgents.map((a) => (
                  <span
                    key={a}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-accent-soft text-accent"
                  >
                    {a.replace(" Agent", "")}
                  </span>
                ))}
              </div>
              <p className="text-xs mt-2">
                <span className="text-muted">Success:</span> {m.successCriteria}
              </p>
              {m.actualOutcome && (
                <p className="text-xs mt-1 text-good">→ {m.actualOutcome}</p>
              )}
              <p className="text-[10px] text-muted mt-1.5">
                Deadline {m.deadline} · {m.priority} priority · step{" "}
                {m.currentStep}/{m.requiredAgents.length}
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

function StatusBadge({ status }: { status: MissionStatus }) {
  const cls: Record<MissionStatus, string> = {
    created: "bg-surface-2 text-muted",
    assigned: "bg-accent-soft text-accent",
    running: "bg-accent/20 text-accent",
    completed: "bg-good/10 text-good",
    failed: "bg-bad/10 text-bad",
    blocked: "bg-warn/10 text-warn",
    waiting_approval: "bg-warn/20 text-warn",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cls[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
