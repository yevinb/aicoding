import { RunProviderAdapterButton } from "@/components/run-provider-adapter-button";
import { getProviderAdapterReports } from "@/lib/provider-adapter";
import { ProviderAdapterReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProvidersPage() {
  const reports = await getProviderAdapterReports();
  const latest: ProviderAdapterReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Provider Adapter Layer</h1>
          <p className="text-sm text-muted mt-1">
            Interchangeable communication provider bridge with fallback and sync health.
          </p>
        </div>
        <RunProviderAdapterButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">No provider adapter cycles yet.</p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}
    </div>
  );
}

function ReportView({ report }: { report: ProviderAdapterReport }) {
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · health{" "}
        {report.health.overall} · confidence {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Providers" value={String(report.providers.length)} />
        <Stat label="Connected" value={String(report.health.connectedProviders)} />
        <Stat label="Sent" value={String(report.messagesSent.length)} />
        <Stat label="Received" value={String(report.messagesReceived.length)} />
        <Stat label="Errors" value={String(report.errors.length)} />
      </div>

      <Card title="Provider status">
        <ul className="space-y-2 text-sm">
          {report.providers.map((p) => (
            <li key={p.id} className="rounded-lg border border-line p-3">
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted mt-1">
                {p.type} · {p.enabled ? "enabled" : "disabled"} · {p.status}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`Messages sent (${report.messagesSent.length})`}>
          <ul className="space-y-2 text-sm">
            {report.messagesSent.map((m) => (
              <li key={m.messageId} className="rounded-lg border border-line p-3">
                <p className="font-medium">{m.provider}</p>
                <p className="text-xs text-muted mt-1">{m.status} · {m.timestamp}</p>
                {m.error && <p className="text-xs text-bad mt-1">{m.error}</p>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Messages received (${report.messagesReceived.length})`}>
          <ul className="space-y-2 text-sm">
            {report.messagesReceived.map((m, i) => (
              <li key={`${m.threadId}-${i}`} className="rounded-lg border border-line p-3">
                <p className="font-medium">{m.sender}</p>
                <p className="text-xs text-muted mt-1">{m.threadId} · {m.timestamp}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Sync status">
          <p className="text-sm">{report.syncStatus.summary}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {report.syncStatus.byProvider.map((s) => (
              <li key={s.providerId} className="flex justify-between">
                <span>{s.providerId}</span>
                <span>{s.status} · replies {s.syncedReplies}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={`Errors (${report.errors.length})`}>
          {report.errors.length === 0 ? (
            <p className="text-sm text-muted">No provider errors.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {report.errors.map((e, i) => (
                <li key={i} className="rounded-lg border border-bad/30 bg-bad/5 p-3">
                  <p className="font-medium">{e.provider} · {e.stage}</p>
                  <p className="text-xs text-muted mt-1">{e.error}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}
