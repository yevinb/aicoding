import path from "path";

const CWD = process.cwd();
const LOCAL_DATA_DIR = path.join(CWD, "data");
const SERVERLESS_DATA_DIR = path.join("/tmp", "apexgrowth-data");
const IS_READONLY_SERVERLESS =
  process.env.VERCEL === "1" ||
  CWD.startsWith("/var/task") ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

/** Writable data directory — local project `data/`, serverless `/tmp`. */
export const DATA_DIR = IS_READONLY_SERVERLESS
  ? SERVERLESS_DATA_DIR
  : LOCAL_DATA_DIR;
