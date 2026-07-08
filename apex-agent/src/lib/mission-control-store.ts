import { promises as fs } from "fs";
import path from "path";
import { MissionControlReport } from "./types";

import { DATA_DIR } from "./data-dir";
const BRIEFINGS_FILE = path.join(DATA_DIR, "mission-control.json");

export async function getMissionBriefings(): Promise<MissionControlReport[]> {
  try {
    const raw = await fs.readFile(BRIEFINGS_FILE, "utf-8");
    const reports: MissionControlReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveMissionBriefing(report: MissionControlReport): Promise<void> {
  const reports = await getMissionBriefings();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(BRIEFINGS_FILE, JSON.stringify(reports.slice(0, 30), null, 2));
}
