"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunSchedulerRuntimeButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduler-runtime", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Runtime cycle failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Runtime cycle failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={running}
        className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
      >
        {running ? "Running runtime..." : "Run scheduler cycle"}
      </button>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
