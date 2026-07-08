"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AccountPlan,
  ConfidenceLevel,
  RiskLevel,
} from "@/lib/types";

export function PlanPanel({
  leadId,
  initialPlan,
}: {
  leadId: string;
  initialPlan: AccountPlan | null;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<AccountPlan | null>(initialPlan);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Planning run failed");
      setPlan(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Planning run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Strategic Account Planning Agent
          </h2>
          {plan && (
            <p className="mt-1 text-[11px] text-muted">
              Last run {new Date(plan.timestamp).toLocaleString()} · engine:{" "}
              {plan.engine === "openai" ? "OpenAI" : "demo (no API key)"} ·
              confidence: {plan.confidence.level}
            </p>
          )}
        </div>
        <button
          onClick={run}
          disabled={running}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {running ? "Planning…" : plan ? "Re-build account plan" : "Build account plan"}
        </button>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}

      {!plan ? (
        <p className="text-sm text-muted">
          No account plan yet. The planning agent turns research into the
          strategy every downstream agent follows: executive assessment,
          ranked opportunities, stakeholder strategy, sales strategy,
          discovery plan, objection forecast, engagement plan, competitive
          strategy, risk assessment, and success plan. Run deep research
          first for the strongest plan.
        </p>
      ) : (
        <PlanView plan={plan} />
      )}
    </div>
  );
}

function PlanView({ plan }: { plan: AccountPlan }) {
  const ea = plan.executiveAssessment;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <Fold title="1 · Executive assessment" defaultOpen>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ClassBadge classification={ea.classification} />
          <span className="text-sm font-medium">{ea.revenuePotential}</span>
        </div>
        <KV
          rows={[
            ["Company", ea.company],
            ["Situation", ea.currentSituation],
            ["Strategic importance", ea.strategicImportance],
            ["Recommendation", ea.recommendation],
            ["Rationale", ea.rationale],
          ]}
        />
      </Fold>

      <Fold title={`2 · Opportunity analysis (${plan.opportunities.length})`}>
        <ul className="space-y-2.5 text-sm">
          {plan.opportunities
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .map((o, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                  {o.rank}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{o.opportunity}</span>
                    <ConfBadge level={o.expectedImpact} />
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {o.category} · {o.businessDriver}
                  </p>
                </div>
              </li>
            ))}
        </ul>
      </Fold>

      <Fold title={`3 · Stakeholder strategy (${plan.stakeholders.length})`}>
        <ul className="space-y-3 text-sm">
          {plan.stakeholders
            .slice()
            .sort((a, b) => a.engagementOrder - b.engagementOrder)
            .map((s, i) => (
              <li key={i} className="rounded-lg bg-surface-2 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    <span className="text-muted">#{s.engagementOrder}</span>{" "}
                    {s.name}
                  </span>
                  <span className="text-xs text-muted">
                    influence score: {s.decisionInfluenceScore}/100
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  {s.role !== "Unknown" ? s.role : "Role unknown"} · influence:{" "}
                  {s.influence} · authority: {s.authority}
                </p>
                <p className="text-xs mt-1.5">
                  <span className="text-muted">Priorities:</span>{" "}
                  {s.likelyPriorities.join(", ")}
                </p>
                <p className="text-xs mt-0.5">
                  <span className="text-muted">Concerns:</span>{" "}
                  {s.likelyConcerns.join(", ")}
                </p>
                <p className="text-xs mt-0.5">
                  <span className="text-muted">Cares about:</span>{" "}
                  {s.outcomesTheyCareAbout.join(", ")}
                </p>
                <p className="text-xs mt-0.5 text-muted italic">
                  {s.communicationStyle}
                </p>
              </li>
            ))}
        </ul>
      </Fold>

      <Fold title="4 · Sales strategy">
        <KV
          rows={[
            ["Primary value prop", plan.salesStrategy.primaryValueProposition],
            ["Secondary value prop", plan.salesStrategy.secondaryValueProposition],
            ["Business case", plan.salesStrategy.businessCase],
            ["ROI narrative", plan.salesStrategy.roiNarrative],
            ["Positioning", plan.salesStrategy.competitivePositioning],
            ["Risk reduction", plan.salesStrategy.riskReductionStrategy],
            ["Implementation", plan.salesStrategy.implementationStrategy],
          ]}
        />
        <ListBlock label="Proof points required" items={plan.salesStrategy.proofPointsRequired} />
        <ListBlock label="Success metrics" items={plan.salesStrategy.successMetrics} />
        <ListBlock label="Expansion" items={plan.salesStrategy.expansionOpportunities} />
      </Fold>

      <Fold
        title={`5 · Discovery plan (${plan.discoveryPlan.reduce((n, g) => n + g.questions.length, 0)} questions)`}
      >
        <div className="space-y-3">
          {plan.discoveryPlan.map((g, i) => (
            <div key={i}>
              <p className="text-xs font-medium text-accent mb-1">{g.category}</p>
              <ul className="list-disc list-inside space-y-0.5 text-sm">
                {g.questions.map((q, j) => (
                  <li key={j}>{q}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Fold>

      <Fold title={`6 · Objection forecast (${plan.objectionForecast.length})`}>
        <ul className="space-y-3 text-sm">
          {plan.objectionForecast.map((o, i) => (
            <li key={i} className="rounded-lg bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">“{o.objection}”</span>
                <span className="text-xs text-muted">
                  probability: <ConfBadge level={o.probability} /> · severity:{" "}
                  <ConfBadge level={o.severity} />
                </span>
              </div>
              <p className="text-xs text-muted mt-1">Root cause: {o.rootCause}</p>
              <p className="text-xs mt-1">
                <span className="text-muted">Response:</span>{" "}
                {o.recommendedResponse}
              </p>
              <p className="text-xs mt-0.5">
                <span className="text-muted">Evidence needed:</span>{" "}
                {o.evidenceNeeded}
              </p>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="7 · Engagement strategy">
        <KV
          rows={[
            ["First contact", plan.engagementStrategy.firstContact],
            ["Second contact", plan.engagementStrategy.secondContact],
            ["Third contact", plan.engagementStrategy.thirdContact],
            ["Channel", plan.engagementStrategy.preferredChannel],
            ["Meeting objective", plan.engagementStrategy.meetingObjective],
            ["Timing", plan.engagementStrategy.timingRecommendations],
            ["Escalation path", plan.engagementStrategy.escalationPath],
          ]}
        />
        <ListBlock label="Meeting agenda" items={plan.engagementStrategy.meetingAgenda} ordered />
        <ListBlock label="Content to share" items={plan.engagementStrategy.contentToShare} />
        <ListBlock label="Case study themes" items={plan.engagementStrategy.caseStudyThemes} />
        <ListBlock label="Follow-up cadence" items={plan.engagementStrategy.followUpCadence} />
      </Fold>

      <Fold title="8 · Competitive strategy">
        <ListBlock label="Likely competitors" items={plan.competitiveStrategy.likelyCompetitors} />
        <ListBlock label="Incumbents" items={plan.competitiveStrategy.incumbentVendors} />
        <ListBlock label="Switching barriers" items={plan.competitiveStrategy.switchingBarriers} />
        <ListBlock label="Competitive weaknesses" items={plan.competitiveStrategy.competitiveWeaknesses} />
        <ListBlock label="Differentiators to emphasize" items={plan.competitiveStrategy.differentiatorsToEmphasize} />
        <ListBlock label="Gap-exposing questions" items={plan.competitiveStrategy.gapExposingQuestions} />
      </Fold>

      <Fold title={`9 · Risk assessment (${plan.riskAssessment.length})`}>
        <ul className="space-y-2.5 text-sm">
          {plan.riskAssessment.map((r, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={r.level} />
                <span className="font-medium">{r.area}:</span>
                <span>{r.risk}</span>
              </div>
              <p className="text-xs text-muted mt-0.5 ml-1">
                Mitigation: {r.mitigation}
              </p>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="10 · Success plan" defaultOpen>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-sm mb-3">
          <Metric label="Deal probability" value={`${plan.successPlan.dealProbability}%`} />
          <Metric label="Sales cycle" value={plan.successPlan.salesCycleLength} />
          <Metric label="Contract value" value={plan.successPlan.expectedContractValue} />
          <Metric label="Expansion" value={plan.successPlan.expansionPotential} />
          <Metric label="Renewal prob." value={`${plan.successPlan.renewalProbability}%`} />
          <Metric label="Account health" value={plan.successPlan.accountHealth} />
        </div>
        <p className="text-xs font-medium text-accent mb-1">
          Top three actions to improve win probability
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          {plan.successPlan.topThreeActions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </Fold>

      <Fold title="Confidence — verified vs. inferred">
        <p className="text-sm mb-2">
          <span className="text-muted">Overall:</span>{" "}
          <ConfBadge level={plan.confidence.level} />
        </p>
        <ListBlock label="Verified basis" items={plan.confidence.verifiedBasis} />
        <ListBlock label="Inferred (not verified)" items={plan.confidence.inferredElements} />
        <ListBlock label="Gaps" items={plan.confidence.gaps} />
      </Fold>
    </div>
  );
}

function Fold({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-line bg-surface-2/40"
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground transition list-none flex items-center justify-between">
        {title}
        <span className="text-muted transition group-open:rotate-90">›</span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function KV({ rows }: { rows: [string, string][] }) {
  const visible = rows.filter(([, v]) => v && v.trim() !== "");
  return (
    <dl className="space-y-1.5 text-sm mb-3 last:mb-0">
      {visible.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[140px_1fr] gap-2">
          <dt className="text-muted">{k}</dt>
          <dd className={v === "Unknown" ? "text-muted italic" : "break-words"}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ListBlock({
  label,
  items,
  ordered = false,
}: {
  label: string;
  items: string[];
  ordered?: boolean;
}) {
  if (items.length === 0) return null;
  const cls = "list-inside space-y-0.5 text-sm";
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs font-medium text-muted mb-1">{label}</p>
      {ordered ? (
        <ol className={`list-decimal ${cls}`}>
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ol>
      ) : (
        <ul className={`list-disc ${cls}`}>
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium text-xs mt-0.5">{value}</p>
    </div>
  );
}

function ClassBadge({
  classification,
}: {
  classification: AccountPlan["executiveAssessment"]["classification"];
}) {
  const cls =
    classification === "High Priority"
      ? "bg-good/15 text-good"
      : classification === "Medium Priority"
        ? "bg-warn/15 text-warn"
        : classification === "Low Priority"
          ? "bg-surface-2 text-muted"
          : "bg-bad/15 text-bad";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {classification}
    </span>
  );
}

function ConfBadge({ level }: { level: ConfidenceLevel }) {
  const cls =
    level === "High"
      ? "bg-good/10 text-good"
      : level === "Medium"
        ? "bg-warn/10 text-warn"
        : "bg-bad/10 text-bad";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {level}
    </span>
  );
}

function RiskBadge({ level }: { level: RiskLevel }) {
  const cls =
    level === "Critical"
      ? "bg-bad/20 text-bad"
      : level === "High"
        ? "bg-bad/10 text-bad"
        : level === "Medium"
          ? "bg-warn/10 text-warn"
          : "bg-good/10 text-good";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {level}
    </span>
  );
}
