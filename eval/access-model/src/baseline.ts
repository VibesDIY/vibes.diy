import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr, stdout } from "node:process";
import type { RateSummary, HoldoutSummary } from "./gates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BASELINE_JSON = resolve(ROOT, "baseline.json");

/**
 * The frozen baseline the ≥-baseline gates compare against (#2602). Captured once,
 * on the issue's baseline commit (`9cf43ea`), and never silently moved — a later
 * default-model bump (Task 2) must explicitly `--force` re-capture it.
 */
export interface Baseline {
  readonly commit: string;
  readonly eval: RateSummary;
  readonly holdout: HoldoutSummary;
}

/**
 * Merge a freshly-captured baseline over any existing one. Throws if a baseline is
 * already set and `force` is falsy (the overwrite guard) — so the loop can never
 * silently advance the reference it's scored against. With `force`, returns `next`.
 */
export function mergeBaseline<T extends { commit: string }>(existing: T | null | undefined, next: T, force: boolean): T {
  if (existing && !force) {
    throw new Error(`baseline exists (commit ${existing.commit}); pass force to overwrite`);
  }
  return next;
}

/** Read the on-disk baseline, or null when none has been captured yet. */
export function readBaseline(path: string = BASELINE_JSON): Baseline | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as Baseline;
}

/** A stage's rollup summary, as produced by report.ts's results.json. */
interface StageSummary {
  readonly rollup: RateSummary;
}

/**
 * Injected stage steps. `captureBaseline` ORCHESTRATES the existing generate/score/
 * report stages — it does NOT duplicate their logic. The real `main()` wires these
 * to the package's `generate`/`score`/`report` script entrypoints (one run for the
 * eval matrix, one for `--holdout`); tests inject fakes so no live generate runs.
 */
export interface CaptureDeps {
  /** Run generate+score+report for a matrix variant; resolve its results.json rollup. */
  readonly runStages: (variant: "eval" | "holdout") => Promise<StageSummary>;
  /** The checkout commit recorded into the baseline. */
  readonly commit: () => string;
}

/**
 * Capture a baseline by orchestrating the eval + holdout stage pipelines on the
 * current checkout. Pure given injected `deps`; the real wiring lives in `main()`.
 */
export async function captureBaseline(deps: CaptureDeps): Promise<Baseline> {
  const evalSummary = await deps.runStages("eval");
  const holdoutSummary = await deps.runStages("holdout");
  return {
    commit: deps.commit(),
    eval: evalSummary.rollup,
    holdout: { metric: holdoutSummary.rollup.metric },
  };
}

function hasSwitch(flag: string): boolean {
  return argv.some((a) => a === flag);
}

function gitCommitSha(): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
  return (r.stdout ?? "").trim() || "unknown";
}

/**
 * The real generate→score→report orchestration: spawn this package's own
 * `generate`/`score`/`report` scripts (the existing stage entrypoints) as
 * subprocesses, then read the run's results.json rollup. Reuses the stages
 * verbatim — no logic is duplicated here.
 */
async function realRunStages(variant: "eval" | "holdout"): Promise<StageSummary> {
  const runFlag = resolve(ROOT, "runs", `baseline-${variant}`);
  const generateArgs = variant === "holdout" ? ["--holdout", "--run", runFlag] : ["--run", runFlag];
  const steps: { script: string; args: string[] }[] = [
    { script: "generate", args: generateArgs },
    { script: "score", args: ["--run", runFlag] },
    { script: "report", args: ["--run", runFlag] },
  ];
  for (const step of steps) {
    const r = spawnSync("pnpm", ["run", step.script, "--", ...step.args], { cwd: ROOT, encoding: "utf-8", stdio: "inherit" });
    if (r.status !== 0) throw new Error(`${variant} ${step.script} failed (exit ${r.status})`);
  }
  const results = JSON.parse(readFileSync(resolve(runFlag, "results.json"), "utf-8")) as StageSummary;
  return results;
}

/**
 * `pnpm run capture-baseline [--force]` — capture the frozen baseline on the current
 * checkout (used once, on `9cf43ea`, at kickoff). Refuses to overwrite an existing
 * baseline.json without `--force`.
 */
export async function main(): Promise<void> {
  const force = hasSwitch("--force");
  const existing = readBaseline();
  // Guard before spending a live 64-cell capture: fail fast if a baseline is already
  // set and --force was not passed (mergeBaseline re-checks after the capture too).
  if (existing && !force) {
    throw new Error(`baseline exists (commit ${existing.commit}); pass --force to overwrite`);
  }

  const next = await captureBaseline({ runStages: realRunStages, commit: gitCommitSha });
  const merged = mergeBaseline(existing, next, force);
  writeFileSync(BASELINE_JSON, JSON.stringify(merged, null, 2), "utf-8");
  stderr.write(`access-model baseline: wrote ${BASELINE_JSON} @ commit ${merged.commit}\n`);
  stdout.write(`baseline captured: eval=${merged.eval.metric} holdout=${merged.holdout.metric}\n`);
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`baseline capture failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
