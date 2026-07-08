import { promises as fs } from "fs";
import path from "path";
import { ProviderAdapterReport, ProviderConfig } from "./types";

import { DATA_DIR } from "./data-dir";
const REPORTS_FILE = path.join(DATA_DIR, "provider-adapter.json");
const PROVIDERS_FILE = path.join(DATA_DIR, "provider-configs.json");

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: "mock-primary",
    name: "Mock Provider",
    type: "mock",
    enabled: true,
    status: "connected",
    lastSync: null,
    capabilities: ["send", "receive", "sync", "status", "threads", "failures"],
    priority: 1,
  },
  {
    id: "smtp-fallback",
    name: "SMTP Adapter",
    type: "smtp",
    enabled: true,
    status: "connected",
    lastSync: null,
    capabilities: ["send", "status"],
    priority: 2,
  },
  {
    id: "imap-inbox",
    name: "IMAP Adapter",
    type: "imap",
    enabled: true,
    status: "connected",
    lastSync: null,
    capabilities: ["receive", "sync", "status"],
    priority: 3,
  },
  {
    id: "google-optional",
    name: "Google Adapter",
    type: "google",
    enabled: false,
    status: "disconnected",
    lastSync: null,
    capabilities: ["send", "receive", "sync", "status"],
    priority: 4,
  },
  {
    id: "microsoft-optional",
    name: "Microsoft Adapter",
    type: "microsoft",
    enabled: false,
    status: "disconnected",
    lastSync: null,
    capabilities: ["send", "receive", "sync", "status"],
    priority: 5,
  },
];

export async function getProviderAdapterReports(): Promise<ProviderAdapterReport[]> {
  try {
    const raw = await fs.readFile(REPORTS_FILE, "utf-8");
    const reports: ProviderAdapterReport[] = JSON.parse(raw);
    return reports.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveProviderAdapterReport(report: ProviderAdapterReport): Promise<void> {
  const reports = await getProviderAdapterReports();
  reports.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPORTS_FILE, JSON.stringify(reports.slice(0, 50), null, 2));
}

export async function getProviderConfigs(): Promise<ProviderConfig[]> {
  try {
    const raw = await fs.readFile(PROVIDERS_FILE, "utf-8");
    return JSON.parse(raw) as ProviderConfig[];
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(PROVIDERS_FILE, JSON.stringify(DEFAULT_PROVIDERS, null, 2));
    return DEFAULT_PROVIDERS;
  }
}

export async function saveProviderConfigs(configs: ProviderConfig[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PROVIDERS_FILE, JSON.stringify(configs, null, 2));
}
