import { promises as fs } from "fs";
import path from "path";
import { OrchestratorReport } from "./types";

import { DATA_DIR } from "./data-dir";
const REPORTS_FILE = path.join(DATA_DIR, "reports.json");

export async function getReports(): Promise<OrchestratorReport[]> {
  try {
    const raw = await fs.readFile(REPORTS_FILE, "utf-8");
    const reports: OrchestratorReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveReport(report: OrchestratorReport): Promise<void> {
  const reports = await getReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  // Keep the most recent 50 cycles.
  await fs.writeFile(REPORTS_FILE, JSON.stringify(reports.slice(0, 50), null, 2));
}
