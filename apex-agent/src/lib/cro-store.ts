import { promises as fs } from "fs";
import path from "path";
import { CroReport } from "./types";

import { DATA_DIR } from "./data-dir";
const CRO_FILE = path.join(DATA_DIR, "cro-reviews.json");

export async function getCroReviews(): Promise<CroReport[]> {
  try {
    const raw = await fs.readFile(CRO_FILE, "utf-8");
    const reviews: CroReport[] = JSON.parse(raw);
    return reviews.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveCroReview(report: CroReport): Promise<void> {
  const reviews = await getCroReviews();
  reviews.unshift(report);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(CRO_FILE, JSON.stringify(reviews.slice(0, 30), null, 2));
}
