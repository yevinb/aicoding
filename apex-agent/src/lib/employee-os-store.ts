import { promises as fs } from "fs";
import path from "path";
import { EmployeeOsReport } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const OS_FILE = path.join(DATA_DIR, "employee-os.json");

export async function getEmployeeOsReports(): Promise<EmployeeOsReport[]> {
  try {
    const raw = await fs.readFile(OS_FILE, "utf-8");
    const reports: EmployeeOsReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveEmployeeOsReport(report: EmployeeOsReport): Promise<void> {
  const reports = await getEmployeeOsReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(OS_FILE, JSON.stringify(reports.slice(0, 30), null, 2));
}
