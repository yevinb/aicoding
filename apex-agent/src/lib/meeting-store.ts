import { promises as fs } from "fs";
import path from "path";
import { MeetingReport } from "./types";

import { DATA_DIR } from "./data-dir";
const MEETINGS_FILE = path.join(DATA_DIR, "meetings.json");

async function readAll(): Promise<Record<string, MeetingReport[]>> {
  try {
    const raw = await fs.readFile(MEETINGS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getMeetingReports(
  leadId: string
): Promise<MeetingReport[]> {
  const all = await readAll();
  return (all[leadId] ?? []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function saveMeetingReport(report: MeetingReport): Promise<void> {
  const all = await readAll();
  const list = all[report.leadId] ?? [];
  list.unshift(report);
  all[report.leadId] = list.slice(0, 25);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MEETINGS_FILE, JSON.stringify(all, null, 2));
}
