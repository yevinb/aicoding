import { promises as fs } from "fs";
import path from "path";
import { AutonomousLoopReport } from "./types";

import { DATA_DIR } from "./data-dir";
const LOOP_FILE = path.join(DATA_DIR, "autonomous-loop.json");

export async function getLoopReports(): Promise<AutonomousLoopReport[]> {
  try {
    const raw = await fs.readFile(LOOP_FILE, "utf-8");
    const reports: AutonomousLoopReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveLoopReport(report: AutonomousLoopReport): Promise<void> {
  const reports = await getLoopReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LOOP_FILE, JSON.stringify(reports.slice(0, 40), null, 2));
}
