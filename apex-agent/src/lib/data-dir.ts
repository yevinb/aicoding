import path from "path";

const LOCAL_DATA_DIR = path.join(process.cwd(), "data");
const SERVERLESS_DATA_DIR = path.join("/tmp", "apexgrowth-data");

/** Writable data directory — project `data/` locally, `/tmp` on Vercel serverless. */
export const DATA_DIR =
  process.env.VERCEL === "1" ? SERVERLESS_DATA_DIR : LOCAL_DATA_DIR;
