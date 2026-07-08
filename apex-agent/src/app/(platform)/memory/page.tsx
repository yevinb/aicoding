import { RunMemoryGraphButton } from "@/components/run-memory-graph-button";
import { getMemoryGraphReports } from "@/lib/memory-graph";
import { MemoryGraphReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const reports = await getMemoryGraphReports();
  const latest: MemoryGraphReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Memory Graph</h1>
          <p className="text-sm text-muted mt-1">
            Long-term customer, conversation, action, and outcome memory with knowledge relationships.
          </p>
        </div>
        <RunMemoryGraphButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">No memory cycles yet.</p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}
    </div>
  );
}

function ReportView({ report }: { report: MemoryGraphReport }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · confidence {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Created" value={String(report.memoriesCreated.length)} />
        <Stat label="Updated" value={String(report.memoriesUpdated.length)} />
        <Stat label="Relationships" value={String(report.relationshipsCreated.length)} />
        <Stat label="Insights" value={String(report.insightsGenerated.length)} />
        <Stat label="Retrievals" value={String(report.retrievalResults.length)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Important memories">
          <ul className="space-y-2 text-sm">
            {report.memoriesCreated.slice(0, 10).map((m) => (
              <li key={m.id} className="rounded-lg border border-line p-3">
                <p className="font-medium">{m.title}</p>
                <p className="text-xs text-muted mt-1">{m.entityType} · {m.importance} · {m.confidence}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Knowledge relationships">
          <ul className="space-y-2 text-sm">
            {report.relationshipsCreated.slice(0, 12).map((r) => (
              <li key={r.id} className="rounded-lg border border-line p-3">
                <p className="font-medium">{r.fromType}:{r.fromId} → {r.toType}:{r.toId}</p>
                <p className="text-xs text-muted mt-1">{r.relation} · {r.confidence}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Insights">
          <ul className="space-y-2 text-sm">
            {report.insightsGenerated.map((i) => (
              <li key={i.id} className="rounded-lg border border-line p-3">
                <p className="font-medium">{i.type.replace("_", " ")}</p>
                <p className="text-xs mt-1">{i.insight}</p>
                <p className="text-xs text-muted mt-1">→ {i.recommendation}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Retrieval results">
          <ul className="space-y-2 text-sm">
            {report.retrievalResults.map((r, idx) => (
              <li key={idx} className="rounded-lg border border-line p-3">
                <p className="font-medium">{r.query}</p>
                <p className="text-xs text-muted mt-1">{r.matches.length} matches</p>
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
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
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
