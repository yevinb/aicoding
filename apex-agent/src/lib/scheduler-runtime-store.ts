import { promises as fs } from "fs";
import path from "path";
import { RuntimeWorkerTask, SchedulerRuntimeReport } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const REPORTS_FILE = path.join(DATA_DIR, "scheduler-runtime.json");
const WORKERS_FILE = path.join(DATA_DIR, "worker-runtime-tasks.json");

export async function getSchedulerRuntimeReports(): Promise<SchedulerRuntimeReport[]> {
  try {
    const raw = await fs.readFile(REPORTS_FILE, "utf-8");
    const reports: SchedulerRuntimeReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveSchedulerRuntimeReport(
  report: SchedulerRuntimeReport
): Promise<void> {
  const reports = await getSchedulerRuntimeReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPORTS_FILE, JSON.stringify(reports.slice(0, 40), null, 2));
}

export async function getRuntimeWorkerTasks(): Promise<RuntimeWorkerTask[]> {
  try {
    const raw = await fs.readFile(WORKERS_FILE, "utf-8");
    return JSON.parse(raw) as RuntimeWorkerTask[];
  } catch {
    return [];
  }
}

export async function saveRuntimeWorkerTasks(tasks: RuntimeWorkerTask[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(WORKERS_FILE, JSON.stringify(tasks.slice(0, 300), null, 2));
}

export async function upsertRuntimeWorkerTask(task: RuntimeWorkerTask): Promise<void> {
  const tasks = await getRuntimeWorkerTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) tasks[idx] = task;
  else tasks.push(task);
  await saveRuntimeWorkerTasks(tasks);
}
