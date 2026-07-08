import { promises as fs } from "fs";
import path from "path";
import { DiscoveredAccount, DiscoveredContact } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const UNIVERSE_FILE = path.join(DATA_DIR, "prospect-universe.json");

interface ProspectUniverse {
  accounts: DiscoveredAccount[];
  contacts: DiscoveredContact[];
}

export async function getProspectUniverse(): Promise<ProspectUniverse> {
  try {
    const raw = await fs.readFile(UNIVERSE_FILE, "utf-8");
    return JSON.parse(raw) as ProspectUniverse;
  } catch {
    return { accounts: [], contacts: [] };
  }
}

export async function saveProspectUniverse(universe: ProspectUniverse): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(UNIVERSE_FILE, JSON.stringify(universe, null, 2));
}

export async function upsertUniverseAccounts(
  accounts: DiscoveredAccount[]
): Promise<void> {
  const universe = await getProspectUniverse();
  for (const account of accounts) {
    const idx = universe.accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) universe.accounts[idx] = account;
    else universe.accounts.push(account);
  }
  await saveProspectUniverse(universe);
}

export async function upsertUniverseContacts(
  contacts: DiscoveredContact[]
): Promise<void> {
  const universe = await getProspectUniverse();
  for (const contact of contacts) {
    const idx = universe.contacts.findIndex((c) => c.id === contact.id);
    if (idx >= 0) universe.contacts[idx] = contact;
    else universe.contacts.push(contact);
  }
  await saveProspectUniverse(universe);
}
