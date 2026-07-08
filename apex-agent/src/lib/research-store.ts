import { promises as fs } from "fs";
import path from "path";
import { ResearchProfile } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const RESEARCH_FILE = path.join(DATA_DIR, "research.json");

async function readAll(): Promise<Record<string, ResearchProfile>> {
  try {
    const raw = await fs.readFile(RESEARCH_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getResearch(
  leadId: string
): Promise<ResearchProfile | null> {
  const all = await readAll();
  return all[leadId] ?? null;
}

export async function saveResearch(profile: ResearchProfile): Promise<void> {
  const all = await readAll();
  all[profile.leadId] = profile;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RESEARCH_FILE, JSON.stringify(all, null, 2));
}
