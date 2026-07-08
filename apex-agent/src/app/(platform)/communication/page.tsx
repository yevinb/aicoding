import { RunCommunicationOsButton } from "@/components/run-communication-os-button";
import { getCommunicationOsReports } from "@/lib/communication-os";
import {
  CommunicationApproval,
  CommunicationConversation,
  CommunicationMessage,
  CommunicationOsReport,
  CommunicationReply,
  RiskLevel,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CommunicationPage() {
  const reports = await getCommunicationOsReports();
  const latest: CommunicationOsReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Communication OS</h1>
          <p className="text-sm text-muted mt-1">
            Infrastructure layer for safe, contextual, multi-channel autonomous communication.
          </p>
        </div>
        <RunCommunicationOsButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">No communication cycles yet.</p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}
    </div>
  );
}

function ReportView({ report }: { report: CommunicationOsReport }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · health:{" "}
        {report.analytics.communicationHealth} · confidence {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Created" value={String(report.messagesCreated.length)} />
        <Stat label="Sent" value={String(report.messagesSent.length)} />
        <Stat label="Replies" value={String(report.repliesDetected.length)} />
        <Stat label="Approvals" value={String(report.approvalsRequired.length)} />
        <Stat label="Conv Rate" value={report.analytics.conversionRate} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MessageList title={`Messages created (${report.messagesCreated.length})`} items={report.messagesCreated} />
        <ReplyList title={`Replies detected (${report.repliesDetected.length})`} items={report.repliesDetected} />
        <ConversationList title={`Conversations (${report.conversationsUpdated.length})`} items={report.conversationsUpdated.slice(0, 10)} />
        <ApprovalList title={`Approvals (${report.approvalsRequired.length})`} items={report.approvalsRequired} />
      </div>
    </div>
  );
}

function MessageList({ title, items }: { title: string; items: CommunicationMessage[] }) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {items.map((m) => (
          <li key={m.id} className="rounded-lg border border-line p-3">
            <p className="font-medium">{m.company} · {m.subject}</p>
            <p className="text-xs text-muted mt-1">
              {m.channel} · {m.status} · {m.provider}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReplyList({ title, items }: { title: string; items: CommunicationReply[] }) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {items.map((r) => (
          <li key={r.id} className="rounded-lg border border-line p-3">
            <p className="font-medium">{r.company} · {r.intent}</p>
            <p className="text-xs text-muted mt-1">{r.sentiment} · {r.nextAction}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ConversationList({
  title,
  items,
}: {
  title: string;
  items: CommunicationConversation[];
}) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {items.map((c) => (
          <li key={c.id} className="rounded-lg border border-line p-3">
            <p className="font-medium">{c.company}</p>
            <p className="text-xs text-muted mt-1">{c.intent} · {c.nextRecommendedAction}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ApprovalList({ title, items }: { title: string; items: CommunicationApproval[] }) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {items.map((a) => (
          <li key={a.id} className="rounded-lg border border-warn/30 bg-warn/5 p-3">
            <p className="font-medium flex items-center gap-2">
              <PriorityBadge level={a.risk} />
              {a.action}
            </p>
            <p className="text-xs text-muted mt-1">{a.reason}</p>
          </li>
        ))}
      </ul>
    </Card>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
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
