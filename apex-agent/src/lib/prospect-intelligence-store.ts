import { promises as fs } from "fs";
import path from "path";
import { ProspectIntelligenceReport } from "./types";

import { DATA_DIR } from "./data-dir";
const REPORTS_FILE = path.join(DATA_DIR, "prospect-intelligence.json");

export async function getProspectIntelligenceReports(): Promise<
  ProspectIntelligenceReport[]
> {
  try {
    const raw = await fs.readFile(REPORTS_FILE, "utf-8");
    const reports: ProspectIntelligenceReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveProspectIntelligenceReport(
  report: ProspectIntelligenceReport
): Promise<void> {
  const reports = await getProspectIntelligenceReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPORTS_FILE, JSON.stringify(reports.slice(0, 30), null, 2));
}
