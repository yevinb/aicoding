import { promises as fs } from "fs";
import path from "path";
import { CrmAuditReport } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const AUDITS_FILE = path.join(DATA_DIR, "crm-audits.json");

export async function getAudits(): Promise<CrmAuditReport[]> {
  try {
    const raw = await fs.readFile(AUDITS_FILE, "utf-8");
    const audits: CrmAuditReport[] = JSON.parse(raw);
    return audits.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveAudit(audit: CrmAuditReport): Promise<void> {
  const audits = await getAudits();
  audits.unshift(audit);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(AUDITS_FILE, JSON.stringify(audits.slice(0, 30), null, 2));
}
