import { promises as fs } from "fs";
import path from "path";
import { Lead, CrmRecord } from "./types";
import { seedLeads } from "./seed";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(seedLeads(), null, 2));
  }
}

export async function getLeads(): Promise<Lead[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const leads: Lead[] = JSON.parse(raw);
  return leads.sort(
    (a, b) => (b.priorityScore ?? -1) - (a.priorityScore ?? -1)
  );
}

export async function getLead(id: string): Promise<Lead | null> {
  const leads = await getLeads();
  return leads.find((l) => l.id === id) ?? null;
}

async function writeLeads(leads: Lead[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(leads, null, 2));
}

export function emptyCrm(): CrmRecord {
  return {
    leadStatus: "new",
    nextAction: "Research and qualify",
    followUpDate: null,
    conversationSummary: "",
    painPoints: [],
    goals: [],
    decisionMakers: [],
    timeline: "",
    competitors: [],
    notes: "",
  };
}

export async function createLead(
  input: Partial<Lead> & { contactName: string; company: string }
): Promise<Lead> {
  const leads = await getLeads();
  const now = new Date().toISOString();
  const lead: Lead = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    contactName: input.contactName,
    contactTitle: input.contactTitle ?? "",
    email: input.email ?? "",
    linkedin: input.linkedin ?? "",
    company: input.company,
    website: input.website ?? "",
    industry: input.industry ?? "",
    companySize: input.companySize ?? "",
    location: input.location ?? "",
    fundingStage: input.fundingStage ?? "",
    techStack: input.techStack ?? [],
    buyingSignals: input.buyingSignals ?? [],
    notes: input.notes ?? "",
    fitScore: null,
    intentScore: null,
    priorityScore: null,
    estimatedDealSize: null,
    closeProbability: null,
    status: "new",
    crm: emptyCrm(),
    activity: [
      {
        id: crypto.randomUUID(),
        timestamp: now,
        type: "note",
        summary: "Lead created",
      },
    ],
  };
  leads.push(lead);
  await writeLeads(leads);
  return lead;
}

export async function updateLead(
  id: string,
  patch: Partial<Lead>
): Promise<Lead | null> {
  const leads = await getLeads();
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leads[idx] = { ...leads[idx], ...patch, id, updatedAt: new Date().toISOString() };
  await writeLeads(leads);
  return leads[idx];
}

export async function deleteLead(id: string): Promise<boolean> {
  const leads = await getLeads();
  const next = leads.filter((l) => l.id !== id);
  if (next.length === leads.length) return false;
  await writeLeads(next);
  return true;
}
