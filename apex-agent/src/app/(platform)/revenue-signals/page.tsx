import Link from "next/link";
import { RunRevenueSignalsButton } from "@/components/run-revenue-signals-button";
import { getRevenueSignalReports } from "@/lib/revenue-signal-store";
import {
  RevenueOpportunityCandidate,
  RevenueSignal,
  RevenueSignalAlert,
  RevenueSignalMissionTrigger,
  RevenueSignalReport,
  RiskLevel,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RevenueSignalsPage() {
  const reports = await getRevenueSignalReports();
  const latest: RevenueSignalReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Revenue Signals</h1>
          <p className="text-sm text-muted mt-1">
            Real-time revenue radar: monitor events, score urgency and impact,
            raise alerts, and trigger autonomous workflows.
          </p>
        </div>
        <RunRevenueSignalsButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No signal cycles yet. Run a cycle to detect high-value events and
            activate downstream missions.
          </p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}
    </div>
  );
}

function ReportView({ report }: { report: RevenueSignalReport }) {
  const perf = report.signalPerformance;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo"} · confidence:{" "}
        {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Signals" value={String(perf.totalSignals)} />
        <Stat label="High Priority" value={String(perf.highPriorityCount)} />
        <Stat label="Opportunities" value={String(report.opportunitiesCreated.length)} />
        <Stat label="Missions" value={String(report.missionsTriggered.length)} />
        <Stat label="False Positive" value={perf.falsePositiveRate} />
      </div>

      <Card title="Market trends">
        <p className="text-sm">{report.marketTrends.summary}</p>
        <ul className="mt-3 list-disc list-inside text-xs text-muted space-y-0.5">
          {report.marketTrends.trendingSignals.slice(0, 5).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SignalList title={`Signals detected (${report.signalsDetected.length})`} signals={report.signalsDetected.slice(0, 12)} />
        <AlertList title={`High-priority alerts (${report.highPriorityAlerts.length})`} alerts={report.highPriorityAlerts} />
        <OpportunityList title={`Opportunities (${report.opportunitiesCreated.length})`} opportunities={report.opportunitiesCreated} />
        <MissionList title={`Missions triggered (${report.missionsTriggered.length})`} missions={report.missionsTriggered} />
      </div>

      <Card title="Signal performance">
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted">Average urgency</p>
            <p className="font-semibold">{perf.avgUrgency}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Average impact</p>
            <p className="font-semibold">{perf.avgImpact}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Category coverage</p>
            <p className="font-semibold">{perf.byCategory.length} types</p>
          </div>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {perf.byCategory.map((c) => (
            <li key={c.category} className="flex justify-between">
              <span>{c.category.replace("_", " ")}</span>
              <span>{c.count}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Learning">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <List label="Strongest signals" items={report.learning.strongestSignals} />
          <List label="Weak signals" items={report.learning.weakSignals} />
          <List label="Timing patterns" items={report.learning.timingPatterns} />
          <List label="Improvements" items={report.learning.improvements} />
        </div>
      </Card>
    </div>
  );
}

function SignalList({ title, signals }: { title: string; signals: RevenueSignal[] }) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {signals.map((s) => (
          <li key={s.id} className="rounded-lg border border-line p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{s.company}: {s.event}</p>
              <PriorityBadge level={signalPriority(s.priority)} />
            </div>
            <p className="text-xs text-muted mt-1">{s.source} · {s.date}</p>
            <p className="text-xs mt-1">{s.businessMeaning}</p>
            <p className="text-[10px] text-muted mt-1">
              urgency {s.urgency} · impact {s.revenueImpact} · confidence {s.confidence} · score {s.priority}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AlertList({ title, alerts }: { title: string; alerts: RevenueSignalAlert[] }) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {alerts.map((a) => (
          <li key={a.id} className="rounded-lg border border-warn/30 bg-warn/5 p-3">
            <p className="font-medium flex items-center gap-2">
              <PriorityBadge level={a.level} />
              {a.title}
            </p>
            <p className="text-xs text-muted mt-1">{a.reason}</p>
            <p className="text-[10px] text-muted mt-1">Window: {a.actionWindow}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function OpportunityList({
  title,
  opportunities,
}: {
  title: string;
  opportunities: RevenueOpportunityCandidate[];
}) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {opportunities.map((o) => (
          <li key={o.id} className="rounded-lg border border-line p-3">
            <p className="font-medium">
              {o.leadId ? <Link href={`/leads/${o.leadId}`} className="hover:text-accent">{o.company}</Link> : o.company}
            </p>
            <p className="text-xs text-muted mt-1">{o.reason}</p>
            <p className="text-xs mt-1">Value: {o.estimatedValue}</p>
            <p className="text-xs mt-1 text-good">→ {o.recommendedApproach}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MissionList({
  title,
  missions,
}: {
  title: string;
  missions: RevenueSignalMissionTrigger[];
}) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {missions.map((m) => (
          <li key={m.id} className="rounded-lg border border-line p-3">
            <p className="font-medium flex items-center gap-2">
              <PriorityBadge level={m.priority} />
              {m.name}
            </p>
            <p className="text-xs text-muted mt-1">{m.reason}</p>
            <p className="text-xs mt-1">Workflow: {m.recommendedWorkflow}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function List({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium mb-1">{label}</p>
      <ul className="list-disc list-inside text-xs text-muted space-y-0.5">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </div>
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

function signalPriority(score: number): RiskLevel {
  if (score >= 78) return "Critical";
  if (score >= 62) return "High";
  if (score >= 45) return "Medium";
  return "Low";
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
