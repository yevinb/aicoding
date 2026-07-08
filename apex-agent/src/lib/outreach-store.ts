import { promises as fs } from "fs";
import path from "path";
import { OutreachPlaybook } from "./types";

import { DATA_DIR } from "./data-dir";
const OUTREACH_FILE = path.join(DATA_DIR, "outreach.json");

async function readAll(): Promise<Record<string, OutreachPlaybook>> {
  try {
    const raw = await fs.readFile(OUTREACH_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getPlaybook(
  leadId: string
): Promise<OutreachPlaybook | null> {
  const all = await readAll();
  return all[leadId] ?? null;
}

export async function savePlaybook(playbook: OutreachPlaybook): Promise<void> {
  const all = await readAll();
  all[playbook.leadId] = playbook;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(OUTREACH_FILE, JSON.stringify(all, null, 2));
}
