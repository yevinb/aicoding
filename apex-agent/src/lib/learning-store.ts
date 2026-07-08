import { promises as fs } from "fs";
import path from "path";
import { LearningReport } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const LEARNING_FILE = path.join(DATA_DIR, "learning.json");

export async function getLearningReports(): Promise<LearningReport[]> {
  try {
    const raw = await fs.readFile(LEARNING_FILE, "utf-8");
    const reports: LearningReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveLearningReport(report: LearningReport): Promise<void> {
  const reports = await getLearningReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(LEARNING_FILE, JSON.stringify(reports.slice(0, 30), null, 2));
}
