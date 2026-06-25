import type { StructureSignals, RubricResult, JudgeResult } from "@vibes.diy/eval-codegen-matrix/scoring";

export type ModeName = "oneshot" | "agentic";

export interface ModelEntry {
  readonly id: string;
  readonly openWeight: boolean;
}
export interface PromptEntry {
  readonly id: string;
  readonly prompt: string;
  /** Acceptability requires a separate access.js only when this is true. */
  readonly needsAccess: boolean;
}
export interface MatrixConfig {
  readonly judgeModel: string;
  readonly reps: number;
  readonly modes: readonly ModeName[];
  readonly concurrency: number;
  readonly maxSteps: number;
  readonly maxCostUsd: number;
  readonly budgetUsdTotal: number;
  readonly featureAcceptBar: number;
  /** Max retries on transient generation errors (total attempts = maxRetries + 1). Defaults to 2 when absent. */
  readonly maxRetries?: number;
  readonly models: readonly ModelEntry[];
}

/** Output of a generator (oneshot or agentic) before scoring. */
export interface GenResult {
  readonly files: Record<string, string>;
  readonly steps: number;
  readonly buildPass: boolean;
  readonly costUsd: number;
  readonly tokens: number;
  readonly exitState: "ok" | "no-files" | "errored";
  readonly note: string;
  /** Set on an errored result when the underlying error was a transient/retryable infra failure. */
  readonly transient?: boolean;
}

export interface CellResult extends GenResult {
  readonly promptId: string;
  readonly model: string;
  readonly mode: ModeName;
  readonly rep: number;
  readonly openWeight: boolean;
  readonly needsAccess: boolean;
}

export interface CellScore {
  readonly promptId: string;
  readonly model: string;
  readonly mode: ModeName;
  readonly rep: number;
  readonly rubric: RubricResult;
  readonly feature: JudgeResult;
  readonly structure: StructureSignals;
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
export function cellDirName(promptId: string, model: string, rep: number, mode: ModeName): string {
  return `${promptId}__${modelSlug(model)}__r${rep}__${mode}`;
}
