import type { MatrixConfig, PromptEntry } from "./cell.js";

export function parseMatrix(text: string): MatrixConfig {
  const m = JSON.parse(text) as MatrixConfig;
  if (!Array.isArray(m.models) || m.models.length === 0) throw new Error("matrix.models must be a non-empty array");
  for (const k of ["judgeModel", "reps", "modes", "concurrency", "maxSteps", "maxCostUsd", "budgetUsdTotal", "featureAcceptBar"] as const) {
    if (m[k] === undefined) throw new Error(`matrix.${k} is required`);
  }
  return m;
}

export function parsePrompts(text: string): PromptEntry[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const e = JSON.parse(l) as PromptEntry;
      if (!e.id || typeof e.prompt !== "string" || typeof e.needsAccess !== "boolean") {
        throw new Error(`bad prompt line: ${l.slice(0, 60)}`);
      }
      return e;
    });
}
