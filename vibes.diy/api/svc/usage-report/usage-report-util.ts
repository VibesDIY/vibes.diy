import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Load `.dev.vars` (svc/.dev.vars or cwd/.dev.vars) into process.env without
// overwriting already-set keys. Shared by the usage-report CLIs. This module
// lives in usage-report/, so `import.meta.url`'s dir + ".." resolves to svc/ —
// the same path the former per-file copies computed.
export function loadDevVars(): void {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidatePaths = [path.join(scriptDir, "..", ".dev.vars"), path.join(process.cwd(), ".dev.vars")];

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) {
      continue;
    }

    const content = fs.readFileSync(candidatePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === "" || line.startsWith("#")) {
        continue;
      }
      const separator = line.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

// Superset of the former admin-db / inspect-db copies: returns a string error
// message, unwrapping a top-level `message` and then a nested `error.message`
// (the inspect-db behavior). Strictly additive for admin-db, which previously
// stopped at the top-level message (see #2014 Q7).
export function formatError(error: unknown): string {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj["message"] === "string" && obj["message"] !== "") {
      return obj["message"];
    }
    const nested = obj["error"];
    if (typeof nested === "object" && nested !== null) {
      const nestedObj = nested as Record<string, unknown>;
      if (typeof nestedObj["message"] === "string" && nestedObj["message"] !== "") {
        return nestedObj["message"];
      }
    }
  }
  return String(error);
}
