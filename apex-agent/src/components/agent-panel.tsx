"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AgentOutput } from "@/lib/types";
import { statusLabel } from "@/components/badges";

export function AgentPanel({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<AgentOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          instruction: instruction.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Agent run failed");
      setOutput(data.output);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent run failed");
    } finally {
      setRunning(false);
    }
  }

  async function copyMessage() {
    if (!output?.outreachMessage) return;
    const msg = output.outreachMessage;
    const text = msg.subject ? `Subject: ${msg.subject}\n\n${msg.body}` : msg.body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Run Apex on this lead
        </h2>
        {output && (
          <span className="text-[10px] uppercase tracking-wide text-muted">
            engine: {output.engine === "openai" ? "OpenAI" : "demo (no API key)"}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <textarea
          rows={2}
          placeholder="Optional instruction, e.g. “They said the price is too high — handle the objection” or leave blank for full qualification."
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent transition"
        />
        <button
          onClick={run}
          disabled={running}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {running ? "Apex is thinking…" : "Run agent"}
        </button>
        {error && <p className="text-sm text-bad">{error}</p>}
      </div>

      {output && (
        <div className="space-y-5 border-t border-line pt-5">
          <Block title="Lead summary">
            <p className="text-sm leading-relaxed">{output.leadSummary}</p>
          </Block>

          <Block title="Qualification">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-sm">
              <Metric label="Fit" value={`${output.qualification.fitScore}`} />
              <Metric
                label="Intent"
                value={`${output.qualification.intentScore}`}
              />
              <Metric
                label="Priority"
                value={`${output.qualification.priorityScore}`}
              />
              <Metric
                label="Deal size"
                value={output.qualification.estimatedDealSize}
              />
              <Metric
                label="Close prob."
                value={`${output.qualification.closeProbability}%`}
              />
              <Metric label="Confidence" value={output.confidenceLevel} />
            </div>
          </Block>

          <Block title="Recommended next action">
            <p className="text-sm font-medium text-accent">
              {output.recommendedNextAction.label}
            </p>
            <p className="mt-1 text-sm text-muted">
              {output.recommendedNextAction.reason}
            </p>
          </Block>

          {output.outreachMessage && (
            <Block title={`Outreach message (${output.outreachMessage.channel})`}>
              <div className="rounded-lg bg-surface-2 p-4">
                {output.outreachMessage.subject && (
                  <p className="mb-2 text-sm font-medium">
                    Subject: {output.outreachMessage.subject}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {output.outreachMessage.body}
                </p>
              </div>
              <button
                onClick={copyMessage}
                className="mt-2 text-xs text-accent hover:underline"
              >
                {copied ? "Copied!" : "Copy message"}
              </button>
            </Block>
          )}

          <Block title="Follow-up plan">
            <ol className="space-y-1.5 text-sm list-decimal list-inside">
              {output.followUpPlan.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </Block>

          <Block title="CRM update (applied)">
            <div className="text-sm space-y-1.5">
              <p>
                <span className="text-muted">Status:</span>{" "}
                {statusLabel(output.crmUpdate.leadStatus)}
              </p>
              <p>
                <span className="text-muted">Next action:</span>{" "}
                {output.crmUpdate.nextAction}
              </p>
              {output.crmUpdate.followUpDate && (
                <p>
                  <span className="text-muted">Follow-up:</span>{" "}
                  {output.crmUpdate.followUpDate}
                </p>
              )}
              {output.crmUpdate.painPoints.length > 0 && (
                <p>
                  <span className="text-muted">Pain points:</span>{" "}
                  {output.crmUpdate.painPoints.join("; ")}
                </p>
              )}
            </div>
          </Block>
        </div>
      )}
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
