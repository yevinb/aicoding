import { promises as fs } from "fs";
import path from "path";
import { CommunicationConversation, CommunicationMessage, CommunicationOsReport } from "./types";

import { DATA_DIR } from "./data-dir";
const REPORTS_FILE = path.join(DATA_DIR, "communication-os.json");
const MESSAGES_FILE = path.join(DATA_DIR, "communications.json");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversation-memory.json");

export async function getCommunicationOsReports(): Promise<CommunicationOsReport[]> {
  try {
    const raw = await fs.readFile(REPORTS_FILE, "utf-8");
    const reports: CommunicationOsReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveCommunicationOsReport(report: CommunicationOsReport): Promise<void> {
  const reports = await getCommunicationOsReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPORTS_FILE, JSON.stringify(reports.slice(0, 40), null, 2));
}

export async function getCommunicationMessages(): Promise<CommunicationMessage[]> {
  try {
    const raw = await fs.readFile(MESSAGES_FILE, "utf-8");
    return JSON.parse(raw) as CommunicationMessage[];
  } catch {
    return [];
  }
}

export async function saveCommunicationMessages(messages: CommunicationMessage[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MESSAGES_FILE, JSON.stringify(messages.slice(0, 400), null, 2));
}

export async function getConversations(): Promise<CommunicationConversation[]> {
  try {
    const raw = await fs.readFile(CONVERSATIONS_FILE, "utf-8");
    return JSON.parse(raw) as CommunicationConversation[];
  } catch {
    return [];
  }
}

export async function saveConversations(conversations: CommunicationConversation[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CONVERSATIONS_FILE, JSON.stringify(conversations.slice(0, 300), null, 2));
}
