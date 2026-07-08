import Link from "next/link";
import { getReports } from "@/lib/report-store";
import { OrchestratorReport } from "@/lib/types";
import { RunCycleButton } from "@/components/run-cycle-button";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const reports = await getReports();
  const latest: OrchestratorReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Command Center</h1>
          <p className="text-sm text-muted mt-1">
            ApexGrowth runs its full operating loop — observe, analyze, plan, execute,
            learn — across the entire pipeline and reports back.
          </p>
        </div>
        <RunCycleButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No cycles run yet. Click “Run orchestration cycle” and ApexGrowth will
            score every lead, execute the highest-value actions, update the
            CRM, and produce its report.
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
            {reports.slice(1, 10).map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm"
              >
                <p className="text-xs text-muted">
                  {new Date(r.timestamp).toLocaleString()} · engine:{" "}
                  {r.engine === "openai" ? "OpenAI" : "demo"}
                </p>
                <p className="mt-1 line-clamp-2 text-muted">
                  {r.executiveSummary}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReportView({ report }: { report: OrchestratorReport }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo (no API key)"}
      </p>

      <Card title="1 · Executive summary">
        <p className="text-sm leading-relaxed">{report.executiveSummary}</p>
      </Card>

      <Card title="2 · Highest priority opportunities">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                <th className="py-2 pr-4 font-medium">Lead</th>
                <th className="py-2 pr-4 font-medium text-right">Priority</th>
                <th className="py-2 pr-4 font-medium text-right">Fit</th>
                <th className="py-2 pr-4 font-medium text-right">Intent</th>
                <th className="py-2 pr-4 font-medium text-right">Urgency</th>
                <th className="py-2 pr-4 font-medium text-right">Relation</th>
                <th className="py-2 pr-4 font-medium text-right">Close %</th>
                <th className="py-2 font-medium text-right">Exp. revenue</th>
              </tr>
            </thead>
            <tbody>
              {report.highestPriorityOpportunities.map((o) => (
                <tr key={o.leadId} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/leads/${o.leadId}`}
                      className="font-medium hover:text-accent transition"
                    >
                      {o.contactName}
                    </Link>
                    <span className="block text-xs text-muted">{o.company}</span>
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold text-accent">
                    {o.priorityScore}
                  </td>
                  <td className="py-3 pr-4 text-right">{o.icpFit}</td>
                  <td className="py-3 pr-4 text-right">{o.buyingIntent}</td>
                  <td className="py-3 pr-4 text-right">{o.urgency}</td>
                  <td className="py-3 pr-4 text-right">{o.relationshipStrength}</td>
                  <td className="py-3 pr-4 text-right">{o.closeProbability}%</td>
                  <td className="py-3 text-right font-medium">
                    ${o.expectedRevenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {report.highestPriorityOpportunities.map((o) => (
            <li key={o.leadId}>
              <span className="text-foreground">{o.company}:</span> {o.rationale}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="3 · Actions completed">
          <ul className="space-y-2.5 text-sm">
            {report.actionsCompleted.map((a, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent whitespace-nowrap">
                  {a.agent.replace(" Agent", "")}
                </span>
                <span>{a.description}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="4 · Actions in progress">
          {report.actionsInProgress.length > 0 ? (
            <ul className="space-y-1.5 text-sm list-disc list-inside">
              {report.actionsInProgress.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing in progress.</p>
          )}
        </Card>

        <Card title="5 · Risks">
          <ul className="space-y-1.5 text-sm">
            {report.risks.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-warn mt-0.5">⚠</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="6 · Recommended next actions">
          <ol className="space-y-1.5 text-sm list-decimal list-inside">
            {report.recommendedNextActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </Card>
      </div>

      <Card title="7 · CRM changes applied">
        <ul className="space-y-1.5 text-sm">
          {report.crmChanges.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-good mt-0.5">✓</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="8 · Confidence assessment">
        <p className="text-sm leading-relaxed">{report.confidenceAssessment}</p>
      </Card>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}
