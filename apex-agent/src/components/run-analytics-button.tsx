"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunAnalyticsButton({ defaultTarget }: { defaultTarget: number }) {
  const router = useRouter();
  const [target, setTarget] = useState(String(defaultTarget));
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revenueTarget: Number(target) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analytics run failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analytics run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-muted">
        Revenue target ($)
        <input
          type="number"
          min={1}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-32 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
      </label>
      <button
        onClick={run}
        disabled={running || !Number(target)}
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
      >
        {running ? "Analyzing revenue system…" : "Run analysis"}
      </button>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
