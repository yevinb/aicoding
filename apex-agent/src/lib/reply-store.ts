import { promises as fs } from "fs";
import path from "path";
import { ReplyAnalysis } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const REPLIES_FILE = path.join(DATA_DIR, "replies.json");

async function readAll(): Promise<Record<string, ReplyAnalysis[]>> {
  try {
    const raw = await fs.readFile(REPLIES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function getReplyAnalyses(
  leadId: string
): Promise<ReplyAnalysis[]> {
  const all = await readAll();
  return (all[leadId] ?? []).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export async function saveReplyAnalysis(
  analysis: ReplyAnalysis
): Promise<void> {
  const all = await readAll();
  const list = all[analysis.leadId] ?? [];
  list.unshift(analysis);
  all[analysis.leadId] = list.slice(0, 25);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPLIES_FILE, JSON.stringify(all, null, 2));
}
