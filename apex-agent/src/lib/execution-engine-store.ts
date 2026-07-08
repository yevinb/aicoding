import { promises as fs } from "fs";
import path from "path";
import { ExecutionEngineReport } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const REPORTS_FILE = path.join(DATA_DIR, "execution-engine.json");

export async function getExecutionReports(): Promise<ExecutionEngineReport[]> {
  try {
    const raw = await fs.readFile(REPORTS_FILE, "utf-8");
    const reports: ExecutionEngineReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveExecutionReport(
  report: ExecutionEngineReport
): Promise<void> {
  const reports = await getExecutionReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPORTS_FILE, JSON.stringify(reports.slice(0, 30), null, 2));
}
