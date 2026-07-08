import { promises as fs } from "fs";
import path from "path";
import { KnowledgeRelationship, MemoryGraphReport, MemoryItem } from "./types";

import { DATA_DIR } from "./data-dir";
const REPORTS_FILE = path.join(DATA_DIR, "memory-graph.json");
const MEMORIES_FILE = path.join(DATA_DIR, "memories.json");
const RELATIONSHIPS_FILE = path.join(DATA_DIR, "knowledge-graph.json");

export async function getMemoryGraphReports(): Promise<MemoryGraphReport[]> {
  try {
    const raw = await fs.readFile(REPORTS_FILE, "utf-8");
    const reports: MemoryGraphReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveMemoryGraphReport(report: MemoryGraphReport): Promise<void> {
  const reports = await getMemoryGraphReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPORTS_FILE, JSON.stringify(reports.slice(0, 50), null, 2));
}

export async function getMemories(): Promise<MemoryItem[]> {
  try {
    const raw = await fs.readFile(MEMORIES_FILE, "utf-8");
    return JSON.parse(raw) as MemoryItem[];
  } catch {
    return [];
  }
}

export async function saveMemories(memories: MemoryItem[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MEMORIES_FILE, JSON.stringify(memories.slice(0, 5000), null, 2));
}

export async function getKnowledgeRelationships(): Promise<KnowledgeRelationship[]> {
  try {
    const raw = await fs.readFile(RELATIONSHIPS_FILE, "utf-8");
    return JSON.parse(raw) as KnowledgeRelationship[];
  } catch {
    return [];
  }
}

export async function saveKnowledgeRelationships(
  relationships: KnowledgeRelationship[]
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(
    RELATIONSHIPS_FILE,
    JSON.stringify(relationships.slice(0, 10000), null, 2)
  );
}
