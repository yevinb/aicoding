import Link from "next/link";
import { DEFAULT_REVENUE_TARGET } from "@/lib/analytics";
import { getCroReviews } from "@/lib/cro-store";
import { CroReport, RiskLevel } from "@/lib/types";
import { RunCroButton } from "@/components/run-cro-button";

export const dynamic = "force-dynamic";

export default async function CroPage() {
  const reviews = await getCroReviews();
  const latest: CroReport | undefined = reviews[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRO Command</h1>
          <p className="text-sm text-muted mt-1">
            The Chief Revenue Officer synthesizes every agent layer, diagnoses
            the revenue system, and directs what the organization does next.
          </p>
        </div>
        <RunCroButton
          defaultTarget={latest?.revenueTarget ?? DEFAULT_REVENUE_TARGET}
        />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No executive reviews yet. Set a revenue target and run a CRO
            review — the agent will observe, diagnose, prioritize, and direct
            the entire revenue organization.
          </p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}

      {reviews.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Previous reviews
          </h2>
          <ul className="space-y-2">
            {reviews.slice(1, 8).map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm flex items-center justify-between gap-3"
              >
                <span className="text-xs text-muted">
                  {new Date(r.timestamp).toLocaleString()}
                </span>
                <span className="text-xs">
                  Target ${r.revenueTarget.toLocaleString()} · P(hit){" "}
                  {r.revenueStatus.probabilityOfHittingTarget}% ·{" "}
                  {r.priorityActions.length} directives
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

function ReportView({ report }: { report: CroReport }) {
  const es = report.executiveSummary;
  const rs = report.revenueStatus;
  const emergencies = report.risks.filter((r) => r.emergency);

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest review: {new Date(report.timestamp).toLocaleString()} · target{" "}
        {money(report.revenueTarget)} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo (no API key)"} ·
        confidence: {report.confidence.level}
      </p>

      {emergencies.length > 0 && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-bad mb-2">
            Emergency flags
          </p>
          <ul className="space-y-1 text-sm">
            {emergencies.map((r, i) => (
              <li key={i}>
                <span className="font-medium">[{r.category}]</span> {r.description}{" "}
                <span className="text-muted">→ {r.mitigation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card title="Executive summary">
        <div className="space-y-3 text-sm">
          <p>{es.situation}</p>
          <p className="text-muted italic">{es.primaryQuestion}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-2 border-t border-line">
            <div>
              <p className="text-xs font-medium text-muted">Top priority</p>
              <p className="mt-0.5 font-medium text-accent">{es.topPriority}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Biggest upside</p>
              <p className="mt-0.5 text-good">{es.biggestUpside}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Do-nothing risk</p>
              <p className="mt-0.5 text-warn">{es.doNothingRisk}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Greatest threat</p>
              <p className="mt-0.5 text-bad">{es.greatestThreat}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Expected revenue" value={money(rs.expectedRevenue)} />
        <Stat
          label={rs.revenueGap > 0 ? "Revenue gap" : "Surplus"}
          value={money(Math.abs(rs.revenueGap))}
          tone={rs.revenueGap > 0 ? "bad" : "good"}
        />
        <Stat
          label="P(hit target)"
          value={`${rs.probabilityOfHittingTarget}%`}
          tone={
            rs.probabilityOfHittingTarget >= 70
              ? "good"
              : rs.probabilityOfHittingTarget >= 40
                ? "warn"
                : "bad"
          }
        />
        <Stat label="Forecast confidence" value={rs.forecastConfidence} />
      </div>

      <Card title="Revenue status">
        <ul className="space-y-1.5 text-sm">
          <li>{rs.progressToGoal}</li>
          <li className="text-muted">{rs.forecast}</li>
          <li className="text-xs text-muted mt-2">{rs.pipelineCoverage}</li>
        </ul>
      </Card>

      <Card title="Strategic diagnosis">
        <DiagnosisGrid
          label="Revenue gaps"
          items={report.strategicDiagnosis.revenueGaps}
        />
        <DiagnosisGrid
          label="Pipeline problems"
          items={report.strategicDiagnosis.pipelineProblems}
        />
        <DiagnosisGrid
          label="Conversion problems"
          items={report.strategicDiagnosis.conversionProblems}
        />
        <DiagnosisGrid
          label="Process failures"
          items={report.strategicDiagnosis.processFailures}
        />
        <DiagnosisGrid
          label="Market opportunities"
          items={report.strategicDiagnosis.marketOpportunities}
          good
        />
        <DiagnosisGrid
          label="Agent inefficiencies"
          items={report.strategicDiagnosis.agentInefficiencies}
          warn
        />
        <DiagnosisGrid
          label="Strategic risks"
          items={report.strategicDiagnosis.strategicRisks}
          warn
        />
      </Card>

      <Card title={`Priority directives (${report.priorityActions.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Agent</th>
                <th className="py-2 pr-4 font-medium">Impact</th>
                <th className="py-2 pr-4 font-medium">Urgency</th>
                <th className="py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {report.priorityActions.map((a) => (
                <tr key={a.rank} className="border-b border-line last:border-0 align-top">
                  <td className="py-2.5 pr-3 text-muted">{a.rank}</td>
                  <td className="py-2.5 pr-4 font-medium">{a.action}</td>
                  <td className="py-2.5 pr-4 text-muted whitespace-nowrap">
                    {a.responsibleAgent}
                  </td>
                  <td className="py-2.5 pr-4 text-muted">{a.expectedImpact}</td>
                  <td className="py-2.5 pr-4">
                    <PriorityBadge level={a.urgency} />
                  </td>
                  <td className="py-2.5">{a.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Pipeline direction">
          <Section label="Focus accounts" items={report.pipelineDirection.focusAccounts.map(
            (f) => (
              <span key={f.leadId}>
                <Link href={`/leads/${f.leadId}`} className="font-medium hover:text-accent transition">
                  {f.company}
                </Link>
                : {f.action}
              </span>
            )
          )} />
          <Section
            label="Intervention required"
            items={report.pipelineDirection.interventionRequired.map(
              (i) => `${i.company} — ${i.risk}: ${i.directive}`
            )}
            warn
          />
          <Section
            label="Abandon or nurture"
            items={report.pipelineDirection.abandonOrNurture.map(
              (a) => `${a.company}: ${a.reason}`
            )}
            muted
          />
          <ul className="mt-3 space-y-1 text-xs text-muted">
            <li>{report.pipelineDirection.coverageAssessment}</li>
            <li>{report.pipelineDirection.qualityAssessment}</li>
            <li>{report.pipelineDirection.velocityAssessment}</li>
          </ul>
        </Card>

        <Card title="Resource allocation">
          <AllocList label="More research" items={report.resourceAllocation.moreResearch} />
          <AllocList label="More outreach" items={report.resourceAllocation.moreOutreach} />
          <AllocList label="More follow-up" items={report.resourceAllocation.moreFollowUp} />
          <AllocList label="More meetings" items={report.resourceAllocation.moreMeetings} />
          <AllocList label="Reduce effort" items={report.resourceAllocation.reduceEffort} warn />
          <p className="text-xs text-muted mt-3 pt-3 border-t border-line">
            {report.resourceAllocation.rationale}
          </p>
        </Card>
      </div>

      <Card title="Agent management">
        <p className="text-sm mb-4 p-3 rounded-lg bg-accent-soft/50 border border-accent/20">
          <span className="text-xs font-medium text-accent uppercase tracking-wide">
            Orchestrator directive
          </span>
          <br />
          {report.agentManagement.orchestratorDirective}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {report.agentManagement.agents.map((a) => (
            <div
              key={a.agent}
              className="rounded-lg border border-line bg-surface-2/40 p-3.5 text-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium">{a.agent}</p>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    a.producingValue ? "bg-good/10 text-good" : "bg-warn/10 text-warn"
                  }`}
                >
                  {a.producingValue ? "Producing value" : "Needs attention"}
                </span>
              </div>
              <p className="text-xs text-muted">{a.assessment}</p>
              <p className="text-xs mt-1.5">→ {a.behaviorChange}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Strategic decisions (${report.strategicDecisions.length})`}>
        <ul className="space-y-3 text-sm">
          {report.strategicDecisions.map((d, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface-2/40 p-3.5">
              <p className="font-medium">{d.decision}</p>
              <p className="text-xs text-muted mt-1">{d.reason}</p>
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                <li><span className="text-foreground">Evidence:</span> {d.evidence}</li>
                <li><span className="text-foreground">Impact:</span> {d.expectedImpact}</li>
                <li><span className="text-foreground">Risk:</span> {d.risk}</li>
                <li><span className="text-foreground">Timeframe:</span> {d.timeframe} · {d.confidence} confidence</li>
              </ul>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Weekly operating review">
        <p className="text-sm mb-3">{report.weeklyOperatingReview.revenueSummary}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs font-medium text-good mb-1">Wins</p>
            <List items={report.weeklyOperatingReview.wins} />
          </div>
          <div>
            <p className="text-xs font-medium text-warn mb-1">Problems</p>
            <List items={report.weeklyOperatingReview.problems} />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-muted mb-2">Next week priorities</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                  <th className="py-2 pr-4 font-medium">Action</th>
                  <th className="py-2 pr-4 font-medium">Outcome</th>
                  <th className="py-2 pr-4 font-medium">Agent</th>
                  <th className="py-2 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {report.weeklyOperatingReview.nextWeekPriorities.map((p, i) => (
                  <tr key={i} className="border-b border-line last:border-0 align-top">
                    <td className="py-2 pr-4">{p.action}</td>
                    <td className="py-2 pr-4 text-muted">{p.expectedOutcome}</td>
                    <td className="py-2 pr-4 text-muted whitespace-nowrap">
                      {p.responsibleAgent}
                    </td>
                    <td className="py-2">
                      <PriorityBadge level={p.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card title={`Risks (${report.risks.length})`}>
        <ul className="space-y-2 text-sm">
          {report.risks.map((r, i) => (
            <li key={i} className="flex gap-2.5">
              <PriorityBadge level={r.level} />
              <div>
                <p>
                  <span className="text-xs text-muted">[{r.category}]</span>{" "}
                  {r.description}
                  {r.emergency && (
                    <span className="ml-1 text-[10px] font-medium text-bad uppercase">
                      Emergency
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted mt-0.5">Mitigation: {r.mitigation}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Evidence & assumptions">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
          <div>
            <p className="font-medium text-muted mb-1">Evidence used</p>
            <List items={report.confidence.evidenceUsed} muted />
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

function DiagnosisGrid({
  label,
  items,
  good,
  warn,
}: {
  label: string;
  items: string[];
  good?: boolean;
  warn?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p
        className={`text-xs font-medium mb-1 ${good ? "text-good" : warn ? "text-warn" : "text-muted"}`}
      >
        {label}
      </p>
      <List items={items} muted />
    </div>
  );
}

function Section({
  label,
  items,
  warn,
  muted,
}: {
  label: string;
  items: React.ReactNode[];
  warn?: boolean;
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className={`text-xs font-medium mb-1 ${warn ? "text-warn" : muted ? "text-muted" : "text-foreground"}`}>
        {label}
      </p>
      <ul className={`list-disc list-inside space-y-0.5 text-sm ${muted ? "text-muted" : ""}`}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function AllocList({
  label,
  items,
  warn,
}: {
  label: string;
  items: string[];
  warn?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2">
      <p className={`text-xs font-medium mb-0.5 ${warn ? "text-warn" : "text-muted"}`}>
        {label}
      </p>
      <p className="text-sm">{items.join(", ")}</p>
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
