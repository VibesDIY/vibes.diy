import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stdout, stderr } from "node:process";
import { parseAccessMatrix } from "./config.js";
import { evaluateGates, type GatesResult, type RateSummary, type HoldoutSummary } from "./gates.js";
import { guardrail, type GuardrailResult } from "./guardrail.js";
import { realJudgeDeps } from "./judge.js";
import { readBaseline } from "./baseline.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(ROOT, "..", "..");
const DEFAULT_MATRIX = resolve(ROOT, "config/matrix.json");

/** The prompt corpus the autoresearch loop edits — also the diff surface gate 4 guards. */
const PROMPTS_PATHSPEC = "prompts/pkg";

export interface VerifyInput {
  readonly metric: number;
  readonly gates: { pass: boolean; failed: string[] };
}
export interface VerifyDecision {
  readonly exitCode: number;
  readonly lines: string[];
}

/**
 * Pure decision: turn the eval metric + gate verdict into the exact stdout lines and
 * exit code `/autoresearch` consumes. Always emits a parseable `METRIC=<x>` line, plus
 * a `GATES: pass` / `GATES: FAIL(...)` line. Exit 1 on any gate failure so the loop
 * DISCARDS the iteration regardless of whether the metric improved.
 */
export function decideVerify(i: VerifyInput): VerifyDecision {
  const lines = [`METRIC=${i.metric}`, i.gates.pass ? "GATES: pass" : `GATES: FAIL(${i.gates.failed.join(",")})`];
  return { exitCode: i.gates.pass ? 0 : 1, lines };
}

/** The rollup shape report.ts writes to results.json (a superset of RateSummary). */
interface StageResults {
  readonly rollup: RateSummary;
}

/**
 * Map a stage's results.json rollup into the gate inputs. The eval gate needs the
 * full RateSummary (two-file + renderable rates + metric); the holdout gate needs
 * only the metric. Kept pure + tiny so it's unit-testable without the network.
 */
export function summaryFromResults(results: StageResults): { rate: RateSummary; holdout: HoldoutSummary } {
  const r = results.rollup;
  return {
    rate: { twoFileRate: r.twoFileRate, renderableRate: r.renderableRate, metric: r.metric },
    holdout: { metric: r.metric },
  };
}

/**
 * The exact `pnpm <args>` invocations gate 1 runs (from REPO_ROOT), in order:
 *   1. `pnpm --filter @vibes.diy/prompts --filter @vibes.diy/prompts-test run build`
 *   2. `pnpm --filter @vibes.diy/prompts --filter @vibes.diy/prompts-test run test`
 *   3. `pnpm --filter @vibes.diy/eval-codegen-matrix exec vitest --run src/rubric.test.ts`
 * Step 3 is the `promptAnchor` rubric drift-guard (`eval/codegen-matrix/src/rubric.test.ts`
 * asserts every rule's `promptAnchor` still appears in the system prompt) — that guard
 * lives in codegen-matrix, NOT in the prompts/prompts-test workspaces, so it needs its
 * own scoped step. Kept pure so the command list is unit-testable without spawning.
 */
export function gate1Commands(): readonly (readonly string[])[] {
  const promptsFilters = ["--filter", "@vibes.diy/prompts", "--filter", "@vibes.diy/prompts-test"];
  return [
    ["run", ...promptsFilters, "build"],
    ["run", ...promptsFilters, "test"],
    ["--filter", "@vibes.diy/eval-codegen-matrix", "exec", "vitest", "--run", "src/rubric.test.ts"],
  ];
}

/**
 * Gate 1: run the prompts package's own build + tests (the rubric drift-guard lives
 * among `prompts/tests` — `initial-system-prompt`/`default-coding-model` anchors) PLUS
 * the codegen-matrix `promptAnchor` rubric drift-guard. The whole-repo `pnpm check`
 * (build+lint+test across the monorepo) is far too heavy to run every iteration, so this
 * scopes to the relevant workspaces via `pnpm --filter`. See `gate1Commands` for the exact
 * invocations. Returns true only when every scoped step exits 0.
 */
function runPromptsCheck(): boolean {
  for (const args of gate1Commands()) {
    const r = spawnSync("pnpm", args, { cwd: REPO_ROOT, encoding: "utf-8", stdio: "inherit" });
    if (r.status !== 0) {
      stderr.write(`gate1 (prompts check): \`pnpm ${args.join(" ")}\` failed (exit ${r.status})\n`);
      return false;
    }
  }
  return true;
}

/**
 * Run generate→score→report for one matrix variant by spawning THIS package's own
 * stage scripts as subprocesses (mirrors baseline.ts's realRunStages — no stage logic
 * is duplicated). Returns the run's results.json rollup.
 */
function runStages(variant: "eval" | "holdout"): StageResults {
  const runFlag = resolve(ROOT, "runs", `verify-${variant}`);
  const generateArgs = variant === "holdout" ? ["--holdout", "--run", runFlag] : ["--run", runFlag];
  const steps: { script: string; args: string[] }[] = [
    { script: "generate", args: generateArgs },
    { script: "score", args: ["--run", runFlag] },
    { script: "report", args: ["--run", runFlag] },
  ];
  for (const step of steps) {
    const r = spawnSync("pnpm", ["run", step.script, "--", ...step.args], {
      cwd: ROOT,
      encoding: "utf-8",
      stdio: "inherit",
    });
    if (r.status !== 0) throw new Error(`${variant} ${step.script} failed (exit ${r.status})`);
  }
  return JSON.parse(readFileSync(resolve(runFlag, "results.json"), "utf-8")) as StageResults;
}

/**
 * The iteration's prompt diff (gate 4 input): both the working-tree and staged changes
 * under `prompts/pkg/`, concatenated into one unified diff for the guardrail.
 */
function promptDiff(): string {
  const unstaged = spawnSync("git", ["diff", "--", PROMPTS_PATHSPEC], { cwd: REPO_ROOT, encoding: "utf-8" });
  const staged = spawnSync("git", ["diff", "--cached", "--", PROMPTS_PATHSPEC], { cwd: REPO_ROOT, encoding: "utf-8" });
  return `${unstaged.stdout ?? ""}\n${staged.stdout ?? ""}`;
}

/**
 * THE Verify command (#2602). Orchestrates the 5 gates: (1) prompts-package check,
 * (2/3) eval generate→score→report → rollup rates, (5) holdout → metric, (4) prompt
 * diff guardrail, then `evaluateGates` vs the frozen baseline.json. Prints `METRIC=<x>`
 * + the gate verdict and exits non-zero on any failure (so the loop discards).
 */
export async function main(): Promise<void> {
  const matrix = parseAccessMatrix(readFileSync(DEFAULT_MATRIX, "utf-8"));

  // Gate 1: prompts package build + tests (drift-guard).
  const checkGreen = runPromptsCheck();

  // Gates 2/3: eval matrix.
  const evalSummary = summaryFromResults(runStages("eval"));
  const currentEvalMetric = evalSummary.rate.metric;

  // Gate 5: holdout matrix.
  const holdoutSummary = summaryFromResults(runStages("holdout"));

  // Gate 4: prompt-diff guardrail (grep-first, degrades to grep verdict if judge is down).
  const diff = promptDiff();
  let guardrailResult: GuardrailResult;
  try {
    guardrailResult = await guardrail(diff, realJudgeDeps(matrix));
  } catch (e) {
    stderr.write(`guardrail judge unavailable (${(e as Error).message}); using grep verdict\n`);
    guardrailResult = await guardrail(diff, {
      call: async () => {
        throw new Error("judge unavailable");
      },
      model: matrix.judgeModel,
      endpoint: "",
      apiKey: "",
      maxAttempts: 1,
    });
  }

  // The frozen reference the ≥-baseline gates compare against.
  const baseline = readBaseline();
  if (!baseline) throw new Error(`no baseline.json under ${ROOT} — run capture-baseline first`);

  const gates: GatesResult = evaluateGates({
    checkGreen,
    guardrail: guardrailResult,
    current: evalSummary.rate,
    baseline: baseline.eval,
    holdoutCurrent: holdoutSummary.holdout,
    holdoutBaseline: baseline.holdout,
  });

  const decision = decideVerify({ metric: currentEvalMetric, gates });
  for (const line of decision.lines) stdout.write(`${line}\n`);
  process.exit(decision.exitCode);
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`verify failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
