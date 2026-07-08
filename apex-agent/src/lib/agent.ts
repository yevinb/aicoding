import OpenAI from "openai";
import { AgentOutput, Lead, NextActionType } from "./types";
import { APEX_SYSTEM_PROMPT } from "./system-prompt";

function leadBrief(lead: Lead): string {
  return JSON.stringify(
    {
      contact: {
        name: lead.contactName,
        title: lead.contactTitle,
        email: lead.email,
        linkedin: lead.linkedin,
      },
      company: {
        name: lead.company,
        website: lead.website,
        industry: lead.industry,
        size: lead.companySize,
        location: lead.location,
        funding: lead.fundingStage,
        techStack: lead.techStack,
      },
      buyingSignals: lead.buyingSignals,
      notes: lead.notes,
      currentStatus: lead.status,
      existingCrm: lead.crm,
      recentActivity: lead.activity.slice(-5).map((a) => ({
        when: a.timestamp,
        type: a.type,
        summary: a.summary,
      })),
    },
    null,
    2
  );
}

export async function runAgent(
  lead: Lead,
  instruction?: string
): Promise<AgentOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return demoRun(lead, instruction);
  }

  const client = new OpenAI({ apiKey });
  const userMessage = [
    "Here is the lead record from our CRM:",
    leadBrief(lead),
    instruction
      ? `\nSpecific instruction from the sales manager: ${instruction}`
      : "\nRun your full autonomous decision framework on this lead and produce the JSON output.",
  ].join("\n");

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: APEX_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Omit<AgentOutput, "engine">;
  return { ...parsed, engine: "openai" };
}

/**
 * Deterministic fallback so the app is fully usable without an API key.
 * Scores are derived from the actual lead data (signals, funding, title, notes).
 */
export function demoRun(lead: Lead, instruction?: string): AgentOutput {
  const signals = lead.buyingSignals.length;
  const hasFunding = /series|seed|\$|funded|equity/i.test(lead.fundingStage);
  const seniorTitle = /vp|chief|head|director|founder|c[eoft]o/i.test(
    lead.contactTitle
  );
  const hasEngagement = lead.status === "engaged" || lead.status === "contacted";

  const fitScore = Math.min(
    95,
    40 + (hasFunding ? 15 : 0) + (seniorTitle ? 15 : 5) + (lead.industry ? 10 : 0) + signals * 4
  );
  const intentScore = Math.min(95, 20 + signals * 15 + (hasEngagement ? 25 : 0));
  const priorityScore = Math.round(fitScore * 0.5 + intentScore * 0.5);
  const closeProbability = Math.max(5, Math.round(priorityScore * 0.45));

  const sizeGuess = /\d{3,}/.test(lead.companySize)
    ? "$80,000–$150,000 ARR"
    : hasFunding
      ? "$30,000–$60,000 ARR"
      : "$10,000–$25,000 ARR";

  let action: NextActionType;
  let label: string;
  let reason: string;

  if (priorityScore >= 75 && hasEngagement) {
    action = "book_meeting";
    label = "Propose a 30-minute meeting";
    reason =
      "Need is validated, a senior decision maker is engaged, and intent signals are strong. A meeting is the lowest-friction next step.";
  } else if (priorityScore >= 60) {
    action = "send_email";
    label = "Send personalized outreach email";
    reason =
      "Strong fit with credible buying signals. A relevant, low-pressure first touch is the best way to open the conversation.";
  } else if (intentScore < 35 && fitScore >= 55) {
    action = "wait";
    label = "Nurture and revisit in 3 weeks";
    reason =
      "Good long-term fit but no current urgency. Pushing now would burn goodwill; nurturing preserves the relationship.";
  } else {
    action = "request_info";
    label = "Gather more information before outreach";
    reason =
      "Not enough verified data to personalize credibly. Research gaps should be closed before any outreach is sent.";
  }

  const firstName = lead.contactName.split(" ")[0];
  const signal = lead.buyingSignals[0];

  const outreachMessage =
    action === "send_email" || action === "book_meeting"
      ? {
          channel: "email" as const,
          subject:
            action === "book_meeting"
              ? `Next step for ${lead.company}?`
              : `Quick question, ${firstName}`,
          body: [
            `Hi ${firstName},`,
            "",
            signal
              ? `I noticed ${lead.company} ${signal.charAt(0).toLowerCase() + signal.slice(1)} — usually that means the team is under pressure to show results fast.`
              : `I've been following ${lead.company} and the pace you're moving in ${lead.industry || "your market"}.`,
            "",
            action === "book_meeting"
              ? `Based on our conversation so far, it sounds like the main question is whether we can solve this cleanly for your team. Happy to walk through exactly how in 30 minutes — would Tuesday or Thursday afternoon work?`
              : `We help teams like yours turn that pressure into a repeatable pipeline without adding headcount. If that's a live problem for you, worth a short conversation?`,
            "",
            "Best,",
            "Apex",
          ].join("\n"),
        }
      : null;

  const today = new Date();
  const inDays = (n: number) =>
    new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);

  return {
    leadSummary: `${lead.contactName}${lead.contactTitle ? ` (${lead.contactTitle})` : ""} at ${lead.company}${lead.industry ? `, a ${lead.companySize || ""} ${lead.industry} company`.replace("  ", " ") : ""}${lead.location ? ` based in ${lead.location}` : ""}. ${
      signals > 0
        ? `Key signals: ${lead.buyingSignals.slice(0, 2).join("; ")}.`
        : "No strong buying signals identified yet — intent is unproven."
    }${instruction ? ` Manager instruction applied: ${instruction}` : ""}`,
    qualification: {
      fitScore,
      intentScore,
      priorityScore,
      estimatedDealSize: sizeGuess,
      closeProbability,
    },
    recommendedNextAction: { action, label, reason },
    outreachMessage,
    followUpPlan:
      action === "wait"
        ? [
            `${inDays(21)}: Re-check for new signals (hiring, funding, announcements)`,
            `${inDays(21)}: Share one relevant case study if fit still holds`,
            `${inDays(35)}: Re-score lead and decide on outreach`,
          ]
        : [
            `${inDays(3)}: If no reply, send a short value-add follow-up`,
            `${inDays(7)}: Try a second channel (LinkedIn) with a different angle`,
            `${inDays(14)}: Final check-in, then move to nurture if silent`,
          ],
    crmUpdate: {
      leadStatus:
        action === "book_meeting"
          ? "engaged"
          : action === "send_email"
            ? "contacted"
            : action === "wait"
              ? "nurturing"
              : "researching",
      nextAction: label,
      followUpDate: action === "wait" ? inDays(21) : inDays(3),
      conversationSummary:
        lead.crm.conversationSummary ||
        "No conversation yet. Initial qualification completed.",
      painPoints: lead.crm.painPoints.length
        ? lead.crm.painPoints
        : signal
          ? [`Likely pressure from: ${signal}`]
          : ["Unknown — to be discovered"],
      goals: lead.crm.goals.length ? lead.crm.goals : ["Unknown — to be discovered"],
      decisionMakers: lead.crm.decisionMakers.length
        ? lead.crm.decisionMakers
        : [`${lead.contactName}${lead.contactTitle ? ` (${lead.contactTitle})` : ""}`],
      timeline: lead.crm.timeline || "Unknown",
      competitors: lead.crm.competitors,
      notes: lead.crm.notes || "Scored via demo engine (no API key configured).",
    },
    confidenceLevel:
      priorityScore >= 70 ? "High" : priorityScore >= 50 ? "Medium" : "Low",
    engine: "demo",
  };
}
