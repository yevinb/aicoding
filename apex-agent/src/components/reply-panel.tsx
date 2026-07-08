"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReplyAnalysis, RiskLevel } from "@/lib/types";

export function ReplyPanel({
  leadId,
  initialAnalyses,
}: {
  leadId: string;
  initialAnalyses: ReplyAnalysis[];
}) {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<ReplyAnalysis[]>(initialAnalyses);
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = analyses[0] ?? null;

  async function run() {
    if (!message.trim()) {
      setError("Paste the prospect's reply first.");
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reply analysis failed");
      setAnalyses((prev) => [data, ...prev]);
      setMessage("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply analysis failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 space-y-5">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Reply Intelligence Agent
        </h2>
        <p className="mt-1 text-[11px] text-muted">
          Paste an inbound reply from the prospect. The agent classifies
          intent, re-assesses the opportunity, decides the next action, drafts
          the response, and applies CRM updates.
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          rows={4}
          placeholder={`Paste the prospect's reply, e.g.\n“Thanks — this is interesting. How much does it cost, and does it integrate with Salesforce? I'd need sign-off from our CFO.”`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent transition"
        />
        <button
          onClick={run}
          disabled={running}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {running ? "Analyzing…" : "Analyze reply"}
        </button>
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>

      {latest && <AnalysisView analysis={latest} />}

      {analyses.length > 1 && (
        <div className="border-t border-line pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Previous replies analyzed
          </p>
          <ul className="space-y-1.5 text-xs text-muted">
            {analyses.slice(1, 6).map((a) => (
              <li key={a.id}>
                {new Date(a.timestamp).toLocaleString()} —{" "}
                {a.classification.primaryIntent} →{" "}
                {a.recommendedAction.action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnalysisView({ analysis }: { analysis: ReplyAnalysis }) {
  const a = analysis;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <p className="text-[11px] text-muted">
        Analyzed {new Date(a.timestamp).toLocaleString()} · engine:{" "}
        {a.engine === "openai" ? "OpenAI" : "demo (no API key)"} · confidence:{" "}
        {a.confidence.level}
      </p>

      {a.escalation.required && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3">
          <p className="text-sm font-medium text-warn">
            Human approval required ({a.escalation.urgency} urgency)
          </p>
          <ul className="mt-1 list-disc list-inside text-xs text-warn/90 space-y-0.5">
            {a.escalation.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <Fold title="Intent & sentiment" defaultOpen>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {a.classification.intents.map((it, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                it.intent === a.classification.primaryIntent
                  ? "bg-accent text-white"
                  : "bg-surface-2 text-muted"
              }`}
            >
              {it.intent}
              <span className="opacity-70">{it.confidence}</span>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm mb-2">
          <Metric label="Overall" value={a.sentiment.overall} />
          <Metric label="Engagement" value={`${a.sentiment.buyerEngagement.score}`} />
          <Metric label="Buying confidence" value={`${a.sentiment.buyingConfidence.score}`} />
          <Metric label="Urgency" value={`${a.sentiment.urgency.score}`} />
          <Metric label="Decision readiness" value={`${a.sentiment.decisionReadiness.score}`} />
          <Metric label="Tone" value={a.sentiment.emotionalTone} />
        </div>
        <ul className="space-y-1 text-xs text-muted">
          <li>{a.sentiment.buyerEngagement.explanation}</li>
          <li>{a.sentiment.decisionReadiness.explanation}</li>
        </ul>
      </Fold>

      <Fold title="Recommended action & response draft" defaultOpen>
        <div className="mb-3">
          <span className="inline-flex rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
            {a.recommendedAction.action}
          </span>
          <p className="mt-1.5 text-sm text-muted">{a.recommendedAction.reason}</p>
        </div>
        {a.responseDraft.body && (
          <DraftCard
            subject={a.responseDraft.subject}
            body={a.responseDraft.body}
            cta={a.responseDraft.cta}
            notes={a.responseDraft.notesForHuman}
            shouldSend={a.responseDraft.shouldSend}
          />
        )}
      </Fold>

      <Fold title="Opportunity assessment">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm mb-2">
          <DeltaMetric label="Deal probability" m={a.opportunityAssessment.dealProbability} suffix="%" />
          <DeltaMetric label="Buying intent" m={a.opportunityAssessment.buyingIntent} />
          <DeltaMetric label="Priority" m={a.opportunityAssessment.priority} />
          <DeltaMetric label="Relationship" m={a.opportunityAssessment.relationshipStrength} />
        </div>
        <KV
          rows={[
            ["Sales stage", a.opportunityAssessment.salesStage],
            ["Est. value", a.opportunityAssessment.estimatedValue],
            ["Expected close", a.opportunityAssessment.expectedCloseDate],
          ]}
        />
        <p className="text-xs">
          <span className="text-muted">Risk level:</span>{" "}
          <RiskBadge level={a.opportunityAssessment.riskLevel} />
        </p>
      </Fold>

      <Fold title="Conversation analysis">
        <ListBlock label="Questions asked" items={a.conversationSummary.questionsAsked} />
        <ListBlock label="Open questions" items={a.conversationSummary.openQuestions} />
        <ListBlock label="Concerns raised" items={a.conversationSummary.concernsRaised} />
        <ListBlock label="Stakeholders mentioned" items={a.conversationSummary.stakeholdersMentioned} />
        <ListBlock label="Deadlines" items={a.conversationSummary.deadlines} />
        <ListBlock label="Agreed next steps" items={a.conversationSummary.agreedNextSteps} />
      </Fold>

      {a.objectionAnalysis.present && (
        <Fold title="Objection analysis">
          <KV
            rows={[
              ["Surface objection", a.objectionAnalysis.surfaceObjection],
              ["Real objection", a.objectionAnalysis.realObjection],
              ["Hidden concern", a.objectionAnalysis.hiddenConcern],
              ["Root cause", a.objectionAnalysis.rootCause],
              ["Evidence required", a.objectionAnalysis.evidenceRequired],
              ["Response strategy", a.objectionAnalysis.responseStrategy],
            ]}
          />
          <p className="text-xs">
            <span className="text-muted">Risk:</span>{" "}
            <RiskBadge level={a.objectionAnalysis.riskLevel} />
          </p>
        </Fold>
      )}

      <Fold title="CRM updates applied">
        <KV
          rows={Object.entries(a.crmUpdates)
            .filter(([, v]) => v !== undefined && v !== null && String(v).length > 0)
            .map(([k, v]) => [
              k.replace(/([A-Z])/g, " $1").toLowerCase(),
              Array.isArray(v) ? v.join("; ") : String(v),
            ]) as [string, string][]}
        />
      </Fold>

      <Fold title="Learning">
        <ListBlock label="What we learned" items={a.learning.whatWeLearned} />
        <ListBlock label="Assumptions confirmed" items={a.learning.assumptionsConfirmed} />
        <ListBlock label="Assumptions incorrect" items={a.learning.assumptionsIncorrect} />
        <KV
          rows={[
            ["Account strategy", a.learning.accountStrategyChange],
            ["Outreach strategy", a.learning.outreachStrategyChange],
            ["Qualification", a.learning.qualificationChange],
          ]}
        />
        <ListBlock label="Improvements" items={a.learning.improvements} />
      </Fold>
    </div>
  );
}

function DraftCard({
  subject,
  body,
  cta,
  notes,
  shouldSend,
}: {
  subject: string;
  body: string;
  cta: string;
  notes: string;
  shouldSend: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(
      subject ? `Subject: ${subject}\n\n${body}` : body
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
            shouldSend ? "bg-good/10 text-good" : "bg-warn/10 text-warn"
          }`}
        >
          {shouldSend ? "Ready to review & send" : "Hold — do not send yet"}
        </span>
        <button onClick={copy} className="text-xs text-accent hover:underline">
          {copied ? "Copied!" : "Copy draft"}
        </button>
      </div>
      {subject && <p className="text-sm font-medium mb-1">Subject: {subject}</p>}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body}</p>
      <p className="mt-2 text-xs">
        <span className="text-muted">CTA:</span> {cta}
      </p>
      {notes && (
        <p className="mt-1 text-xs text-warn">
          <span className="font-medium">Note for human:</span> {notes}
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
  const visible = rows.filter(([, v]) => v && v.trim() !== "");
  if (visible.length === 0) return null;
  return (
    <dl className="space-y-1.5 text-sm mb-3 last:mb-0">
      {visible.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="grid grid-cols-[150px_1fr] gap-2">
          <dt className="text-muted capitalize">{k}</dt>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium text-xs mt-0.5">{value}</p>
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