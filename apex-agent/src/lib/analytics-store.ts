import { promises as fs } from "fs";
import path from "path";
import { AnalyticsReport } from "./types";

import { DATA_DIR } from "./data-dir";
const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");

export async function getAnalyticsReports(): Promise<AnalyticsReport[]> {
  try {
    const raw = await fs.readFile(ANALYTICS_FILE, "utf-8");
    const reports: AnalyticsReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveAnalyticsReport(report: AnalyticsReport): Promise<void> {
  const reports = await getAnalyticsReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ANALYTICS_FILE, JSON.stringify(reports.slice(0, 30), null, 2));
}
