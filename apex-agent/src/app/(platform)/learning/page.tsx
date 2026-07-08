import Link from "next/link";
import { getLearningReports } from "@/lib/learning-store";
import {
  AgentPerformanceReview,
  LearningReport,
  RiskLevel,
} from "@/lib/types";
import { RunLearningButton } from "@/components/run-learning-button";

export const dynamic = "force-dynamic";

export default async function LearningPage() {
  const reports = await getLearningReports();
  const latest: LearningReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Learning & Optimization</h1>
          <p className="text-sm text-muted mt-1">
            The Learning Agent analyzes every action and outcome to make every
            other agent better — it discovers what works, what fails, and why.
          </p>
        </div>
        <RunLearningButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No learning cycles yet. Run a cycle and the agent will analyze
            outreach, replies, meetings, agent performance, and pipeline
            patterns — then recommend experiments and improvements ranked by
            expected ROI.
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
            {reports.slice(1, 8).map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm flex items-center justify-between gap-3"
              >
                <span className="text-xs text-muted">
                  {new Date(r.timestamp).toLocaleString()}
                </span>
                <span className="text-xs">
                  {r.recommendations.length} recommendations · improvement
                  potential{" "}
                  <span
                    className={scoreColor(
                      r.performanceAnalysis.optimizationScore
                        .revenueImprovementPotential.score
                    )}
                  >
                    {
                      r.performanceAnalysis.optimizationScore
                        .revenueImprovementPotential.score
                    }
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

function ReportView({ report }: { report: LearningReport }) {
  const opt = report.performanceAnalysis.optimizationScore;
  const es = report.executiveSummary;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo (no API key)"} ·
        confidence: {report.confidence.level}
      </p>

      <Card title="Executive learning summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <SummaryBlock label="What ApexGrowth learned" items={es.whatApexLearned} />
          <SummaryBlock label="What improved" items={es.whatImproved} good />
          <SummaryBlock label="What declined" items={es.whatDeclined} warn />
          <SummaryBlock label="What should change" items={es.whatShouldChange} />
          <SummaryBlock label="What should stop" items={es.whatShouldStop} />
          <SummaryBlock label="Test next" items={es.whatShouldBeTestedNext} />
        </div>
        <p className="text-sm mt-4 pt-3 border-t border-line">
          <span className="text-muted">Expected revenue impact:</span>{" "}
          {es.expectedRevenueImpact}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {(
          [
            ["Improvement potential", opt.revenueImprovementPotential],
            ["Confidence", opt.confidence],
            ["Evidence strength", opt.evidenceStrength],
            ["Ease of implementation", opt.implementationDifficulty],
            ["Expected ROI", opt.expectedRoi],
          ] as const
        ).map(([label, s]) => (
          <div key={label} className="rounded-xl border border-line bg-surface px-5 py-4">
            <p className={`text-2xl font-semibold ${scoreColor(s.score)}`}>{s.score}</p>
            <p className="text-xs text-muted mt-1">{label}</p>
          </div>
        ))}
      </div>

      <Card title="Prospecting performance">
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                <th className="py-2 pr-4 font-medium">Dimension</th>
                <th className="py-2 pr-4 font-medium">Segment</th>
                <th className="py-2 pr-4 font-medium">Leads</th>
                <th className="py-2 pr-4 font-medium">Engaged</th>
                <th className="py-2 pr-4 font-medium">Rate</th>
                <th className="py-2 pr-4 font-medium">Avg priority</th>
                <th className="py-2 font-medium">Assessment</th>
              </tr>
            </thead>
            <tbody>
              {report.performanceAnalysis.prospecting.segments.map((s, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-4 text-muted">{s.dimension}</td>
                  <td className="py-2.5 pr-4">{s.value}</td>
                  <td className="py-2.5 pr-4">{s.leads}</td>
                  <td className="py-2.5 pr-4">{s.engaged}</td>
                  <td className={`py-2.5 pr-4 ${scoreColor(s.conversionRate)}`}>
                    {s.conversionRate}%
                  </td>
                  <td className="py-2.5 pr-4">{s.avgPriority ?? "—"}</td>
                  <td className="py-2.5">
                    <AssessmentBadge value={s.assessment} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <div>
            <p className="text-xs font-medium text-muted mb-1">Highest performing</p>
            <List items={report.performanceAnalysis.prospecting.highestPerforming} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-1">Lowest performing</p>
            <List items={report.performanceAnalysis.prospecting.lowestPerforming} />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-xs font-medium text-muted mb-1">Recommended targeting changes</p>
          <List items={report.performanceAnalysis.prospecting.targetingChanges} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Outreach optimization">
          <InsightList label="Positive reply patterns" items={report.outreachOptimization.patternsBehindPositiveReplies} />
          <InsightList label="Ignored message patterns" items={report.outreachOptimization.patternsBehindIgnoredMessages} />
          <InsightList label="Objection patterns" items={report.outreachOptimization.patternsBehindObjections} />
          <InsightList label="Channel insights" items={report.outreachOptimization.channelInsights} />
          <InsightList label="Timing insights" items={report.outreachOptimization.timingInsights} />
          <InsightList label="Improved strategies" items={report.outreachOptimization.improvedStrategies} />
        </Card>

        <Card title="Message intelligence">
          <InsightList label="Words that improve responses" items={report.messageInsights.wordsThatImproveResponses} />
          <InsightList label="Words that reduce responses" items={report.messageInsights.wordsThatReduceResponses} />
          <InsightList label="Effective value props" items={report.messageInsights.effectiveValuePropositions} />
          <InsightList label="Effective pain points" items={report.messageInsights.effectivePainPoints} />
          <InsightList label="Effective CTAs" items={report.messageInsights.effectiveCtas} />
          <InsightList label="Themes to continue" items={report.messageInsights.themesToContinue} good />
          <InsightList label="Themes to stop" items={report.messageInsights.themesToStop} warn />
        </Card>
      </div>

      <Card title={`Process improvements (${report.processImprovements.length})`}>
        <ul className="space-y-3 text-sm">
          {report.processImprovements.map((p, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface-2/40 p-3.5">
              <p className="flex items-center gap-2 font-medium">
                <TypeBadge type={p.type} /> {p.stage}
              </p>
              <p className="mt-1">{p.finding}</p>
              <p className="text-xs text-muted mt-1">Evidence: {p.evidence}</p>
              <p className="text-xs mt-1">→ {p.recommendation}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Agent performance review">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["Research", report.agentPerformance.researchAgent],
              ["Planning", report.agentPerformance.planningAgent],
              ["Outreach", report.agentPerformance.outreachAgent],
              ["Reply", report.agentPerformance.replyAgent],
              ["Meeting", report.agentPerformance.meetingAgent],
              ["Analytics", report.agentPerformance.analyticsAgent],
              ["CRM", report.agentPerformance.crmAgent],
            ] as const
          ).map(([name, agent]) => (
            <AgentCard key={name} name={name} agent={agent} />
          ))}
        </div>
      </Card>

      <Card title={`Experiments (${report.experiments.length})`}>
        <ul className="space-y-3 text-sm">
          {report.experiments.map((e, i) => (
            <li key={i} className="rounded-lg border border-line bg-surface-2/40 p-3.5">
              <p className="font-medium flex items-center gap-2">
                <PriorityBadge level={e.priority === "High" ? "High" : e.priority === "Medium" ? "Medium" : "Low"} />
                {e.hypothesis}
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-muted">
                <li><span className="text-foreground">Change:</span> {e.change}</li>
                <li><span className="text-foreground">Audience:</span> {e.targetAudience}</li>
                <li><span className="text-foreground">Success metric:</span> {e.successMetric}</li>
                <li><span className="text-foreground">Expected impact:</span> {e.expectedImpact}</li>
                <li><span className="text-foreground">Duration:</span> {e.duration}</li>
                <li><span className="text-foreground">Decision rule:</span> {e.decisionRule}</li>
              </ul>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Winning patterns">
          <MemorySection label="Industries" items={report.knowledgeUpdates.winningPatterns.industries} />
          <MemorySection label="Personas" items={report.knowledgeUpdates.winningPatterns.personas} />
          <MemorySection label="Messages" items={report.knowledgeUpdates.winningPatterns.messages} />
          <MemorySection label="Channels" items={report.knowledgeUpdates.winningPatterns.channels} />
        </Card>
        <Card title="Losing patterns">
          <MemorySection label="Failed approaches" items={report.knowledgeUpdates.losingPatterns.failedApproaches} />
          <MemorySection label="Poor-fit segments" items={report.knowledgeUpdates.losingPatterns.poorFitSegments} />
          <MemorySection label="Rejection reasons" items={report.knowledgeUpdates.losingPatterns.rejectionReasons} />
        </Card>
        <Card title="Market intelligence">
          <MemorySection label="Competitive" items={report.knowledgeUpdates.marketIntelligence.competitiveInsights} />
          <MemorySection label="Trends" items={report.knowledgeUpdates.marketIntelligence.industryTrends} />
          <MemorySection label="Customer patterns" items={report.knowledgeUpdates.marketIntelligence.customerPatterns} />
        </Card>
      </div>

      <Card title={`Recommendations (${report.recommendations.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-4 font-medium">Problem</th>
                <th className="py-2 pr-4 font-medium">Change</th>
                <th className="py-2 pr-4 font-medium">Impact</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Priority</th>
                <th className="py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {report.recommendations.map((r) => (
                <tr key={r.rank} className="border-b border-line last:border-0 align-top">
                  <td className="py-2.5 pr-3 text-muted">{r.rank}</td>
                  <td className="py-2.5 pr-4">{r.problem}</td>
                  <td className="py-2.5 pr-4">{r.recommendedChange}</td>
                  <td className="py-2.5 pr-4 text-muted">{r.expectedImpact}</td>
                  <td className="py-2.5 pr-4"><TypeBadge type={r.type} /></td>
                  <td className="py-2.5 pr-4"><PriorityBadge level={r.priority} /></td>
                  <td className="py-2.5">{r.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Facts, correlations, and hypotheses">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <p className="font-medium text-muted mb-1">Facts</p>
            <List items={report.confidence.facts} muted />
          </div>
          <div>
            <p className="font-medium text-muted mb-1">Correlations</p>
            <List items={report.confidence.correlations.length ? report.confidence.correlations : ["None established yet"]} muted />
          </div>
          <div>
            <p className="font-medium text-muted mb-1">Hypotheses</p>
            <List items={report.confidence.hypotheses.slice(0, 6)} muted />
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
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function SummaryBlock({
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
  return (
    <div>
      <p className={`text-xs font-medium mb-1 ${good ? "text-good" : warn ? "text-warn" : "text-muted"}`}>
        {label}
      </p>
      <List items={items.length ? items : ["None recorded"]} muted={!good && !warn} />
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

function InsightList({
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
      <p className={`text-xs font-medium mb-1 ${good ? "text-good" : warn ? "text-warn" : "text-muted"}`}>
        {label}
      </p>
      <List items={items} muted />
    </div>
  );
}

function MemorySection({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs font-medium text-muted mb-1">{label}</p>
      <List items={items} muted />
    </div>
  );
}

function AgentCard({ name, agent }: { name: string; agent: AgentPerformanceReview }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-medium text-sm">{name} Agent</p>
        <p className={`text-lg font-semibold ${scoreColor(agent.score)}`}>{agent.score}</p>
      </div>
      <ul className="space-y-0.5 text-xs text-muted mb-2">
        {agent.metrics.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
      {agent.strengths.length > 0 && (
        <p className="text-xs text-good mb-0.5">+ {agent.strengths[0]}</p>
      )}
      {agent.improvements.length > 0 && (
        <p className="text-xs text-warn">→ {agent.improvements[0]}</p>
      )}
    </div>
  );
}

function AssessmentBadge({ value }: { value: "Strong" | "Average" | "Weak" }) {
  const cls =
    value === "Strong"
      ? "bg-good/10 text-good"
      : value === "Weak"
        ? "bg-bad/10 text-bad"
        : "bg-warn/10 text-warn";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {value}
    </span>
  );
}

function TypeBadge({ type }: { type: "Fact" | "Correlation" | "Hypothesis" }) {
  const cls =
    type === "Fact"
      ? "bg-good/10 text-good"
      : type === "Correlation"
        ? "bg-accent-soft text-accent"
        : "bg-warn/10 text-warn";
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {type}
    </span>
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
