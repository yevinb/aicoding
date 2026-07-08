import { promises as fs } from "fs";
import path from "path";
import { AccountPlan } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const PLANS_FILE = path.join(DATA_DIR, "plans.json");

async function readAll(): Promise<Record<string, AccountPlan>> {
  try {
    const raw = await fs.readFile(PLANS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getPlan(leadId: string): Promise<AccountPlan | null> {
  const all = await readAll();
  return all[leadId] ?? null;
}

export async function savePlan(plan: AccountPlan): Promise<void> {
  const all = await readAll();
  all[plan.leadId] = plan;
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PLANS_FILE, JSON.stringify(all, null, 2));
}
