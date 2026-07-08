import Link from "next/link";
import { getLeads } from "@/lib/store";
import { StatusBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const leads = await getLeads();

  const qualified = leads.filter((l) => (l.priorityScore ?? 0) >= 60).length;
  const engaged = leads.filter(
    (l) => l.status === "engaged" || l.status === "meeting_booked"
  ).length;
  const needsAttention = leads.filter(
    (l) =>
      l.crm.followUpDate && new Date(l.crm.followUpDate) <= new Date()
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted mt-1">
          Apex researches, scores, and works every lead. Open a lead to run the
          agent.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total leads" value={leads.length} />
        <StatCard label="Qualified (60+)" value={qualified} />
        <StatCard label="Engaged" value={engaged} />
        <StatCard label="Follow-ups due" value={needsAttention} accent />
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-medium">Lead</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">
                Company
              </th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Priority</th>
              <th className="px-5 py-3 font-medium hidden lg:table-cell">
                Next action
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-line last:border-0 hover:bg-surface-2/60 transition"
              >
                <td className="px-5 py-4">
                  <Link href={`/leads/${lead.id}`} className="block">
                    <span className="font-medium text-foreground hover:text-accent transition">
                      {lead.contactName}
                    </span>
                    <span className="block text-xs text-muted">
                      {lead.contactTitle || "—"}
                    </span>
                  </Link>
                </td>
                <td className="px-5 py-4 hidden md:table-cell">
                  <span className="block">{lead.company}</span>
                  <span className="block text-xs text-muted">
                    {lead.industry || "—"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-5 py-4 text-right">
                  <PriorityCell value={lead.priorityScore} />
                </td>
                <td className="px-5 py-4 hidden lg:table-cell text-muted max-w-xs truncate">
                  {lead.crm.nextAction || "—"}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-muted">
                  No leads yet.{" "}
                  <Link href="/leads/new" className="text-accent hover:underline">
                    Add your first lead
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-4">
      <p className={`text-2xl font-semibold ${accent && value > 0 ? "text-warn" : ""}`}>
        {value}
      </p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function PriorityCell({ value }: { value: number | null }) {
  if (value === null)
    return <span className="text-muted text-xs">Not scored</span>;
  const color =
    value >= 70 ? "text-good" : value >= 50 ? "text-warn" : "text-bad";
  return <span className={`font-semibold ${color}`}>{value}</span>;
}
