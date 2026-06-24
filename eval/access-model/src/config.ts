export type Dimension = "per-visitor" | "per-object" | "owner-published" | "author-owned" | "multi-tier";
const DIMENSIONS: ReadonlySet<string> = new Set([
  "per-visitor", "per-object", "owner-published", "author-owned", "multi-tier",
]);

export interface AccessPrompt {
  readonly id: string;
  readonly prompt: string;
  readonly dimension: string;
  readonly expect: Dimension;
}

export interface AccessMatrix {
  readonly cliCommand: string;
  readonly apiUrl: string;
  readonly runtimeHostBase: string;
  readonly handle: string;
  readonly model: string; // "" => pin to resolved default at kickoff
  readonly judgeModel: string;
  readonly reps: number;
  readonly concurrency: number;
  readonly scoreConcurrency: number;
  readonly screenshotTimeoutMs: number;
}

export function parseAccessPrompts(text: string): AccessPrompt[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => {
      const o = JSON.parse(line);
      if (!DIMENSIONS.has(o.expect)) throw new Error(`bad expect value: ${o.expect}`);
      if (typeof o.id !== "string" || typeof o.prompt !== "string") throw new Error(`bad prompt row: ${line}`);
      return { id: o.id, prompt: o.prompt, dimension: String(o.dimension ?? ""), expect: o.expect as Dimension };
    });
}

export function parseAccessMatrix(text: string): AccessMatrix {
  const o = JSON.parse(text);
  const num = (v: unknown, d: number) => (typeof v === "number" && v > 0 ? v : d);
  for (const k of ["apiUrl", "handle", "runtimeHostBase", "judgeModel"]) {
    if (typeof o[k] !== "string" || !o[k]) throw new Error(`matrix.${k} must be a non-empty string`);
  }
  return {
    cliCommand: typeof o.cliCommand === "string" && o.cliCommand ? o.cliCommand : "npx vibes-diy@latest",
    apiUrl: o.apiUrl, runtimeHostBase: o.runtimeHostBase, handle: o.handle,
    model: typeof o.model === "string" ? o.model : "",
    judgeModel: o.judgeModel,
    reps: num(o.reps, 8), concurrency: num(o.concurrency, 32), scoreConcurrency: num(o.scoreConcurrency, 8),
    screenshotTimeoutMs: num(o.screenshotTimeoutMs, 120000),
  };
}
