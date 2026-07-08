import { promises as fs } from "fs";
import path from "path";
import { RevenueSignalReport } from "./types";

import { DATA_DIR } from "./data-dir";
const SIGNALS_FILE = path.join(DATA_DIR, "revenue-signals.json");

export async function getRevenueSignalReports(): Promise<RevenueSignalReport[]> {
  try {
    const raw = await fs.readFile(SIGNALS_FILE, "utf-8");
    const reports: RevenueSignalReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveRevenueSignalReport(
  report: RevenueSignalReport
): Promise<void> {
  const reports = await getRevenueSignalReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SIGNALS_FILE, JSON.stringify(reports.slice(0, 40), null, 2));
}
