"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfidenceLevel, OutreachPlaybook, OutreachTouch } from "@/lib/types";

export function OutreachPanel({
  leadId,
  initialPlaybook,
}: {
  leadId: string;
  initialPlaybook: OutreachPlaybook | null;
}) {
  const router = useRouter();
  const [playbook, setPlaybook] = useState<OutreachPlaybook | null>(
    initialPlaybook
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Outreach run failed");
      setPlaybook(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Outreach run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Outreach Intelligence Agent
          </h2>
          {playbook && (
            <p className="mt-1 text-[11px] text-muted">
              Last run {new Date(playbook.timestamp).toLocaleString()} · engine:{" "}
              {playbook.engine === "openai" ? "OpenAI" : "demo (no API key)"} ·
              confidence: {playbook.confidence.level}
            </p>
          )}
        </div>
        <button
          onClick={run}
          disabled={running}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {running
            ? "Writing…"
            : playbook
              ? "Re-build outreach playbook"
              : "Build outreach playbook"}
        </button>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}

      {!playbook ? (
        <p className="text-sm text-muted">
          No outreach playbook yet. The outreach agent converts the account
          plan into a go/no-go decision, channel strategy, a personalized
          5-touch sequence, follow-up logic, objection responses, a meeting
          plan, quality scores, and A/B variants. Run research and planning
          first for the strongest personalization.
        </p>
      ) : (
        <PlaybookView playbook={playbook} />
      )}
    </div>
  );
}

function PlaybookView({ playbook }: { playbook: OutreachPlaybook }) {
  const d = playbook.decision;
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <Fold title="Decision — should outreach happen now?" defaultOpen>
        <div className="mb-3">
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              d.outreachNow ? "bg-good/15 text-good" : "bg-warn/15 text-warn"
            }`}
          >
            {d.outreachNow ? "Outreach now" : "Wait — do not send yet"}
          </span>
        </div>
        <KV
          rows={[
            ["Reason", d.reason],
            ["First stakeholder", d.firstStakeholder],
            ["Primary problem", d.primaryBusinessProblem],
            ["Outcome emphasized", d.outcomeEmphasized],
            ["Supporting evidence", d.supportingEvidence],
            ["Lowest-friction CTA", d.lowestFrictionCta],
          ]}
        />
      </Fold>

      <Fold title="Channel strategy">
        <KV
          rows={[
            ["Primary channel", playbook.channelStrategy.primaryChannel],
            ["Rationale", playbook.channelStrategy.rationale],
            ["Alternates", playbook.channelStrategy.alternates.join("; ")],
          ]}
        />
      </Fold>

      <Fold title={`Sequence (${playbook.sequence.length} touches)`} defaultOpen>
        <div className="space-y-3">
          {playbook.sequence.map((t) => (
            <TouchCard key={t.touch} touch={t} />
          ))}
        </div>
      </Fold>

      <Fold title={`Follow-up logic (${playbook.followUpLogic.length} scenarios)`}>
        <ul className="space-y-2.5 text-sm">
          {playbook.followUpLogic.map((f, i) => (
            <li key={i}>
              <p className="font-medium">{f.scenario}</p>
              <p className="text-xs text-muted mt-0.5">{f.nextResponse}</p>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title={`Objection responses (${playbook.objectionResponses.length})`}>
        <ul className="space-y-3 text-sm">
          {playbook.objectionResponses.map((o, i) => (
            <li key={i} className="rounded-lg bg-surface-2 p-3">
              <p className="font-medium">{o.objection}</p>
              <p className="text-xs mt-1">{o.response}</p>
              <p className="text-xs mt-1">
                <span className="text-muted">Risk reducer:</span> {o.riskReducer}
              </p>
              <p className="text-xs mt-0.5">
                <span className="text-muted">Advance with:</span> {o.advanceWith}
              </p>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="Meeting plan">
        <p className="text-sm mb-2">
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
              playbook.meetingPlan.recommended
                ? "bg-good/10 text-good"
                : "bg-surface-2 text-muted"
            }`}
          >
            {playbook.meetingPlan.recommended
              ? "Meeting recommended"
              : "Not yet — validate problem first"}
          </span>
        </p>
        <KV
          rows={[
            ["Goal", playbook.meetingPlan.goal],
            ["Expected outcome", playbook.meetingPlan.expectedOutcome],
          ]}
        />
        <ListBlock label="Agenda" items={playbook.meetingPlan.agenda} ordered />
        <ListBlock
          label="Discovery objectives"
          items={playbook.meetingPlan.discoveryObjectives}
        />
        <ListBlock
          label="Questions to ask"
          items={playbook.meetingPlan.questionsToAsk}
        />
        <ListBlock
          label="Success criteria"
          items={playbook.meetingPlan.successCriteria}
        />
      </Fold>

      <Fold title="Quality scores (touch 1)">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm mb-3">
          {Object.entries(playbook.qualityScores).map(([key, qs]) => (
            <div key={key} className="rounded-lg bg-surface-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted">
                {key.replace(/([A-Z])/g, " $1")}
              </p>
              <p
                className={`font-semibold ${qs.score >= 85 ? "text-good" : "text-warn"}`}
              >
                {qs.score}
              </p>
            </div>
          ))}
        </div>
        <ul className="space-y-1 text-xs text-muted">
          {Object.entries(playbook.qualityScores).map(([key, qs]) => (
            <li key={key}>
              <span className="text-foreground">
                {key.replace(/([A-Z])/g, " $1")}:
              </span>{" "}
              {qs.explanation}
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="A/B test — touch 1 variants">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 mb-3">
          <MessageCard
            label="Version A"
            subject={playbook.abTests.versionA.subject}
            message={playbook.abTests.versionA.message}
          />
          <MessageCard
            label="Version B"
            subject={playbook.abTests.versionB.subject}
            message={playbook.abTests.versionB.message}
          />
        </div>
        <KV
          rows={[
            ["Hypothesis", playbook.abTests.hypothesis],
            ["Difference", playbook.abTests.difference],
            ["Use A when", playbook.abTests.whenToUseA],
            ["Use B when", playbook.abTests.whenToUseB],
            ["Audience", playbook.abTests.expectedAudience],
          ]}
        />
      </Fold>

      <Fold title="Confidence">
        <p className="text-sm mb-2">
          <span className="text-muted">Overall:</span>{" "}
          <ConfBadge level={playbook.confidence.level} />
        </p>
        <ListBlock label="Based on" items={playbook.confidence.basedOn} />
        <ListBlock label="Cautions" items={playbook.confidence.cautions} />
      </Fold>
    </div>
  );
}

function TouchCard({ touch }: { touch: OutreachTouch }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = touch.subject
      ? `Subject: ${touch.subject}\n\n${touch.message}`
      : touch.message;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm font-medium">
          Touch {touch.touch} · Day {touch.day} ·{" "}
          <span className="text-accent">{touch.channel}</span>
        </p>
        <button onClick={copy} className="text-xs text-accent hover:underline">
          {copied ? "Copied!" : "Copy message"}
        </button>
      </div>
      <p className="text-xs text-muted mb-2">{touch.objective}</p>
      {touch.subject && (
        <p className="text-sm font-medium mb-1">Subject: {touch.subject}</p>
      )}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {touch.message}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
        <p>
          <span className="text-muted">CTA:</span> {touch.cta}
        </p>
        <p>
          <span className="text-muted">Success:</span> {touch.successCondition}
        </p>
        <p>
          <span className="text-muted">Fallback:</span> {touch.fallbackAction}
        </p>
      </div>
    </div>
  );
}

function MessageCard({
  label,
  subject,
  message,
}: {
  label: string;
  subject: string;
  message: string;
}) {
  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-2">
        {label}
      </p>
      {subject && <p className="text-sm font-medium mb-1">Subject: {subject}</p>}
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message}</p>
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
        <div key={k} className="grid grid-cols-[150px_1fr] gap-2">
          <dt className="text-muted">{k}</dt>
          <dd className="break-words">{v}</dd>
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

function ConfBadge({ level }: { level: ConfidenceLevel }) {
  const cls =
    level === "High"
      ? "bg-good/10 text-good"
      : level === "Medium"
        ? "bg-warn/10 text-warn"
        : "bg-bad/10 text-bad";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {level}
    </span>
  );
}
