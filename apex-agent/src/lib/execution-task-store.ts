import { promises as fs } from "fs";
import path from "path";
import { ExecutionTask } from "./types";

import { DATA_DIR } from "./data-dir";
const TASKS_FILE = path.join(DATA_DIR, "execution-tasks.json");

export async function getExecutionTasks(): Promise<ExecutionTask[]> {
  try {
    const raw = await fs.readFile(TASKS_FILE, "utf-8");
    return JSON.parse(raw) as ExecutionTask[];
  } catch {
    return [];
  }
}

export async function saveExecutionTasks(tasks: ExecutionTask[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

export async function upsertExecutionTask(task: ExecutionTask): Promise<void> {
  const tasks = await getExecutionTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) tasks[idx] = task;
  else tasks.push(task);
  await saveExecutionTasks(tasks);
}

export async function getPendingExecutionTasks(): Promise<ExecutionTask[]> {
  const tasks = await getExecutionTasks();
  return tasks.filter(
    (t) =>
      t.status === "pending" ||
      t.status === "running" ||
      t.status === "needs_approval" ||
      t.status === "blocked"
  );
}
