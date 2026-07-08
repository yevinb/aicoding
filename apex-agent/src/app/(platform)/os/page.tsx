import Link from "next/link";
import { getEmployeeOsReports } from "@/lib/employee-os-store";
import { EmployeeOsReport, RiskLevel } from "@/lib/types";
import { RunOsButton } from "@/components/run-os-button";

export const dynamic = "force-dynamic";

export default async function RevenueOsPage() {
  const reports = await getEmployeeOsReports();
  const latest: EmployeeOsReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Revenue Employee OS</h1>
          <p className="text-sm text-muted mt-1">
            Apex operates autonomously — observe, think, plan, execute — and
            delegates to every specialist agent without waiting for instructions.
          </p>
        </div>
        <RunOsButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No workday cycles yet. Run a cycle and Apex will observe the full
            pipeline, prioritize the highest-value actions, delegate to
            specialist agents, and report what changed.
          </p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}

      {reports.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Previous workdays
          </h2>
          <ul className="space-y-2">
            {reports.slice(1, 8).map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm flex items-center justify-between gap-3"
              >
                <span className="text-xs text-muted">
                  {new Date(r.timestamp).toLocaleString()}
                </span>
                <span className="text-xs">
                  {r.completedWork.length} executed · {r.opportunityDiscovery.length}{" "}
                  opportunities
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReportView({ report }: { report: EmployeeOsReport }) {
  const loop = report.operatingLoop;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest workday: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo (no API key)"} ·
        confidence: {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Actions executed" value={String(report.completedWork.length)} />
        <Stat label="Artifacts created" value={String(report.pipelineImpact.artifactsCreated)} />
        <Stat label="Opportunities flagged" value={String(report.opportunityDiscovery.length)} />
        <Stat label="Qualified pipeline" value={String(report.performanceMetrics.qualifiedOpportunities)} />
      </div>

      <Card title="Operating loop">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 text-sm">
          <LoopPhase title="1 · Observe" summary={loop.observe.summary}>
            <List label="Changes" items={loop.observe.changesDetected} />
            <List label="Risks" items={loop.observe.risksIdentified} warn />
            <List label="Actions required" items={loop.observe.actionsRequired} />
          </LoopPhase>
          <LoopPhase title="2 · Think" summary={loop.think.highestImpactAction}>
            <p className="text-muted text-xs mt-1">{loop.think.reasoning}</p>
            <List label="Alternatives considered" items={loop.think.alternativesConsidered} muted />
          </LoopPhase>
          <LoopPhase title="3 · Plan" summary={`${loop.plan.tasks.length} tasks queued`}>
            <ul className="mt-2 space-y-2 text-xs">
              {loop.plan.tasks.slice(0, 5).map((t, i) => (
                <li key={i} className="rounded border border-line p-2">
                  <p className="font-medium flex items-center gap-2">
                    <PriorityBadge level={t.priority} /> {t.task}
                  </p>
                  <p className="text-muted mt-0.5">{t.reason}</p>
                  <p className="mt-0.5">{t.agent} · {t.executed ? "✓ executed" : "queued"}</p>
                </li>
              ))}
            </ul>
          </LoopPhase>
          <LoopPhase title="4 · Execute" summary={loop.execute.summary}>
            <List label="Agents delegated" items={loop.execute.delegatedAgents} good />
          </LoopPhase>
        </div>
      </Card>

      <Card title="Revenue brief">
        <List label="What changed" items={report.revenueBrief.whatChanged} />
        <List label="Market signals" items={report.revenueBrief.marketSignals} />
        <p className="text-sm mt-2 text-muted">{report.revenueBrief.pipelineSnapshot}</p>
      </Card>

      <Card title={`Opportunity discovery (${report.opportunityDiscovery.length})`}>
        {report.opportunityDiscovery.length === 0 ? (
          <p className="text-sm text-muted">No new opportunities flagged.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {report.opportunityDiscovery.map((o, i) => (
              <li key={i} className="rounded-lg border border-line bg-surface-2/40 p-3.5">
                <p className="font-medium">
                  {o.leadId ? (
                    <Link href={`/leads/${o.leadId}`} className="hover:text-accent transition">
                      {o.company}
                    </Link>
                  ) : (
                    o.company
                  )}{" "}
                  <span className="text-xs text-muted">
                    · fit {o.fitScore} · {o.source === "market_discovery" ? "market scan" : "pipeline"}
                  </span>
                </p>
                {o.signals.slice(0, 2).map((s, j) => (
                  <div key={j} className="mt-2 text-xs">
                    <span className={`font-medium ${signalColor(s.rank)}`}>[{s.rank}]</span>{" "}
                    {s.signal} — {s.whyItMatters}
                    <p className="text-muted mt-0.5">Angle: {s.messageAngle}</p>
                  </div>
                ))}
                <p className="text-xs mt-1.5">→ {o.recommendedAction}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Completed work (${report.completedWork.length})`}>
        {report.completedWork.length === 0 ? (
          <p className="text-sm text-muted">No tasks executed this cycle.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {report.completedWork.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-good shrink-0">✓</span>
                <span>
                  <span className="text-xs text-muted">{w.agent}</span>{" "}
                  <Link href={`/leads/${w.leadId}`} className="font-medium hover:text-accent transition">
                    {w.company}
                  </Link>
                  : {w.outcome}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Pipeline impact">
          <p className="text-sm font-medium text-good">{report.pipelineImpact.expectedRevenueDelta}</p>
          <p className="text-xs text-muted mt-1">{report.pipelineImpact.explanation}</p>
        </Card>
        <Card title="Performance">
          <p className="text-sm">{report.performanceMetrics.summary}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Memory snapshot">
          {report.memorySnapshot.accountFacts.length === 0 ? (
            <p className="text-sm text-muted">No durable account memory yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.memorySnapshot.accountFacts.slice(0, 4).map((m) => (
                <li key={m.leadId}>
                  <Link href={`/leads/${m.leadId}`} className="font-medium hover:text-accent transition">
                    {m.company}
                  </Link>
                  <ul className="list-disc list-inside text-xs text-muted mt-0.5">
                    {m.facts.slice(0, 3).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
          {report.memorySnapshot.salesPatterns.length > 0 && (
            <div className="mt-3 pt-3 border-t border-line">
              <p className="text-xs font-medium text-muted mb-1">Sales patterns applied</p>
              <List items={report.memorySnapshot.salesPatterns} muted />
            </div>
          )}
        </Card>
        <Card title="Learning">
          <List label="What improved" items={report.learning.whatImproved} good />
          <List label="What to change" items={report.learning.whatToChange} />
          <List label="Patterns applied" items={report.learning.patternsApplied} muted />
        </Card>
      </div>

      <Card title={`Risks (${report.risks.length})`}>
        <ul className="space-y-2 text-sm">
          {report.risks.map((r, i) => (
            <li key={i} className="flex gap-2">
              <PriorityBadge level={r.level} />
              <span>{r.description} <span className="text-muted">→ {r.mitigation}</span></span>
            </li>
          ))}
        </ul>
      </Card>

      <p className="text-xs text-muted">{report.confidence.explanation}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function LoopPhase({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">{title}</p>
      <p className="font-medium mt-1">{summary}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function List({
  label,
  items,
  muted,
  good,
  warn,
}: {
  label?: string;
  items: string[];
  muted?: boolean;
  good?: boolean;
  warn?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2 last:mb-0">
      {label && (
        <p
          className={`text-xs font-medium mb-0.5 ${good ? "text-good" : warn ? "text-warn" : "text-muted"}`}
        >
          {label}
        </p>
      )}
      <ul className={`list-disc list-inside space-y-0.5 ${muted ? "text-xs text-muted" : "text-sm"}`}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
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

function signalColor(rank: string): string {
  return rank === "Critical" || rank === "High"
    ? "text-bad"
    : rank === "Medium"
      ? "text-warn"
      : "text-muted";
}
