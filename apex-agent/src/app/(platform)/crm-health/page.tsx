import Link from "next/link";
import { getAudits } from "@/lib/crm-audit-store";
import { CrmAuditReport, RiskLevel } from "@/lib/types";
import { RunAuditButton } from "@/components/run-audit-button";

export const dynamic = "force-dynamic";

export default async function CrmHealthPage() {
  const audits = await getAudits();
  const latest: CrmAuditReport | undefined = audits[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRM Health</h1>
          <p className="text-sm text-muted mt-1">
            The CRM Intelligence Agent audits every record for completeness,
            accuracy, and freshness — it maintains truth, not strategy.
          </p>
        </div>
        <RunAuditButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No audits yet. Run a CRM audit and the agent will check every
            record, detect issues and duplicates, apply evidence-based fixes,
            and report health scores.
          </p>
        </div>
      ) : (
        <AuditView report={latest} />
      )}

      {audits.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Previous audits
          </h2>
          <ul className="space-y-2">
            {audits.slice(1, 8).map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm flex items-center justify-between gap-3"
              >
                <span className="text-xs text-muted">
                  {new Date(a.timestamp).toLocaleString()}
                </span>
                <span className="text-xs">
                  Overall health:{" "}
                  <span className={scoreColor(a.crmHealth.overall.score)}>
                    {a.crmHealth.overall.score}
                  </span>{" "}
                  · {a.dataQualityIssues.length} issues
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function scoreColor(score: number): string {
  return score >= 75 ? "text-good" : score >= 55 ? "text-warn" : "text-bad";
}

function AuditView({ report }: { report: CrmAuditReport }) {
  const h = report.crmHealth;
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest audit: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo (no API key)"} ·
        confidence: {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {(
          [
            ["Completeness", h.dataCompleteness],
            ["Accuracy", h.dataAccuracy],
            ["Hygiene", h.opportunityHygiene],
            ["Pipeline confidence", h.pipelineConfidence],
            ["Overall health", h.overall],
          ] as const
        ).map(([label, s]) => (
          <div key={label} className="rounded-xl border border-line bg-surface px-5 py-4">
            <p className={`text-2xl font-semibold ${scoreColor(s.score)}`}>{s.score}</p>
            <p className="text-xs text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      <Card title={`Data quality issues (${report.dataQualityIssues.length})`}>
        {report.dataQualityIssues.length === 0 ? (
          <p className="text-sm text-muted">No issues found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                  <th className="py-2 pr-4 font-medium">Account</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Issue</th>
                  <th className="py-2 pr-4 font-medium">Recommendation</th>
                  <th className="py-2 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {report.dataQualityIssues.map((i, idx) => (
                  <tr key={idx} className="border-b border-line last:border-0 align-top">
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {i.leadId ? (
                        <Link href={`/leads/${i.leadId}`} className="hover:text-accent transition">
                          {i.company}
                        </Link>
                      ) : (
                        i.company || "Pipeline"
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-muted">{i.category}</td>
                    <td className="py-2.5 pr-4">{i.issue}</td>
                    <td className="py-2.5 pr-4 text-muted">{i.recommendation}</td>
                    <td className="py-2.5">
                      <PriorityBadge level={i.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Verified updates applied (${report.verifiedUpdates.length})`}>
          {report.verifiedUpdates.length === 0 ? (
            <p className="text-sm text-muted">
              No evidence-based corrections were needed this run.
            </p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {report.verifiedUpdates.map((u, i) => (
                <li key={i}>
                  <p>
                    <span className="text-good">✓</span>{" "}
                    <span className="font-medium">{u.company}</span>: {u.field}{" "}
                    <span className="text-muted">{u.from}</span> →{" "}
                    <span className="text-foreground">{u.to}</span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">{u.evidence}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Recommended actions (${report.recommendedActions.length})`}>
          <ul className="space-y-2.5 text-sm">
            {report.recommendedActions.map((a, i) => (
              <li key={i} className="flex gap-2.5">
                <PriorityBadge level={a.priority} />
                <div>
                  <p>{a.action}</p>
                  <p className="text-xs text-muted mt-0.5">{a.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Pipeline risks (${report.pipelineRisks.length})`}>
          {report.pipelineRisks.length === 0 ? (
            <p className="text-sm text-muted">No pipeline risks detected.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {report.pipelineRisks.map((r, i) => (
                <li key={i}>
                  <p className="font-medium">
                    <Link href={`/leads/${r.leadId}`} className="hover:text-accent transition">
                      {r.company}
                    </Link>
                    : {r.risk}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Impact: {r.impact} · Mitigation: {r.mitigation}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Duplicate detection (${report.duplicateDetection.length})`}>
          {report.duplicateDetection.length === 0 ? (
            <p className="text-sm text-muted">No possible duplicates found.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {report.duplicateDetection.map((d, i) => (
                <li key={i}>
                  <p className="font-medium">
                    {d.companies.join(" ↔ ")}{" "}
                    <span className="text-xs text-muted">
                      ({d.confidence}% confidence, matched on {d.matchedOn})
                    </span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">{d.recommendation}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={`Agent notifications (${report.agentNotifications.length})`}>
        {report.agentNotifications.length === 0 ? (
          <p className="text-sm text-muted">All agents are working with current data.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {report.agentNotifications.map((n, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent whitespace-nowrap">
                  {n.agent.replace(" Agent", "")}
                </span>
                <span>
                  <Link href={`/leads/${n.leadId}`} className="font-medium hover:text-accent transition">
                    {n.company}
                  </Link>
                  : {n.notification}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Customer memory">
          {report.memoryUpdates.customerMemory.length === 0 ? (
            <p className="text-sm text-muted">No durable customer facts recorded yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {report.memoryUpdates.customerMemory.map((m, i) => (
                <li key={i}>
                  <p className="font-medium">
                    <Link href={`/leads/${m.leadId}`} className="hover:text-accent transition">
                      {m.company}
                    </Link>
                  </p>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs text-muted">
                    {m.facts.map((f, j) => (
                      <li key={j}>{f}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Sales memory">
          <MemoryList label="What worked" items={report.memoryUpdates.salesMemory.whatWorked} />
          <MemoryList label="What failed" items={report.memoryUpdates.salesMemory.whatFailed} />
          <MemoryList label="Objections seen" items={report.memoryUpdates.salesMemory.objectionsSeen} />
          <MemoryList label="Competitive intel" items={report.memoryUpdates.salesMemory.competitiveIntel} />
          <MemoryList label="Buying patterns" items={report.memoryUpdates.salesMemory.buyingPatterns} />
        </Card>
      </div>

      <Card title="Score explanations">
        <ul className="space-y-1.5 text-xs text-muted">
          <li><span className="text-foreground">Completeness:</span> {h.dataCompleteness.explanation}</li>
          <li><span className="text-foreground">Accuracy:</span> {h.dataAccuracy.explanation}</li>
          <li><span className="text-foreground">Hygiene:</span> {h.opportunityHygiene.explanation}</li>
          <li><span className="text-foreground">Pipeline confidence:</span> {h.pipelineConfidence.explanation}</li>
          <li><span className="text-foreground">Overall:</span> {h.overall.explanation}</li>
          <li><span className="text-foreground">Audit confidence:</span> {report.confidence.explanation}</li>
        </ul>
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

function MemoryList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs font-medium text-muted mb-1">{label}</p>
      <ul className="list-disc list-inside space-y-0.5 text-sm">
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
