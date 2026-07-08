"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunLearningButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/learning", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Learning run failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Learning run failed");
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
        {running ? "Analyzing every interaction…" : "Run learning cycle"}
      </button>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
