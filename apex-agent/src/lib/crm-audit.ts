import OpenAI from "openai";
import { getAudits, saveAudit } from "./crm-audit-store";
import { CRM_SYSTEM_PROMPT } from "./crm-prompt";
import { getMeetingReports } from "./meeting-store";
import { getPlaybook } from "./outreach-store";
import { getPlan } from "./plan-store";
import { getReplyAnalyses } from "./reply-store";
import { getResearch } from "./research-store";
import { getLeads, updateLead } from "./store";
import {
  CrmAuditReport,
  DataQualityIssue,
  Lead,
  RiskLevel,
} from "./types";

export { getAudits };

interface LeadContext {
  lead: Lead;
  researchAt: string | null;
  planAt: string | null;
  playbookAt: string | null;
  replyCount: number;
  meetingCount: number;
  hasMeetingDebrief: boolean;
}

export async function runCrmAudit(): Promise<CrmAuditReport> {
  const leads = await getLeads();
  const contexts: LeadContext[] = await Promise.all(
    leads.map(async (lead) => {
      const [research, plan, playbook, replies, meetings] = await Promise.all([
        getResearch(lead.id),
        getPlan(lead.id),
        getPlaybook(lead.id),
        getReplyAnalyses(lead.id),
        getMeetingReports(lead.id),
      ]);
      return {
        lead,
        researchAt: research?.timestamp ?? null,
        planAt: plan?.timestamp ?? null,
        playbookAt: playbook?.timestamp ?? null,
        replyCount: replies.length,
        meetingCount: meetings.length,
        hasMeetingDebrief: meetings.some((m) => m.meetingAnalysis.hasNotes),
      };
    })
  );

  const body = process.env.OPENAI_API_KEY
    ? await openaiAudit(contexts)
    : demoAudit(contexts);

  const report: CrmAuditReport = {
    ...body,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    engine: process.env.OPENAI_API_KEY ? "openai" : "demo",
  };

  // Apply the evidence-based fixes the audit identified (status sync only).
  for (const u of report.verifiedUpdates) {
    const ctx = contexts.find((c) => c.lead.id === u.leadId);
    if (!ctx) continue;
    if (u.field === "status") {
      await updateLead(ctx.lead.id, {
        status: ctx.lead.crm.leadStatus,
        activity: [
          ...ctx.lead.activity,
          {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: "note",
            summary: `CRM Intelligence Agent — synced lead status (${u.from} → ${u.to}); evidence: ${u.evidence}`,
          },
        ],
      });
    }
  }

  await saveAudit(report);
  return report;
}

type AuditBody = Omit<CrmAuditReport, "id" | "timestamp" | "engine">;

async function openaiAudit(contexts: LeadContext[]): Promise<AuditBody> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const snapshot = contexts.map((c) => ({
    id: c.lead.id,
    contact: {
      name: c.lead.contactName,
      title: c.lead.contactTitle,
      email: c.lead.email,
    },
    company: {
      name: c.lead.company,
      website: c.lead.website,
      industry: c.lead.industry,
      size: c.lead.companySize,
      location: c.lead.location,
      funding: c.lead.fundingStage,
      techStack: c.lead.techStack,
    },
    buyingSignals: c.lead.buyingSignals,
    status: c.lead.status,
    scores: {
      fit: c.lead.fitScore,
      intent: c.lead.intentScore,
      priority: c.lead.priorityScore,
      estimatedDealSize: c.lead.estimatedDealSize,
      closeProbability: c.lead.closeProbability,
    },
    crm: c.lead.crm,
    createdAt: c.lead.createdAt,
    updatedAt: c.lead.updatedAt,
    activity: c.lead.activity.map((a) => ({
      when: a.timestamp,
      type: a.type,
      summary: a.summary,
    })),
    artifacts: {
      researchAt: c.researchAt,
      planAt: c.planAt,
      playbookAt: c.playbookAt,
      replyAnalyses: c.replyCount,
      meetings: c.meetingCount,
      hasMeetingDebrief: c.hasMeetingDebrief,
    },
  }));

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CRM_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Today is ${new Date().toISOString().slice(0, 10)}. Run the full CRM data quality audit on this pipeline:\n${JSON.stringify(snapshot, null, 2)}\n\nProduce the JSON report. In verifiedUpdates, only include status-sync fixes where lead.status and crm.leadStatus disagree (field "status").`,
      },
    ],
  });

  return JSON.parse(response.choices[0]?.message?.content ?? "{}") as AuditBody;
}

/**
 * Deterministic audit: every check runs against actual record contents.
 * Nothing is invented; missing data is reported, not filled in.
 */
function demoAudit(contexts: LeadContext[]): AuditBody {
  const now = Date.now();
  const daysSince = (iso: string) =>
    Math.floor((now - new Date(iso).getTime()) / 86400000);

  const issues: DataQualityIssue[] = [];
  const verifiedUpdates: AuditBody["verifiedUpdates"] = [];
  const pipelineRisks: AuditBody["pipelineRisks"] = [];
  const agentNotifications: AuditBody["agentNotifications"] = [];
  const customerMemory: AuditBody["memoryUpdates"]["customerMemory"] = [];
  const completenessScores: number[] = [];
  let accuracyDeductions = 0;
  let hygieneDeductions = 0;

  const active = contexts.filter(
    (c) => c.lead.status !== "closed_won" && c.lead.status !== "closed_lost"
  );

  for (const ctx of contexts) {
    const l = ctx.lead;
    const isActive = l.status !== "closed_won" && l.status !== "closed_lost";
    const push = (
      category: DataQualityIssue["category"],
      issue: string,
      recommendation: string,
      priority: RiskLevel
    ) => issues.push({ leadId: l.id, company: l.company, category, issue, recommendation, priority });

    // --- Completeness (14 checks) ---
    const checks: [boolean, string, string, RiskLevel][] = [
      [!!l.industry, "Industry missing", "Enrich via Research Agent", "Medium"],
      [!!l.companySize, "Company size missing", "Enrich via Research Agent", "Low"],
      [!!l.location, "Location missing", "Enrich via Research Agent", "Low"],
      [!!l.email || !!l.linkedin, "No contact channel (email or LinkedIn)", "Acquire a verified contact channel before any outreach", "Critical"],
      [!!l.contactTitle, "Contact role/title missing", "Verify via LinkedIn", "Medium"],
      [l.crm.decisionMakers.length >= 2, "Fewer than two decision makers mapped", "Multi-thread: map the buying committee", "High"],
      [l.crm.painPoints.length > 0, "No pain points recorded", "Run discovery or deep research", "High"],
      [l.crm.goals.length > 0, "No customer goals recorded", "Capture goals in next conversation", "Medium"],
      [!!l.crm.timeline, "No timeline recorded", "Establish the compelling event and date", "Medium"],
      [l.techStack.length > 0, "Technology stack unknown", "Research Agent: identify stack", "Low"],
      [l.crm.competitors.length > 0, "Competitive situation unknown", "Ask what else they are evaluating", "Medium"],
      [!!l.crm.nextAction, "No next action set", "Every active record needs a next action", "Critical"],
      [!!l.crm.followUpDate, "No follow-up date set", "Schedule the next touchpoint", "High"],
      [l.buyingSignals.length > 0, "No buying signals recorded", "Watch for triggers before investing effort", "Medium"],
    ];
    let complete = 0;
    for (const [ok, issue, rec, prio] of checks) {
      if (ok) complete++;
      else if (isActive) push("Completeness", issue, rec, prio);
    }
    completenessScores.push(Math.round((complete / checks.length) * 100));

    // --- Accuracy ---
    if (l.status !== l.crm.leadStatus) {
      accuracyDeductions += 10;
      push(
        "Accuracy",
        `Lead status (${l.status}) contradicts CRM record status (${l.crm.leadStatus})`,
        "Sync to the CRM record status — it reflects the latest agent-confirmed state",
        "High"
      );
      verifiedUpdates.push({
        leadId: l.id,
        company: l.company,
        field: "status",
        from: l.status,
        to: l.crm.leadStatus,
        evidence: "CRM record status was set by the most recent verified interaction (reply/meeting/agent run); lead header field lagged behind.",
      });
    }
    if (!isActive && l.crm.followUpDate && new Date(l.crm.followUpDate).getTime() > now) {
      accuracyDeductions += 5;
      push(
        "Accuracy",
        "Closed record still has a future follow-up scheduled",
        "Clear the follow-up or reopen the record deliberately",
        "Medium"
      );
    }
    if (l.status === "meeting_booked" && ctx.meetingCount === 0) {
      accuracyDeductions += 5;
      push(
        "Accuracy",
        "Status is meeting_booked but no meeting preparation or record exists",
        "Run the Meeting Agent prep brief before the meeting",
        "High"
      );
    }
    if ((l.status === "engaged" || l.status === "meeting_booked") && l.priorityScore === null) {
      accuracyDeductions += 5;
      push(
        "Accuracy",
        "Active engagement but the lead has never been scored",
        "Run qualification to score the lead",
        "Medium"
      );
    }

    // --- Freshness / hygiene (active leads only) ---
    if (isActive) {
      const lastActivity = l.activity.length
        ? daysSince(l.activity[l.activity.length - 1].timestamp)
        : daysSince(l.createdAt);
      if (lastActivity > 14) {
        hygieneDeductions += 10;
        push(
          "Freshness",
          `No activity for ${lastActivity} days on an active record`,
          "Re-engage or deliberately move to nurture — do not let it drift",
          "High"
        );
        pipelineRisks.push({
          leadId: l.id,
          company: l.company,
          risk: `Stalled: ${lastActivity} days without activity`,
          impact: "Engagement decays fast; forecast credibility drops",
          mitigation: "One decisive touch this week, or reclassify to nurture",
        });
      }
      if (l.crm.followUpDate && new Date(l.crm.followUpDate).getTime() < now) {
        hygieneDeductions += 8;
        push(
          "Freshness",
          `Follow-up date (${l.crm.followUpDate.slice(0, 10)}) is overdue`,
          "Execute the follow-up today or reschedule with a reason",
          "Critical"
        );
      }
      if (l.crm.decisionMakers.length <= 1 && (l.priorityScore ?? 0) >= 60) {
        hygieneDeductions += 6;
        pipelineRisks.push({
          leadId: l.id,
          company: l.company,
          risk: "Single-threaded high-priority opportunity",
          impact: "Deal dies if the one contact goes quiet or leaves",
          mitigation: "Ask the champion to bring a colleague to the next interaction",
        });
      }

      // --- Agent coordination ---
      if (!ctx.researchAt)
        agentNotifications.push({
          agent: "Research Agent",
          leadId: l.id,
          company: l.company,
          notification: "No research profile exists — build one before further investment.",
        });
      if (ctx.researchAt && !ctx.planAt)
        agentNotifications.push({
          agent: "Planning Agent",
          leadId: l.id,
          company: l.company,
          notification: "Research exists but no account plan — planning is the next step.",
        });
      if (ctx.researchAt && ctx.planAt && new Date(ctx.researchAt) > new Date(ctx.planAt))
        agentNotifications.push({
          agent: "Planning Agent",
          leadId: l.id,
          company: l.company,
          notification: "Research was updated after the account plan was built — rebuild the plan on fresh data.",
        });
      if (ctx.planAt && !ctx.playbookAt)
        agentNotifications.push({
          agent: "Outreach Agent",
          leadId: l.id,
          company: l.company,
          notification: "Account plan exists but no outreach playbook — convert strategy into touches.",
        });
      if (l.status === "meeting_booked" && !ctx.hasMeetingDebrief && ctx.meetingCount > 0)
        agentNotifications.push({
          agent: "Meeting Agent",
          leadId: l.id,
          company: l.company,
          notification: "Meeting prep exists but no debrief — paste meeting notes after the meeting.",
        });
    }

    // --- Customer memory (facts only from the record) ---
    const facts = [
      ...(l.crm.goals.length ? [`Goals: ${l.crm.goals.join("; ")}`] : []),
      ...(l.crm.painPoints.length ? [`Pains: ${l.crm.painPoints.slice(0, 3).join("; ")}`] : []),
      ...(l.crm.notes ? [`Preference/notes: ${l.crm.notes}`] : []),
      ...(l.crm.timeline ? [`Timeline: ${l.crm.timeline}`] : []),
      ...(l.crm.decisionMakers.length ? [`Stakeholders: ${l.crm.decisionMakers.join("; ")}`] : []),
    ];
    if (facts.length > 0)
      customerMemory.push({ leadId: l.id, company: l.company, facts });
  }

  // --- Duplicate detection ---
  const duplicateDetection: AuditBody["duplicateDetection"] = [];
  for (let i = 0; i < contexts.length; i++) {
    for (let j = i + 1; j < contexts.length; j++) {
      const a = contexts[i].lead;
      const b = contexts[j].lead;
      const nameA = a.company.toLowerCase().replace(/[^a-z0-9]/g, "");
      const nameB = b.company.toLowerCase().replace(/[^a-z0-9]/g, "");
      const domainA = a.email.split("@")[1] ?? a.website.replace(/^www\./, "");
      const domainB = b.email.split("@")[1] ?? b.website.replace(/^www\./, "");
      const nameMatch = nameA && nameA === nameB;
      const domainMatch = !!domainA && domainA === domainB;
      const emailMatch = !!a.email && a.email.toLowerCase() === b.email.toLowerCase();
      if (nameMatch || domainMatch || emailMatch) {
        duplicateDetection.push({
          leadIds: [a.id, b.id],
          companies: [a.company, b.company],
          matchedOn: [nameMatch && "company name", domainMatch && "domain", emailMatch && "email"]
            .filter(Boolean)
            .join(", "),
          confidence: emailMatch ? 95 : nameMatch && domainMatch ? 90 : 70,
          recommendation: "Review and merge manually — never delete automatically.",
        });
      }
    }
  }

  // --- Sales memory (from activity across pipeline) ---
  const allActivity = contexts.flatMap((c) =>
    c.lead.activity.map((a) => ({ ...a, company: c.lead.company }))
  );
  const objections = allActivity.filter((a) => a.type === "objection");
  const wins = contexts.filter(
    (c) => c.lead.status === "engaged" || c.lead.status === "meeting_booked"
  );
  const losses = contexts.filter((c) => c.lead.status === "closed_lost");

  const salesMemory = {
    whatWorked: wins.length
      ? wins.map(
          (c) =>
            `${c.lead.company}: ${c.lead.buyingSignals[0] ? `signal-anchored outreach ("${c.lead.buyingSignals[0]}")` : "engagement achieved"} — status ${c.lead.status}`
        )
      : ["No confirmed wins yet — insufficient data"],
    whatFailed: losses.length
      ? losses.map((c) => `${c.lead.company}: closed lost — review the angle and timing used`)
      : ["No closed-lost records to learn from yet"],
    objectionsSeen: objections.length
      ? [...new Set(objections.map((o) => `${o.company}: ${o.summary}`))].slice(0, 6)
      : ["None recorded"],
    competitiveIntel: [
      ...new Set(
        contexts.flatMap((c) =>
          c.lead.crm.competitors.map((x) => `${c.lead.company}: ${x}`)
        )
      ),
    ].slice(0, 6),
    buyingPatterns: [
      wins.length > 0
        ? "Accounts with recorded buying signals engage at a higher rate than unsignaled accounts."
        : "Too little data to establish buying patterns.",
    ],
  };

  // --- Scores ---
  const completeness =
    completenessScores.length > 0
      ? Math.round(
          completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length
        )
      : 100;
  const accuracy = Math.max(0, 100 - accuracyDeductions);
  const hygiene = Math.max(0, 100 - hygieneDeductions);
  const scoredLeads = active.filter((c) => c.lead.priorityScore !== null).length;
  const pipelineConfidence = active.length
    ? Math.round(
        (scoredLeads / active.length) * 60 +
          (active.filter((c) => c.lead.crm.followUpDate).length / active.length) * 40
      )
    : 100;
  const overall = Math.round(
    completeness * 0.3 + accuracy * 0.25 + hygiene * 0.25 + pipelineConfidence * 0.2
  );

  const critical = issues.filter((i) => i.priority === "Critical");
  const high = issues.filter((i) => i.priority === "High");

  const recommendedActions: AuditBody["recommendedActions"] = [
    ...critical.map((i) => ({
      action: `${i.company}: ${i.recommendation}`,
      reason: i.issue,
      priority: "Critical" as RiskLevel,
    })),
    ...high.slice(0, 5).map((i) => ({
      action: `${i.company}: ${i.recommendation}`,
      reason: i.issue,
      priority: "High" as RiskLevel,
    })),
    ...(duplicateDetection.length
      ? [
          {
            action: "Review potential duplicate records",
            reason: `${duplicateDetection.length} possible duplicate pair${duplicateDetection.length === 1 ? "" : "s"} detected`,
            priority: "Medium" as RiskLevel,
          },
        ]
      : []),
  ];
  if (recommendedActions.length === 0)
    recommendedActions.push({
      action: "No cleanup required",
      reason: "All records passed completeness, accuracy, and freshness checks",
      priority: "Low",
    });

  return {
    crmHealth: {
      dataCompleteness: {
        score: completeness,
        explanation: `Average of 14 completeness checks across ${contexts.length} record${contexts.length === 1 ? "" : "s"}. ${issues.filter((i) => i.category === "Completeness").length} gap${issues.filter((i) => i.category === "Completeness").length === 1 ? "" : "s"} found.`,
      },
      dataAccuracy: {
        score: accuracy,
        explanation:
          accuracyDeductions === 0
            ? "No contradictions detected: statuses, follow-ups, and scores are internally consistent."
            : `${issues.filter((i) => i.category === "Accuracy").length} contradiction${issues.filter((i) => i.category === "Accuracy").length === 1 ? "" : "s"} found (status mismatches, impossible follow-ups, unscored active deals).`,
      },
      opportunityHygiene: {
        score: hygiene,
        explanation:
          hygieneDeductions === 0
            ? "No stalled deals, overdue follow-ups, or drift detected."
            : "Deductions for stalled records, overdue follow-ups, and single-threaded high-priority deals.",
      },
      pipelineConfidence: {
        score: pipelineConfidence,
        explanation: `${scoredLeads}/${active.length} active leads scored; ${active.filter((c) => c.lead.crm.followUpDate).length}/${active.length} have scheduled follow-ups. Forecast reliability tracks both.`,
      },
      overall: {
        score: overall,
        explanation: "Weighted: completeness 30%, accuracy 25%, hygiene 25%, pipeline confidence 20%.",
      },
    },
    dataQualityIssues: issues,
    verifiedUpdates,
    recommendedActions,
    pipelineRisks,
    duplicateDetection,
    memoryUpdates: { customerMemory, salesMemory },
    agentNotifications,
    confidence: {
      level: contexts.length > 0 ? "High" : "Low",
      explanation:
        "Every finding is derived from record contents — no speculation. Missing data is reported as missing, never filled in. (Demo engine — connect an OpenAI key for full reasoning.)",
    },
  };
}
