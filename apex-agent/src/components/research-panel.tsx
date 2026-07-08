"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfidenceLevel, ResearchProfile } from "@/lib/types";

export function ResearchPanel({
  leadId,
  initialProfile,
}: {
  leadId: string;
  initialProfile: ResearchProfile | null;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ResearchProfile | null>(initialProfile);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research run failed");
      setProfile(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Research Intelligence Agent
          </h2>
          {profile && (
            <p className="mt-1 text-[11px] text-muted">
              Last run {new Date(profile.timestamp).toLocaleString()} · engine:{" "}
              {profile.engine === "openai" ? "OpenAI" : "demo (no API key)"} ·
              confidence: {profile.confidence.level}
            </p>
          )}
        </div>
        <button
          onClick={run}
          disabled={running}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition"
        >
          {running
            ? "Researching…"
            : profile
              ? "Re-run deep research"
              : "Run deep research"}
        </button>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}

      {!profile ? (
        <p className="text-sm text-muted">
          No intelligence profile yet. Run deep research to build the full
          pre-outreach profile: company overview, business health, tech stack,
          buying signals, pain points, decision makers, competitors,
          qualification scores, and a recommended strategy.
        </p>
      ) : (
        <ProfileView profile={profile} />
      )}
    </div>
  );
}

function ProfileView({ profile }: { profile: ResearchProfile }) {
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <Fold title="Qualification scorecard" defaultOpen>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm mb-3">
          <Score label="ICP fit" value={profile.qualification.icpFit} />
          <Score label="Buying intent" value={profile.qualification.buyingIntent} />
          <Score label="Growth" value={profile.qualification.growthScore} />
          <Score label="Tech match" value={profile.qualification.technologyMatch} />
          <Score label="Urgency" value={profile.qualification.urgencyScore} />
          <Score label="Strategic value" value={profile.qualification.strategicValue} />
          <Score label="Priority" value={profile.qualification.priorityScore} />
          <div className="rounded-lg bg-surface-2 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-muted">Deal size</p>
            <p className="font-medium text-xs mt-0.5">
              {profile.qualification.expectedDealSize}
            </p>
          </div>
        </div>
        <ul className="space-y-1 text-xs text-muted">
          {Object.entries(profile.qualification.explanations).map(([k, v]) => (
            <li key={k}>
              <span className="text-foreground">{k}:</span> {v}
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="Company overview">
        <KV
          rows={[
            ["Description", profile.company.description],
            ["Industry", profile.company.industry],
            ["Business model", profile.company.businessModel],
            ["HQ", profile.company.headquarters],
            ["Regions served", profile.company.regionsServed],
            ["Employees", profile.company.employeeCount],
            ["Size class", profile.company.companySize],
            ["Revenue est.", profile.company.revenueEstimate],
            ["Growth stage", profile.company.growthStage],
            ["Ownership", profile.company.ownership],
          ]}
        />
      </Fold>

      <Fold title="Business health">
        <KV
          rows={[
            ["Hiring", profile.businessHealth.hiringActivity],
            ["Funding", profile.businessHealth.fundingHistory],
            ["Acquisitions", profile.businessHealth.recentAcquisitions],
            ["Product launches", profile.businessHealth.productLaunches],
            ["Market expansion", profile.businessHealth.marketExpansion],
            ["Leadership changes", profile.businessHealth.leadershipChanges],
            ["Partnerships", profile.businessHealth.partnerships],
            ["Awards", profile.businessHealth.awards],
            ["Financial signals", profile.businessHealth.financialSignals],
            ["Growth indicators", profile.businessHealth.growthIndicators],
          ]}
        />
      </Fold>

      <Fold title={`Technology stack (${profile.technology.length})`}>
        {profile.technology.length > 0 ? (
          <ul className="space-y-1.5 text-sm">
            {profile.technology.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-muted">{t.category}:</span> {t.tool}
                </span>
                <ConfBadge level={t.confidence} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No technology identified.</p>
        )}
      </Fold>

      <Fold title={`Buying signals (${profile.buyingSignals.length})`}>
        {profile.buyingSignals.length > 0 ? (
          <ul className="space-y-2.5 text-sm">
            {profile.buyingSignals.map((s, i) => (
              <li key={i}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{s.signal}</span>
                  <ConfBadge level={s.strength} />
                </div>
                <p className="text-xs text-muted mt-0.5">{s.whyItMatters}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No verified buying signals.</p>
        )}
      </Fold>

      <Fold title="Pain point analysis">
        <PainList label="Confirmed" items={profile.painPoints.confirmed} tone="text-good" />
        <PainList label="Likely (inferred)" items={profile.painPoints.likely} tone="text-warn" />
        <PainList label="Unknown / to validate" items={profile.painPoints.unknown} tone="text-muted" />
      </Fold>

      <Fold title="Opportunity assessment">
        <KV
          rows={[
            ["Potential value", profile.opportunities.potentialValue],
            ["Use cases", profile.opportunities.useCases.join("; ")],
            ["Interest likelihood", profile.opportunities.likelihoodOfInterest],
            ["Sales complexity", profile.opportunities.salesComplexity],
            ["Implementation", profile.opportunities.implementationComplexity],
            ["Sales cycle", profile.opportunities.estimatedSalesCycle],
            ["Expansion", profile.opportunities.expansionPotential],
            ["Cross-sell", profile.opportunities.crossSell.join("; ")],
            ["Upsell", profile.opportunities.upsell.join("; ")],
          ]}
        />
      </Fold>

      <Fold title={`Decision makers (${profile.decisionMakers.length})`}>
        <ul className="space-y-3 text-sm">
          {profile.decisionMakers.map((dm, i) => (
            <li key={i} className="rounded-lg bg-surface-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{dm.name}</span>
                <span className="text-xs text-muted">
                  influence: {dm.buyingInfluence} · authority: {dm.decisionAuthority}
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                {[dm.role, dm.department].filter((x) => x && x !== "Unknown").join(" · ") || "Role unknown"}
              </p>
              <p className="text-xs mt-1">
                <span className="text-muted">Priorities:</span>{" "}
                {dm.likelyPriorities.join(", ")}
              </p>
              <p className="text-xs mt-0.5 text-muted">{dm.relationshipToProject}</p>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title={`Competitive landscape (${profile.competitors.length})`}>
        <ul className="space-y-2 text-sm">
          {profile.competitors.map((c, i) => (
            <li key={i}>
              <span className="font-medium">{c.name}</span>{" "}
              <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                {c.type}
              </span>
              <p className="text-xs text-muted mt-0.5">{c.note}</p>
            </li>
          ))}
        </ul>
      </Fold>

      <Fold title="Personalization opportunities">
        <ul className="space-y-1.5 text-sm list-disc list-inside">
          {profile.personalization.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </Fold>

      <Fold title="Recommended strategy" defaultOpen>
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-muted">Primary angle:</span>{" "}
            {profile.recommendedStrategy.primaryAngle}
          </p>
          <p>
            <span className="text-muted">Secondary angle:</span>{" "}
            {profile.recommendedStrategy.secondaryAngle}
          </p>
          <div>
            <p className="text-muted mb-1">Discovery questions:</p>
            <ol className="list-decimal list-inside space-y-1">
              {profile.recommendedStrategy.discoveryQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </div>
          <KV
            rows={[
              ["First channel", profile.recommendedStrategy.firstChannel],
              ["Suggested CTA", profile.recommendedStrategy.suggestedCta],
              ["Meeting objective", profile.recommendedStrategy.meetingObjective],
            ]}
          />
          <div>
            <p className="text-muted mb-1">Expected objections:</p>
            <ul className="list-disc list-inside space-y-1">
              {profile.recommendedStrategy.expectedObjections.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-muted mb-1">Follow-up cadence:</p>
            <ul className="space-y-0.5">
              {profile.recommendedStrategy.followUpCadence.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </Fold>

      <Fold title="Confidence & research gaps">
        <p className="text-sm mb-2">
          <span className="text-muted">Overall confidence:</span>{" "}
          <ConfBadge level={profile.confidence.level} />
        </p>
        <div className="text-sm space-y-2">
          <div>
            <p className="text-muted mb-1">Research gaps:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {profile.confidence.researchGaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-muted mb-1">Recommended additional research:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {profile.confidence.additionalResearch.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </Fold>
    </div>
  );
}

function Fold({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-line bg-surface-2/40"
    >
      <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground transition list-none flex items-center justify-between">
        {title}
        <span className="text-muted transition group-open:rotate-90">›</span>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function KV({ rows }: { rows: [string, string][] }) {
  const visible = rows.filter(([, v]) => v && v.trim() !== "");
  return (
    <dl className="space-y-1.5 text-sm">
      {visible.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[130px_1fr] gap-2">
          <dt className="text-muted">{k}</dt>
          <dd className={v === "Unknown" ? "text-muted italic" : "break-words"}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const color =
    value >= 70 ? "text-good" : value >= 50 ? "text-warn" : "text-bad";
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ConfBadge({ level }: { level: ConfidenceLevel }) {
  const cls =
    level === "High"
      ? "bg-good/10 text-good"
      : level === "Medium"
        ? "bg-warn/10 text-warn"
        : "bg-bad/10 text-bad";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {level}
    </span>
  );
}

function PainList({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 last:mb-0">
      <p className={`text-xs font-medium mb-1 ${tone}`}>{label}</p>
      <ul className="list-disc list-inside space-y-0.5 text-sm">
        {items.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
