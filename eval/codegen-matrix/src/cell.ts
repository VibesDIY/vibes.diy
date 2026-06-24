import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** One generate attempt's outcome, retained so retries are auditable. */
export interface AttemptLogEntry {
  readonly attempt: number;
  readonly ok: boolean;
  readonly status: number | null;
  readonly latencyMs: number;
  /** "ok" on success, else a concise reason extracted from the CLI's stderr. */
  readonly reason: string;
}

export interface CellJson {
  readonly promptId: string;
  readonly model: string;
  readonly class: string;
  readonly tier: string;
  readonly rep: number;
  readonly appSlug: string;
  readonly ownerHandle: string;
  readonly directory: string;
  readonly latencyMs: number;
  readonly exitState: "ok" | "generate-failed";
  /** How many generate attempts ran (1 = succeeded first try; up to the retry cap). */
  readonly attempts: number;
  /** Per-attempt outcomes (status, latency, reason) — the failure reasons for each retry. */
  readonly attemptLog: readonly AttemptLogEntry[];
  readonly stderrTail: string;
  readonly apiUrl: string;
  readonly runtimeHostBase: string;
  readonly cliVersion: string;
  readonly promptHash: string;
}

export interface RubricResult {
  readonly passed: number;
  readonly total: number;
  readonly failedRules: readonly string[];
}

export interface JudgeResult {
  readonly score: number | null; // 1-5, or null on transport failure
  readonly reason: string;
  readonly judgeModel: string;
}

export interface DesignResult {
  readonly available: boolean;
  readonly score: number | null; // 1-5, or null
  readonly reason: string;
  readonly judgeModel: string;
}

export interface CellScore {
  readonly promptId: string;
  readonly model: string;
  readonly rep: number;
  readonly rubric: RubricResult;
  readonly feature: JudgeResult;
  readonly design: DesignResult;
  /** Deterministic protocol-adherence signals over the generated source (see structure.ts). */
  readonly structure: import("./structure.js").StructureSignals;
}

export interface RunJson {
  readonly startedAt: string;
  readonly apiUrl: string;
  readonly cliCommand: string;
  readonly cliVersion: string;
  readonly commitSha: string;
  readonly judgeModel: string;
  readonly reps: number;
  readonly promptsHash: string;
}

export const CELL_JSON = "cell.json";
export const CELL_SCORE_JSON = "cell.score.json";
export const RUN_JSON = "run.json";

export function modelSlug(model: string): string {
  return model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cellDirName(promptId: string, model: string, rep: number): string {
  return `${promptId}__${modelSlug(model)}__r${rep}`;
}

/**
 * Runtime screenshot URL. The deployed vibe is served at
 * `<appSlug>--<ownerHandle>.<runtimeHostBase>`. The runtime host base is an
 * explicit config value (NOT derived from the API host — they differ in
 * preview, where the API is on *.workers.dev but the runtime is on
 * pr-<N>.vibespreview.dev).
 */
export function screenshotUrl(runtimeHostBase: string, appSlug: string, ownerHandle: string): string {
  return `https://${appSlug}--${ownerHandle}.${runtimeHostBase}/screenshot.jpg`;
}

/** The sole subdirectory the CLI creates in the (empty) per-cell cwd is the appSlug. */
export function discoverAppSlug(subdirNames: readonly string[]): string | undefined {
  return subdirNames.length === 1 ? subdirNames[0] : undefined;
}

export function writeCellJson(dir: string, cell: CellJson): void {
  writeFileSync(join(dir, CELL_JSON), JSON.stringify(cell, null, 2), "utf-8");
}

export function readCellJson(dir: string): CellJson | undefined {
  const p = join(dir, CELL_JSON);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as CellJson) : undefined;
}

export function writeCellScore(dir: string, score: CellScore): void {
  writeFileSync(join(dir, CELL_SCORE_JSON), JSON.stringify(score, null, 2), "utf-8");
}

export function readCellScore(dir: string): CellScore | undefined {
  const p = join(dir, CELL_SCORE_JSON);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf-8")) as CellScore) : undefined;
}
