import { promises as fs } from "fs";
import path from "path";
import { Mission } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const MISSIONS_FILE = path.join(DATA_DIR, "missions.json");

export async function getMissions(): Promise<Mission[]> {
  try {
    const raw = await fs.readFile(MISSIONS_FILE, "utf-8");
    return JSON.parse(raw) as Mission[];
  } catch {
    return [];
  }
}

export async function saveMissions(missions: Mission[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(MISSIONS_FILE, JSON.stringify(missions, null, 2));
}

export async function upsertMission(mission: Mission): Promise<void> {
  const missions = await getMissions();
  const idx = missions.findIndex((m) => m.id === mission.id);
  if (idx >= 0) missions[idx] = mission;
  else missions.push(mission);
  await saveMissions(missions);
}

export async function getActiveMissions(): Promise<Mission[]> {
  const missions = await getMissions();
  return missions.filter(
    (m) =>
      m.status === "created" ||
      m.status === "assigned" ||
      m.status === "running" ||
      m.status === "blocked" ||
      m.status === "waiting_approval"
  );
}
