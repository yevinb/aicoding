import { LeadStatus } from "@/lib/types";

const STATUS_META: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-accent-soft text-accent" },
  researching: { label: "Researching", className: "bg-accent-soft text-accent" },
  contacted: { label: "Contacted", className: "bg-warn/10 text-warn" },
  engaged: { label: "Engaged", className: "bg-good/10 text-good" },
  meeting_booked: { label: "Meeting booked", className: "bg-good/15 text-good" },
  nurturing: { label: "Nurturing", className: "bg-surface-2 text-muted" },
  closed_won: { label: "Closed won", className: "bg-good/20 text-good" },
  closed_lost: { label: "Closed lost", className: "bg-bad/10 text-bad" },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META.new;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}

export function statusLabel(status: LeadStatus): string {
  return (STATUS_META[status] ?? STATUS_META.new).label;
}

export function ScorePill({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const color =
    value === null
      ? "text-muted"
      : value >= 70
        ? "text-good"
        : value >= 50
          ? "text-warn"
          : "text-bad";
  return (
    <div className="flex flex-col items-center rounded-lg bg-surface-2 px-3 py-2 min-w-[72px]">
      <span className={`text-lg font-semibold ${color}`}>
        {value === null ? "—" : value}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
    </div>
  );
}
