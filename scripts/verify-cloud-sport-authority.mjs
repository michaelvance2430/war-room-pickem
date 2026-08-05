/**
 * Cloud sport authority checks (post reassert removal).
 * Delegates to the full immutability suite.
 */
import { spawnSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const r = spawnSync(
  process.execPath,
  [resolve(root, "scripts/verify-league-sport-immutability.mjs")],
  { stdio: "inherit" }
);
process.exit(r.status ?? 1);
