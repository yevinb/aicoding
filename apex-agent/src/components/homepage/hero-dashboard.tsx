"use client";

import { useEffect, useState } from "react";

const ACTIVITIES = [
  { agent: "Discovery", text: "Discovered 47 new companies", delay: 0 },
  { agent: "Research", text: "Identified 12 high-intent accounts", delay: 400 },
  { agent: "Research", text: "Researched 8 decision makers", delay: 800 },
  { agent: "Outreach", text: "Created 24 personalized outreach plans", delay: 1200 },
  { agent: "Reply", text: "Handled 6 prospect replies", delay: 1600 },
  { agent: "Meeting", text: "Booked 3 meetings", delay: 2000 },
];

const AGENTS = [
  "Orchestrator",
  "Research",
  "Planning",
  "Outreach",
  "Reply",
  "Meeting",
  "CRM",
  "Analytics",
];

export function HeroDashboard() {
  const [visible, setVisible] = useState(0);
  const [activeAgent, setActiveAgent] = useState(0);

  useEffect(() => {
    const timers = ACTIVITIES.map((_, i) =>
      setTimeout(() => setVisible(i + 1), ACTIVITIES[i].delay + 600)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveAgent((a) => (a + 1) % AGENTS.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full max-w-lg mx-auto lg:mx-0">
      <div className="absolute -inset-4 bg-accent/20 blur-3xl rounded-full opacity-40 animate-pulse-slow" />
      <div className="relative rounded-2xl border border-white/10 bg-surface/80 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-2/50">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-good animate-pulse" />
            <span className="text-xs font-medium text-muted">Apex Command Center</span>
          </div>
          <span className="text-[10px] font-mono text-muted uppercase tracking-wider">
            Live
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Pipeline", value: "$2.4M" },
              { label: "Meetings", value: "12" },
              { label: "Win rate", value: "34%" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg bg-white/5 border border-white/5 px-3 py-2"
              >
                <p className="text-[10px] text-muted uppercase tracking-wide">
                  {s.label}
                </p>
                <p className="text-sm font-semibold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted mb-2">
              Agent activity
            </p>
            <ul className="space-y-1.5 min-h-[168px]">
              {ACTIVITIES.slice(0, visible).map((a, i) => (
                <li
                  key={a.text}
                  className="flex items-start gap-2 text-xs animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="text-good mt-0.5 shrink-0">✓</span>
                  <span>
                    <span className="text-accent font-medium">{a.agent}</span>
                    <span className="text-muted"> — </span>
                    {a.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-accent/20 bg-accent-soft/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-accent mb-1.5">
              Active agents
            </p>
            <div className="flex flex-wrap gap-1.5">
              {AGENTS.map((name, i) => (
                <span
                  key={name}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-all duration-500 ${
                    i === activeAgent
                      ? "border-accent/50 bg-accent/20 text-foreground"
                      : "border-white/10 text-muted"
                  }`}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
