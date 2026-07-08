import Link from "next/link";
import { getProspectIntelligenceReports } from "@/lib/prospect-intelligence-store";
import {
  DiscoveredAccount,
  EnrichedProfile,
  ProspectBuyingSignal,
  ProspectIntelligenceReport,
  ProspectOpportunity,
  RiskLevel,
} from "@/lib/types";
import { RunProspectIntelButton } from "@/components/run-prospect-intel-button";

export const dynamic = "force-dynamic";

export default async function ProspectIntelligencePage() {
  const reports = await getProspectIntelligenceReports();
  const latest: ProspectIntelligenceReport | undefined = reports[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Prospect Intelligence</h1>
          <p className="text-sm text-muted mt-1">
            Data acquisition and prospect intelligence — discover companies,
            enrich records, detect buying signals, score ICP fit, and recommend
            who to contact and why now.
          </p>
        </div>
        <RunProspectIntelButton />
      </div>

      {!latest ? (
        <div className="rounded-xl border border-line bg-surface p-12 text-center text-muted">
          <p className="text-sm">
            No intelligence cycles yet. Run a cycle to discover new accounts,
            enrich contacts, detect buying signals, and rank opportunities by
            revenue potential and timing.
          </p>
        </div>
      ) : (
        <ReportView report={latest} />
      )}

      {reports.length > 1 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Previous cycles
          </h2>
          <ul className="space-y-2">
            {reports.slice(1, 8).map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-line bg-surface px-4 py-3 text-sm flex justify-between gap-3"
              >
                <span className="text-xs text-muted">
                  {new Date(r.timestamp).toLocaleString()}
                </span>
                <span className="text-xs">
                  {r.discoveredAccounts.length} discovered ·{" "}
                  {r.buyingSignals.length} signals · quality{" "}
                  {r.dataQuality.overallScore}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ReportView({ report }: { report: ProspectIntelligenceReport }) {
  const dq = report.dataQuality;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Latest cycle: {new Date(report.timestamp).toLocaleString()} · engine:{" "}
        {report.engine === "openai" ? "OpenAI" : "demo"} · confidence:{" "}
        {report.confidence.level}
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Discovered" value={String(report.discoveredAccounts.length)} />
        <Stat label="Contacts" value={String(report.newContacts.length)} />
        <Stat label="Signals" value={String(report.buyingSignals.length)} />
        <Stat label="Opportunities" value={String(report.topOpportunities.length)} />
        <Stat
          label="Data quality"
          value={`${dq.overallScore}/100`}
          warn={dq.overallScore < 70}
        />
      </div>

      <Card title="Market insights">
        <p className="text-sm">{report.marketInsights.summary}</p>
        <p className="text-xs text-muted mt-2">{report.marketInsights.signalVolume}</p>
        {report.marketInsights.trends.length > 0 && (
          <ul className="mt-3 list-disc list-inside text-xs text-muted space-y-0.5">
            {report.marketInsights.trends.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}
        {report.marketInsights.highIntentIndustries.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {report.marketInsights.highIntentIndustries.map((ind) => (
              <span
                key={ind}
                className="text-[10px] px-2 py-0.5 rounded-full bg-accent-soft text-accent"
              >
                {ind}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card title={`Top opportunities (${report.topOpportunities.length})`}>
        {report.topOpportunities.length === 0 ? (
          <p className="text-sm text-muted">No ranked opportunities.</p>
        ) : (
          <ul className="space-y-3">
            {report.topOpportunities.map((o) => (
              <OpportunityRow key={o.accountId} opp={o} />
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AccountList
          title={`New companies (${report.discoveredAccounts.length})`}
          accounts={report.discoveredAccounts}
          empty="No new companies discovered — universe may be fully mapped to CRM."
        />
        <SignalList
          title={`Buying signals (${report.buyingSignals.length})`}
          signals={report.buyingSignals.slice(0, 8)}
        />
        <ContactList title={`Contacts (${report.newContacts.length})`} contacts={report.newContacts.slice(0, 8)} />
        <MissionList title={`Missions (${report.missionsCreated.length})`} missions={report.missionsCreated} />
      </div>

      <Card title={`Enriched profiles (${report.enrichedProfiles.length})`}>
        <div className="space-y-4">
          {report.enrichedProfiles.slice(0, 4).map((p) => (
            <ProfileCard key={p.accountId} profile={p} />
          ))}
        </div>
      </Card>

      <Card title="Data quality">
        <div className="grid sm:grid-cols-4 gap-4 text-sm mb-3">
          <div>
            <p className="text-xs text-muted">Completeness</p>
            <p className="font-semibold">{dq.completeness}%</p>
          </div>
          <div>
            <p className="text-xs text-muted">Accuracy</p>
            <p className="font-semibold">{dq.accuracy}%</p>
          </div>
          <div>
            <p className="text-xs text-muted">Freshness</p>
            <p className="font-semibold">{dq.freshness}%</p>
          </div>
          <div>
            <p className="text-xs text-muted">Duplicates flagged</p>
            <p className="font-semibold">{dq.duplicateCount}</p>
          </div>
        </div>
        <p className="text-xs text-muted">{dq.explanation}</p>
        {dq.gaps.length > 0 && (
          <ul className="mt-2 list-disc list-inside text-xs text-warn space-y-0.5">
            {dq.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted">{report.confidence.explanation}</p>
    </div>
  );
}

function OpportunityRow({ opp }: { opp: ProspectOpportunity }) {
  return (
    <li className="rounded-lg border border-line bg-surface-2/40 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          #{opp.rank} {opp.company}
        </p>
        <PriorityBadge level={opp.urgency} />
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
        <span>ICP {opp.icpScore}</span>
        <span>Priority {opp.priorityScore}</span>
        <span>{opp.expectedDealSize}</span>
        <span>{opp.closeProbability}% close</span>
        <span>Intent: {opp.buyingIntent}</span>
      </div>
      <p className="text-xs mt-2">
        <span className="text-muted">Why now:</span> {opp.whyNow}
      </p>
      <p className="text-xs mt-1 text-good">→ {opp.recommendedNextAction}</p>
    </li>
  );
}

function AccountList({
  title,
  accounts,
  empty,
}: {
  title: string;
  accounts: DiscoveredAccount[];
  empty: string;
}) {
  return (
    <Card title={title}>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li key={a.id} className="rounded-lg border border-good/30 bg-good/5 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <p className="font-medium">
                  {a.leadId ? (
                    <Link href={`/leads/${a.leadId}`} className="hover:text-accent">
                      {a.company}
                    </Link>
                  ) : (
                    a.company
                  )}
                </p>
                <span className="text-xs font-semibold text-accent">ICP {a.icpScore}</span>
              </div>
              <p className="text-xs text-muted mt-1">{a.industry} · {a.employees} · {a.location}</p>
              <p className="text-xs mt-1">{a.icpExplanation}</p>
              {a.duplicateOf && (
                <p className="text-[10px] text-warn mt-1">
                  Possible duplicate of CRM record — recommend merge review
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function SignalList({
  title,
  signals,
}: {
  title: string;
  signals: ProspectBuyingSignal[];
}) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {signals.map((s) => (
          <li key={s.id} className="rounded-lg border border-line p-2.5">
            <p className="font-medium">{s.company}</p>
            <p className="text-xs mt-0.5">{s.signal}</p>
            <p className="text-[10px] text-muted mt-1">
              {s.source} · {s.strength} · {s.date}
            </p>
            <p className="text-xs text-muted mt-1">{s.businessMeaning}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ContactList({
  title,
  contacts,
}: {
  title: string;
  contacts: ProspectIntelligenceReport["newContacts"];
}) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {contacts.map((c) => (
          <li key={c.id} className="flex justify-between gap-2 border-b border-line/50 pb-2 last:border-0">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted">
                {c.role} · {c.company}
              </p>
            </div>
            <span className="text-[10px] text-muted shrink-0">{c.decisionInfluence}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MissionList({
  title,
  missions,
}: {
  title: string;
  missions: ProspectIntelligenceReport["missionsCreated"];
}) {
  return (
    <Card title={title}>
      <ul className="space-y-2 text-sm">
        {missions.map((m) => (
          <li key={m.id} className="rounded-lg border border-line p-3">
            <p className="font-medium flex items-center gap-2">
              <PriorityBadge level={m.priority} />
              {m.name}
            </p>
            <p className="text-xs text-muted mt-1">{m.reason}</p>
            <p className="text-xs mt-1">→ {m.expectedOutcome}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ProfileCard({ profile }: { profile: EnrichedProfile }) {
  return (
    <div className="rounded-lg border border-line p-4 text-sm">
      <p className="font-medium">{profile.company}</p>
      <p className="text-xs text-muted mt-1">{profile.overview}</p>
      <p className="text-xs mt-2">
        <span className="text-muted">Angle:</span> {profile.recommendedOutreachAngle}
      </p>
      {profile.likelyPainPoints.length > 0 && (
        <p className="text-xs mt-1 text-muted">
          Pains: {profile.likelyPainPoints.join("; ")}
        </p>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-semibold mt-0.5 ${warn ? "text-warn" : ""}`}>
        {value}
      </p>
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
