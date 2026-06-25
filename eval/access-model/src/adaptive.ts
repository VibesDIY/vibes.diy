import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { parseAccessMatrix, type AccessMatrix } from "./config.js";
import { CELL_JSON } from "./generate.js";
import { SCORE_JSON } from "./score.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_MATRIX = resolve(ROOT, "config/matrix.json");
const RUNS_DIR = resolve(ROOT, "runs");

/**
 * Adaptive rep allocation (#2631): a prompt is *saturated* once all its scored reps
 * agree on one grade — extra reps there are pure waste (e.g. a prompt that passes
 * 4/4). A prompt whose reps *disagree* (or whose reps include a generate failure) is
 * where the metric noise lives, so it earns more reps. Returns the prompt ids that
 * are NOT yet saturated and should be topped up. Pure — easy to unit-test.
 */
export function selectUnsaturated(rows: readonly { id: string; grade: string }[]): string[] {
  const byId = new Map<string, Set<string>>();
  for (const r of rows) {
    const grades = byId.get(r.id) ?? new Set<string>();
    grades.add(r.grade);
    byId.set(r.id, grades);
  }
  const out: string[] = [];
  for (const [id, grades] of byId) if (grades.size > 1) out.push(id);
  return out.sort();
}

function sh(script: string, args: string[]): void {
  const r = spawnSync("pnpm", ["run", script, "--", ...args], { cwd: ROOT, encoding: "utf-8", stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${script} failed (exit ${r.status})`);
}

/** Read (promptId, grade) for every scored cell in the run dir. */
function scoredRows(runDir: string): { id: string; grade: string }[] {
  const rows: { id: string; grade: string }[] = [];
  for (const name of readdirSync(runDir)) {
    const dir = join(runDir, name);
    try {
      if (!statSync(join(dir, SCORE_JSON)).isFile()) continue;
      const cell = JSON.parse(readFileSync(join(dir, CELL_JSON), "utf-8"));
      const score = JSON.parse(readFileSync(join(dir, SCORE_JSON), "utf-8"));
      rows.push({ id: cell.promptId, grade: score.grade });
    } catch {
      /* not a scored cell dir */
    }
  }
  return rows;
}

/**
 * Run an adaptive batch into `runDir`: a base wave of `matrix.reps` for every prompt,
 * then a top-up wave (rep indices base..repsMax-1) for only the prompts that didn't
 * saturate. The top-up scores with --skip-scored so base cells are not re-judged.
 */
export function runAdaptive(opts: { runDir: string; holdout: boolean; matrix: AccessMatrix }): void {
  const { runDir, holdout, matrix } = opts;
  const base = matrix.reps;
  const cap = Math.max(base, matrix.repsMax);
  const holdoutArgs = holdout ? ["--holdout"] : [];

  // Base wave.
  sh("generate", [...holdoutArgs, "--reps", String(base), "--run", runDir]);
  sh("score", ["--run", runDir]);
  sh("report", ["--run", runDir]);

  // Adaptive top-up: only the prompts whose base-wave reps disagree, up to the cap.
  const topup = cap - base;
  if (topup <= 0) return;
  const unsat = selectUnsaturated(scoredRows(runDir));
  if (unsat.length === 0) {
    stderr.write(`access-model adaptive: all prompts saturated at ${base} reps; no top-up\n`);
    return;
  }
  stderr.write(
    `access-model adaptive: topping up ${unsat.length} unsaturated prompt(s) [${unsat.join(",")}] by +${topup} reps -> ${cap}\n`
  );
  sh("generate", [
    ...holdoutArgs,
    "--reps",
    String(topup),
    "--rep-start",
    String(base),
    "--only",
    unsat.join(","),
    "--run",
    runDir,
  ]);
  sh("score", ["--run", runDir, "--skip-scored"]);
  sh("report", ["--run", runDir]);
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const a = argv[ix];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[ix + 1];
}

export async function main(): Promise<void> {
  const matrix = parseAccessMatrix(readFileSync(parseFlag("--matrix") ?? DEFAULT_MATRIX, "utf-8"));
  const holdout = argv.includes("--holdout");
  const runFlag = parseFlag("--run");
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const runDir = runFlag ? resolve(runFlag) : join(RUNS_DIR, `adaptive-${holdout ? "holdout-" : ""}${stamp}`);
  runAdaptive({ runDir, holdout, matrix });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`adaptive failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
