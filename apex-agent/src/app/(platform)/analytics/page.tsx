import Link from "next/link";
import { DEFAULT_REVENUE_TARGET } from "@/lib/analytics";
import { getAnalyticsReports } from "@/lib/analytics-store";
import { AnalyticsReport, RiskLevel } from "@/lib/types";
import { RunAnalyticsButton } from "@/components/run-analytics-button";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const reports = await getAnalyticsReports();
  const latest: AnalyticsReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Revenue Intelligence</h1>
          <p className="text-sm text-muted mt-1">
            The Analytics Agent forecasts revenue, scores pipeline health,
            finds bottlenecks and hidden opportunities, and models scenarios —
            it analyzes and guides, never touches records.
          </p>
        </div>
        <RunAnalyticsButton
          defaultTarget={latest?.revenueTarget ?? DEFAULT_REVENUE_TARGET}
        />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No analyses yet. Set a revenue target and run an analysis — the
            agent will forecast against it, score seven health dimensions, and
            rank the actions with the highest expected value.
          </p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}

      {reports.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Previous analyses
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
                  Target ${r.revenueTarget.toLocaleString()} · expected $
                  {r.forecast.expectedRevenue.toLocaleString()} · health{" "}
                  <span className={scoreColor(r.pipelineHealth.overall.score)}>
                    {r.pipelineHealth.overall.score}
                  </span>
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

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function ReportView({ report }: { report: AnalyticsReport }) {
  const f = report.forecast;
  const h = report.pipelineHealth;
  const es = report.executiveSummary;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest analysis: {new Date(report.timestamp).toLocaleString()} · target{" "}
        {money(report.revenueTarget)} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo (no API key)"} ·
        confidence: {report.confidence.level}
      </p>

      <Card title="Executive summary">
        <div className="space-y-3 text-sm">
          <p>{es.currentSituation}</p>
          <p
            className={
              f.revenueGap > 0 ? "text-warn" : "text-good"
            }
          >
            {es.revenueOutlook}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted mb-1">Biggest opportunities</p>
              <List items={es.biggestOpportunities} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted mb-1">Biggest risks</p>
              <List items={es.biggestRisks} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted mb-1">Next 7 days</p>
              <List items={es.topActionsNext7Days} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted mb-1">Next 30 days</p>
              <List items={es.topActionsNext30Days} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Pipeline value" value={money(f.currentPipelineValue)} />
        <Stat label="Weighted pipeline" value={money(f.weightedPipelineValue)} />
        <Stat label="Expected revenue" value={money(f.expectedRevenue)} />
        <Stat
          label={f.revenueGap > 0 ? "Revenue gap" : "Surplus vs target"}
          value={money(Math.abs(f.revenueGap))}
          tone={f.revenueGap > 0 ? "bad" : "good"}
        />
        <Stat label="Best case" value={money(f.bestCase)} />
        <Stat label="Worst case" value={money(f.worstCase)} />
        <Stat
          label="P(hit target)"
          value={`${f.probabilityOfHittingTarget}%`}
          tone={f.probabilityOfHittingTarget >= 70 ? "good" : f.probabilityOfHittingTarget >= 40 ? "warn" : "bad"}
        />
        <Stat label="Forecast confidence" value={f.forecastConfidence} />
      </div>

      <Card title="Forecast assumptions">
        <p className="text-sm mb-2">Time to close: {f.timeToCloseEstimate}</p>
        <List items={f.assumptions} muted />
      </Card>

      <Card title="Pipeline health">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7 mb-4">
          {(
            [
              ["Coverage", h.pipelineCoverage],
              ["Quality", h.pipelineQuality],
              ["Velocity", h.dealVelocity],
              ["Opportunity", h.opportunityHealth],
              ["Forecast reliability", h.forecastReliability],
              ["Activity", h.activityHealth],
              ["Overall", h.overall],
            ] as const
          ).map(([label, s]) => (
            <div key={label} className="rounded-lg border border-line bg-surface-2/40 px-4 py-3">
              <p className={`text-xl font-semibold ${scoreColor(s.score)}`}>{s.score}</p>
              <p className="text-[11px] text-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <ul className="space-y-1.5 text-xs text-muted">
          {(
            [
              ["Coverage", h.pipelineCoverage],
              ["Quality", h.pipelineQuality],
              ["Velocity", h.dealVelocity],
              ["Opportunity health", h.opportunityHealth],
              ["Forecast reliability", h.forecastReliability],
              ["Activity", h.activityHealth],
              ["Overall", h.overall],
            ] as const
          ).map(([label, s]) => (
            <li key={label}>
              <span className="text-foreground">{label}:</span> {s.explanation}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`Bottlenecks (${h.bottlenecks.length})`}>
        {h.bottlenecks.length === 0 ? (
          <p className="text-sm text-muted">No bottlenecks detected.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {h.bottlenecks.map((b, i) => (
              <li key={i} className="rounded-lg border border-line bg-surface-2/40 p-3.5">
                <p className="flex items-center gap-2 font-medium">
                  <PriorityBadge level={b.priority} /> {b.problem}
                </p>
                <p className="text-xs text-muted mt-1.5">Evidence: {b.evidence}</p>
                <p className="text-xs text-muted mt-1">Impact: {b.businessImpact}</p>
                <p className="text-xs mt-1">Fix: {b.solution}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Funnel analysis">
          <table className="w-full text-sm mb-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="py-2 pr-4 font-medium">Entered</th>
                <th className="py-2 pr-4 font-medium">Converted</th>
                <th className="py-2 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {report.funnelAnalysis.stages.map((s, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4">{s.stage}</td>
                  <td className="py-2 pr-4">{s.entered}</td>
                  <td className="py-2 pr-4">{s.converted}</td>
                  <td className={`py-2 ${scoreColor(s.conversionRate)}`}>{s.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="space-y-1 text-xs text-muted">
            <li><span className="text-foreground">Strongest:</span> {report.funnelAnalysis.strongestStage}</li>
            <li><span className="text-foreground">Weakest:</span> {report.funnelAnalysis.weakestStage}</li>
            <li><span className="text-foreground">Biggest leak:</span> {report.funnelAnalysis.biggestRevenueLeak}</li>
            <li><span className="text-foreground">Improvement impact:</span> {report.funnelAnalysis.expectedImprovementImpact}</li>
          </ul>
        </Card>

        <Card title="Sales velocity">
          <p className="text-sm mb-2">
            Average active deal age:{" "}
            <span className="font-medium">{report.velocityAnalysis.averageDealAgeDays} days</span>
          </p>
          <ul className="space-y-1 text-xs text-muted mb-3">
            {report.velocityAnalysis.stageTimings.map((t, i) => (
              <li key={i}>
                <span className="text-foreground">{t.transition}:</span> {t.averageDays}
              </li>
            ))}
          </ul>
          <VelocityGroup label="Fast-moving" items={report.velocityAnalysis.fastMoving} tone="text-good" />
          <VelocityGroup label="Slow-moving" items={report.velocityAnalysis.slowMoving} tone="text-warn" />
          <VelocityGroup label="Stalled" items={report.velocityAnalysis.stalled} tone="text-bad" />
          {report.velocityAnalysis.reasonsForDelay.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted mb-1">Reasons for delay</p>
              <List items={report.velocityAnalysis.reasonsForDelay} muted />
            </div>
          )}
          <p className="text-xs mt-3">
            <span className="text-muted">Intervention:</span>{" "}
            {report.velocityAnalysis.recommendedIntervention}
          </p>
        </Card>

        <Card title={`Hidden opportunities (${report.opportunities.length})`}>
          {report.opportunities.length === 0 ? (
            <p className="text-sm text-muted">No hidden opportunities detected.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {report.opportunities.map((o, i) => (
                <li key={i}>
                  <p className="font-medium">
                    {o.leadId ? (
                      <Link href={`/leads/${o.leadId}`} className="hover:text-accent transition">
                        {o.company}
                      </Link>
                    ) : (
                      o.company
                    )}{" "}
                    — {o.type}{" "}
                    <span className="text-xs text-muted">({o.estimatedValue})</span>
                  </p>
                  <p className="text-xs text-muted mt-0.5">{o.whyItMatters}</p>
                  <p className="text-xs mt-0.5">Action: {o.recommendedAction}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={`Risks (${report.risks.length})`}>
          {report.risks.length === 0 ? (
            <p className="text-sm text-muted">No risks detected.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {report.risks.map((r, i) => (
                <li key={i} className="flex gap-2.5">
                  <PriorityBadge level={r.level} />
                  <div>
                    <p>
                      {r.leadId ? (
                        <Link href={`/leads/${r.leadId}`} className="font-medium hover:text-accent transition">
                          {r.company}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.company}</span>
                      )}
                      : {r.risk}
                    </p>
                    <p className="text-xs text-muted mt-0.5">Mitigation: {r.mitigation}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title={`Strategic recommendations (${report.recommendations.length})`}>
        {report.recommendations.length === 0 ? (
          <p className="text-sm text-muted">No recommendations — pipeline is fully worked.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Expected impact</th>
                  <th className="py-2 pr-4 font-medium">Revenue</th>
                  <th className="py-2 pr-4 font-medium">Effort</th>
                  <th className="py-2 pr-4 font-medium">Urgency</th>
                  <th className="py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {report.recommendations.map((r) => (
                  <tr key={r.rank} className="border-b border-line last:border-0 align-top">
                    <td className="py-2.5 pr-3 text-muted">{r.rank}</td>
                    <td className="py-2.5 pr-4">{r.action}</td>
                    <td className="py-2.5 pr-4 text-muted">{r.expectedImpact}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">{r.revenueOpportunity}</td>
                    <td className="py-2.5 pr-4">{r.effort}</td>
                    <td className="py-2.5 pr-4">
                      <PriorityBadge level={r.urgency} />
                    </td>
                    <td className="py-2.5">{r.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Scenario modeling">
          <ul className="space-y-3 text-sm">
            {report.scenarioModels.map((s, i) => (
              <li key={i}>
                <p className="font-medium">
                  {s.scenario} <span className="text-good">{s.estimatedRevenueImpact}</span>
                </p>
                <p className="text-xs text-muted mt-0.5">{s.explanation}</p>
                <p className="text-xs text-muted mt-0.5">Assumption: {s.assumption}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Team performance">
          <ul className="space-y-1.5 text-xs text-muted mb-3">
            <li><span className="text-foreground">Activity quality:</span> {report.teamPerformance.activityQuality}</li>
            <li><span className="text-foreground">Response times:</span> {report.teamPerformance.responseTimes}</li>
            <li><span className="text-foreground">Meetings:</span> {report.teamPerformance.meetingEffectiveness}</li>
            <li><span className="text-foreground">Outreach:</span> {report.teamPerformance.outreachPerformance}</li>
            <li><span className="text-foreground">Conversion:</span> {report.teamPerformance.conversionPerformance}</li>
            <li><span className="text-foreground">Follow-up discipline:</span> {report.teamPerformance.followUpDiscipline}</li>
          </ul>
          {report.teamPerformance.whatWorks.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted mb-1">What works</p>
              <List items={report.teamPerformance.whatWorks} />
            </>
          )}
          {report.teamPerformance.whatFails.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted mb-1 mt-2">What fails</p>
              <List items={report.teamPerformance.whatFails} />
            </>
          )}
          {report.teamPerformance.whatShouldChange.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted mb-1 mt-2">What should change</p>
              <List items={report.teamPerformance.whatShouldChange} />
            </>
          )}
        </Card>
      </div>

      <Card title="Facts, calculations, and assumptions">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <p className="font-medium text-muted mb-1">Facts (observed)</p>
            <List items={report.confidence.facts} muted />
          </div>
          <div>
            <p className="font-medium text-muted mb-1">Calculations</p>
            <List items={report.confidence.calculations} muted />
          </div>
          <div>
            <p className="font-medium text-muted mb-1">Assumptions</p>
            <List items={report.confidence.assumptions} muted />
          </div>
        </div>
        <p className="text-xs text-muted mt-3">{report.confidence.explanation}</p>
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

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "bad";
}) {
  const cls =
    tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "";
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <p className={`text-xl font-semibold ${cls}`}>{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function List({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul className={`list-disc list-inside space-y-0.5 ${muted ? "text-xs text-muted" : "text-sm"}`}>
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

function VelocityGroup({
  label,
  items,
  tone,
}: {
  label: string;
  items: { leadId: string; company: string; note: string }[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <p className={`text-xs font-medium mb-1 ${tone}`}>{label}</p>
      <ul className="space-y-0.5 text-xs text-muted">
        {items.map((v, i) => (
          <li key={i}>
            <Link href={`/leads/${v.leadId}`} className="text-foreground hover:text-accent transition">
              {v.company}
            </Link>
            : {v.note}
          </li>
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
