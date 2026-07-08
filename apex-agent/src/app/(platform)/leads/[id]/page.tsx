import Link from "next/link";
import { notFound } from "next/navigation";
import { getLead } from "@/lib/store";
import { getResearch } from "@/lib/research-store";
import { getPlan } from "@/lib/plan-store";
import { getPlaybook } from "@/lib/outreach-store";
import { getReplyAnalyses } from "@/lib/reply-store";
import { getMeetingReports } from "@/lib/meeting-store";
import { StatusBadge, ScorePill } from "@/components/badges";
import { AgentPanel } from "@/components/agent-panel";
import { ResearchPanel } from "@/components/research-panel";
import { PlanPanel } from "@/components/plan-panel";
import { OutreachPanel } from "@/components/outreach-panel";
import { ReplyPanel } from "@/components/reply-panel";
import { MeetingPanel } from "@/components/meeting-panel";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();
  const research = await getResearch(id);
  const plan = await getPlan(id);
  const playbook = await getPlaybook(id);
  const replyAnalyses = await getReplyAnalyses(id);
  const meetingReports = await getMeetingReports(id);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-xs text-muted hover:text-foreground transition">
          ← Back to pipeline
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              {lead.contactName}
              <StatusBadge status={lead.status} />
            </h1>
            <p className="text-sm text-muted mt-1">
              {[lead.contactTitle, lead.company, lead.location]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex gap-2">
            <ScorePill label="Fit" value={lead.fitScore} />
            <ScorePill label="Intent" value={lead.intentScore} />
            <ScorePill label="Priority" value={lead.priorityScore} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Company">
            <DL
              rows={[
                ["Company", lead.company],
                ["Website", lead.website],
                ["Industry", lead.industry],
                ["Size", lead.companySize],
                ["Funding", lead.fundingStage],
                ["Tech stack", lead.techStack.join(", ")],
                ["Est. deal size", lead.estimatedDealSize ?? ""],
                [
                  "Close probability",
                  lead.closeProbability !== null
                    ? `${lead.closeProbability}%`
                    : "",
                ],
              ]}
            />
          </Section>

          <Section title="Buying signals">
            {lead.buyingSignals.length > 0 ? (
              <ul className="space-y-1.5 text-sm">
                {lead.buyingSignals.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-good mt-0.5">▲</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None recorded.</p>
            )}
          </Section>

          <Section title="CRM record">
            <DL
              rows={[
                ["Next action", lead.crm.nextAction],
                ["Follow-up date", lead.crm.followUpDate ?? ""],
                ["Timeline", lead.crm.timeline],
                ["Pain points", lead.crm.painPoints.join("; ")],
                ["Goals", lead.crm.goals.join("; ")],
                ["Decision makers", lead.crm.decisionMakers.join("; ")],
                ["Competitors", lead.crm.competitors.join("; ")],
                ["Summary", lead.crm.conversationSummary],
                ["Notes", lead.crm.notes],
              ]}
            />
          </Section>

          <Section title="Activity">
            <ul className="space-y-3">
              {[...lead.activity].reverse().map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-foreground">{a.summary}</p>
                  <p className="text-xs text-muted">
                    {new Date(a.timestamp).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <ResearchPanel leadId={lead.id} initialProfile={research} />
          <PlanPanel leadId={lead.id} initialPlan={plan} />
          <OutreachPanel leadId={lead.id} initialPlaybook={playbook} />
          <ReplyPanel leadId={lead.id} initialAnalyses={replyAnalyses} />
          <MeetingPanel leadId={lead.id} initialReports={meetingReports} />
          <AgentPanel leadId={lead.id} />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DL({ rows }: { rows: [string, string][] }) {
  const visible = rows.filter(([, v]) => v && v.trim() !== "");
  if (visible.length === 0)
    return <p className="text-sm text-muted">Nothing recorded yet.</p>;
  return (
    <dl className="space-y-2 text-sm">
      {visible.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
          <dt className="text-muted">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
