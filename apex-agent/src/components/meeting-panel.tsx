"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MeetingReport } from "@/lib/types";

export function MeetingPanel({
  leadId,
  initialReports,
}: {
  leadId: string;
  initialReports: MeetingReport[];
}) {
  const router = useRouter();
  const [reports, setReports] = useState<MeetingReport[]>(initialReports);
  const [notes, setNotes] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = reports[0] ?? null;

  async function run(withNotes: boolean) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          meetingNotes: withNotes ? notes : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Meeting run failed");
      setReports((prev) => [data, ...prev]);
      if (withNotes) setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Meeting run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 space-y-5">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Meeting Intelligence Agent
        </h2>
        <p className="mt-1 text-[11px] text-muted">
          Before the meeting: generate the prep pack. After the meeting: paste
          your notes to get the debrief, qualification update, follow-up email,
          and CRM updates.
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          rows={4}
          placeholder={`After the meeting, paste your notes or transcript here, e.g.\n“Sarah said ramp time is their biggest problem. Budget around $50k/year exists. Wants a decision by end of Q3. Will intro us to Tom (VP Sales). We'll send the case study.”`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent transition"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => run(false)}
            disabled={running}
            className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft disabled:opacity-50 transition"
          >
            {running ? "Working…" : "Generate pre-meeting brief"}
          </button>
          <button
            onClick={() => run(true)}
            disabled={running || !notes.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {running ? "Working…" : "Analyze meeting notes"}
          </button>
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>

      {latest && <ReportView report={latest} />}

      {reports.length > 1 && (
        <div className="border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Previous runs
          </p>
          <ul className="space-y-1.5 text-xs text-muted">
            {reports.slice(1, 6).map((r) => (
              <li key={r.id}>
                {new Date(r.timestamp).toLocaleString()} —{" "}
                {r.meetingAnalysis.hasNotes ? "Meeting debrief" : "Pre-meeting brief"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportView({ report }: { report: MeetingReport }) {
  const r = report;
  const post = r.meetingAnalysis.hasNotes;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <p className="text-[11px] text-muted">
        {post ? "Meeting debrief" : "Pre-meeting brief"} ·{" "}
        {new Date(r.timestamp).toLocaleString()} · engine:{" "}
        {r.engine === "openai" ? "OpenAI" : "demo (no API key)"} · confidence:{" "}
        {r.confidence.level}
      </p>

      {r.escalation.required && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3">
          <p className="text-sm font-medium text-warn">
            Human involvement recommended ({r.escalation.urgency} urgency)
          </p>
          <ul className="mt-1 list-disc list-inside text-xs text-warn/90 space-y-0.5">
            {r.escalation.reasons.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      <Fold title="Meeting brief" defaultOpen={!post}>
        <KV
          rows={[
            ["Company", r.meetingBrief.companyOverview],
            ["Situation", r.meetingBrief.businessSituation],
            ["Industry context", r.meetingBrief.industryContext],
            ["Relationship", r.meetingBrief.relationshipStatus],
            ["Previous convos", r.meetingBrief.previousConversations],
            ["Competitive", r.meetingBrief.competitiveSituation],
            ["Opportunity size", r.meetingBrief.opportunitySize],
            ["Deal probability", `${r.meetingBrief.dealProbability}%`],
          ]}
        />
        <ListBlock label="Buying signals" items={r.meetingBrief.buyingSignals} />
        <ListBlock label="Known pain points" items={r.meetingBrief.knownPainPoints} />
        <ListBlock label="Known objections" items={r.meetingBrief.knownObjections} />
      </Fold>

      <Fold title={`Attendee analysis (${r.attendeeAnalysis.length})`}>
        <ul className="space-y-3 text-sm">
          {r.attendeeAnalysis.map((a, i) => (
            <li key={i} className="rounded-lg bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{a.name}</span>
                <span className="text-xs text-muted">
                  influence: {a.influenceLevel} · authority: {a.decisionAuthority}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                {[a.role, a.department].filter((x) => x && x !== "Unknown").join(" · ") || "Role unknown"}
              </p>
              <p className="text-xs mt-1.5">
                <span className="text-muted">Priorities:</span> {a.likelyPriorities.join(", ")}
              </p>
              <p className="text-xs mt-0.5">
                <span className="text-muted">Concerns:</span> {a.potentialConcerns.join(", ")}
              </p>
              <p className="text-xs mt-0.5">
                <span className="text-muted">Approach:</span> {a.recommendedApproach}
              </p>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="Objective & strategy">
        <KV
          rows={[
            ["Primary objective", r.meetingObjective.primaryObjective],
            ["Desired outcome", r.meetingObjective.desiredOutcome],
            ["Minimum acceptable", r.meetingObjective.minimumAcceptableOutcome],
            ["Next-step goal", r.meetingObjective.nextStepGoal],
            ["Opening", r.meetingStrategy.openingStrategy],
            ["Discovery approach", r.meetingStrategy.discoveryApproach],
            ["Value discussion", r.meetingStrategy.valueDiscussionStrategy],
            ["Positioning", r.meetingStrategy.recommendedPositioning],
          ]}
        />
        <ListBlock label="Success criteria" items={r.meetingObjective.successCriteria} />
        <ListBlock label="Proof points to use" items={r.meetingStrategy.proofPointsToUse} />
        <ListBlock label="Topics to avoid" items={r.meetingStrategy.topicsToAvoid} />
        <ListBlock label="Risks" items={r.meetingStrategy.potentialRisks} />
      </Fold>

      <Fold title={`Discovery questions (${r.discoveryQuestions.reduce((n, g) => n + g.questions.length, 0)})`}>
        <div className="space-y-3">
          {r.discoveryQuestions.map((g, i) => (
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

      <Fold title={`Objection preparation (${r.objectionPreparation.length})`}>
        <ul className="space-y-3 text-sm">
          {r.objectionPreparation.map((o, i) => (
            <li key={i} className="rounded-lg bg-surface-2 p-3">
              <p className="font-medium">
                “{o.objection}”{" "}
                <span className="text-xs text-muted">({o.probability} probability)</span>
              </p>
              <p className="text-xs text-muted mt-1">Why: {o.whyItMayHappen}</p>
              <p className="text-xs mt-1">
                <span className="text-muted">Response:</span> {o.recommendedResponse}
              </p>
              <p className="text-xs mt-0.5">
                <span className="text-muted">Follow-up question:</span> {o.followUpQuestion}
              </p>
            </li>
          ))}
        </ul>
      </Fold>

      {post && (
        <>
          <Fold title="Meeting analysis" defaultOpen>
            <KV
              rows={[
                ["What happened", r.meetingAnalysis.summary.whatHappened],
                ["What was learned", r.meetingAnalysis.summary.whatWasLearned],
                ["Business impact", r.meetingAnalysis.summary.businessImpact],
                ["Opportunity change", r.meetingAnalysis.summary.opportunityChanges],
                ["Budget info", r.meetingAnalysis.budgetInformation],
                ["Timeline", r.meetingAnalysis.timeline],
              ]}
            />
            <ListBlock label="Pain points heard" items={r.meetingAnalysis.painPoints} />
            <ListBlock label="Goals heard" items={r.meetingAnalysis.goals} />
            <ListBlock label="Requirements" items={r.meetingAnalysis.requirements} />
            <ListBlock label="Buying signals" items={r.meetingAnalysis.buyingSignals} />
            <ListBlock label="Objections" items={r.meetingAnalysis.objections} />
            <ListBlock label="Stakeholders mentioned" items={r.meetingAnalysis.stakeholders} />
            <ListBlock label="Competitor mentions" items={r.meetingAnalysis.competitorMentions} />
            <ListBlock label="Commitments" items={r.meetingAnalysis.commitments} />
          </Fold>

          <Fold title="Qualification update" defaultOpen>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm mb-2">
              <DeltaMetric label="ICP fit" m={r.qualificationUpdate.icpFit} />
              <DeltaMetric label="Buying intent" m={r.qualificationUpdate.buyingIntent} />
              <DeltaMetric label="Urgency" m={r.qualificationUpdate.urgency} />
              <DeltaMetric label="Deal probability" m={r.qualificationUpdate.dealProbability} suffix="%" />
            </div>
            <KV
              rows={[
                ["Expected revenue", r.qualificationUpdate.expectedRevenue],
                ["Stage", r.qualificationUpdate.opportunityStage],
                ["Reason", r.qualificationUpdate.dealProbability.reason],
              ]}
            />
          </Fold>

          <Fold title="Follow-up email" defaultOpen>
            <DraftCard
              subject={r.followUpPlan.followUpEmail.subject}
              body={r.followUpPlan.followUpEmail.body}
              cta={r.followUpPlan.followUpEmail.cta}
            />
          </Fold>

          <Fold title="Meeting quality analysis">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm mb-2">
              {(
                [
                  ["Preparation", r.qualityAnalysis.preparationQuality],
                  ["Discovery depth", r.qualityAnalysis.discoveryDepth],
                  ["Engagement", r.qualityAnalysis.customerEngagement],
                  ["Value alignment", r.qualityAnalysis.valueAlignment],
                  ["Qualification", r.qualityAnalysis.qualificationQuality],
                  ["Next-step clarity", r.qualityAnalysis.nextStepClarity],
                  ["Effectiveness", r.qualityAnalysis.meetingEffectiveness],
                ] as const
              ).map(([label, qs]) => (
                <div key={label} className="rounded-lg bg-surface-2 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
                  <p className={`font-semibold ${qs.score >= 70 ? "text-good" : qs.score >= 50 ? "text-warn" : "text-bad"}`}>
                    {qs.score}
                  </p>
                </div>
              ))}
            </div>
            <ListBlock label="Improvements" items={r.qualityAnalysis.improvements} />
          </Fold>
        </>
      )}

      <Fold title="Next step plan" defaultOpen={post}>
        <KV
          rows={[
            ["Next action", r.followUpPlan.nextAction],
            ["Responsible", r.followUpPlan.responsiblePerson],
            ["Deadline", r.followUpPlan.deadline],
            ["Customer commitment", r.followUpPlan.customerCommitment],
            ["Internal commitment", r.followUpPlan.internalCommitment],
            ["Risk if delayed", r.followUpPlan.riskIfDelayed],
          ]}
        />
      </Fold>
    </div>
  );
}

function DraftCard({
  subject,
  body,
  cta,
}: {
  subject: string;
  body: string;
  cta: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!body) return <p className="text-sm text-muted">Pending — analyze meeting notes first.</p>;
  async function copy() {
    await navigator.clipboard.writeText(
      subject ? `Subject: ${subject}\n\n${body}` : body
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <div className="flex items-center justify-end mb-2">
        <button onClick={copy} className="text-xs text-accent hover:underline">
          {copied ? "Copied!" : "Copy draft"}
        </button>
      </div>
      {subject && <p className="text-sm font-medium mb-1">Subject: {subject}</p>}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      {cta && (
        <p className="mt-2 text-xs">
          <span className="text-muted">CTA:</span> {cta}
        </p>
      )}
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
  const visible = rows.filter(([, v]) => v && v.trim() !== "" && v !== "Pending");
  if (visible.length === 0) return null;
  return (
    <dl className="space-y-1.5 text-sm mb-3 last:mb-0">
      {visible.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="grid grid-cols-[150px_1fr] gap-2">
          <dt className="text-muted">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
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

function DeltaMetric({
  label,
  m,
  suffix = "",
}: {
  label: string;
  m: { value: number; change: string; reason: string };
  suffix?: string;
}) {
  const positive = m.change.startsWith("+");
  const negative = m.change.startsWith("-");
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-semibold">
        {m.value}
        {suffix}{" "}
        <span
          className={`text-xs font-medium ${
            positive ? "text-good" : negative ? "text-bad" : "text-muted"
          }`}
        >
          {m.change}
        </span>
      </p>
    </div>
  );
}
