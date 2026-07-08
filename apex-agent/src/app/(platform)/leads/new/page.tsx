"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const FIELDS = [
  { name: "contactName", label: "Contact name *", placeholder: "Jane Smith" },
  { name: "contactTitle", label: "Title", placeholder: "VP of Sales" },
  { name: "email", label: "Email", placeholder: "jane@company.com" },
  { name: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/janesmith" },
  { name: "company", label: "Company *", placeholder: "Acme Corp" },
  { name: "website", label: "Website", placeholder: "acme.com" },
  { name: "industry", label: "Industry", placeholder: "B2B SaaS" },
  { name: "companySize", label: "Company size", placeholder: "120 employees" },
  { name: "location", label: "Location", placeholder: "London, UK" },
  { name: "fundingStage", label: "Funding stage", placeholder: "Series A ($12M)" },
] as const;

export default function NewLeadPage() {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>({});
  const [signals, setSignals] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.contactName || !form.company) {
      setError("Contact name and company are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          buyingSignals: signals
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to create lead");
      const lead = await res.json();
      router.push(`/leads/${lead.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Add lead</h1>
      <p className="text-sm text-muted mt-1 mb-8">
        Give Apex whatever you know. It will research, score, and decide the
        next action.
      </p>

      <form onSubmit={submit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.name} className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted">
                {f.label}
              </span>
              <input
                type="text"
                placeholder={f.placeholder}
                value={form[f.name] ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [f.name]: e.target.value }))
                }
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition"
              />
            </label>
          ))}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Buying signals (one per line)
          </span>
          <textarea
            rows={3}
            placeholder={"Hiring 5 SDRs this quarter\nJust raised Series B"}
            value={signals}
            onChange={(e) => setSignals(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted">
            Notes
          </span>
          <textarea
            rows={3}
            placeholder="Anything else Apex should know about this lead…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent transition"
          />
        </label>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {saving ? "Creating…" : "Create lead"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-lg px-5 py-2.5 text-sm text-muted hover:text-foreground transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
