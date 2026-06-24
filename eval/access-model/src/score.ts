import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr, stdout } from "node:process";
import { mapWithConcurrency } from "../../codegen-matrix/src/pool.js";
import { analyzeAccess } from "./invariants.js";
import { checkFiles } from "./renderable.js";
import { gradeRow, type Grade, type JudgeVerdict } from "./grade.js";
import { parseAccessMatrix, type AccessMatrix, type Dimension } from "./config.js";
import { realJudgeDeps, judgeSecondVisitor, type JudgeDeps } from "./judge.js";
import { CELL_JSON, RUN_JSON, type AccessCellJson } from "./generate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_MATRIX = resolve(ROOT, "config/matrix.json");
const RUNS_DIR = resolve(ROOT, "runs");

export const SCORE_JSON = "cell.score.json";

/** A platform/generate failure carries this sentinel grade and ok:false so the metric excludes it. */
export const GENERATE_FAILED = "GENERATE_FAILED" as const;

export interface ScoredCell {
  readonly grade: Grade | typeof GENERATE_FAILED;
  readonly modelOk: boolean;
  readonly twoFile: boolean;
  readonly renderable: boolean;
  readonly formAStrict: boolean;
  readonly formABroad: boolean;
  readonly isOwnerWriteGate: boolean;
  /** false => platform/generate failure, excluded from the metric. */
  readonly ok: boolean;
  readonly judgeVerdict: JudgeVerdict | null;
  readonly reasons: string[];
}

const MULTIPLAYER: ReadonlySet<Dimension> = new Set<Dimension>([
  "per-visitor",
  "per-object",
  "author-owned",
  "multi-tier",
]);

/**
 * Score one cell: static `analyzeAccess` + `checkFiles` always; the second-visitor
 * judge only for multiplayer dimensions. Pure given the injected `judge` fake.
 */
export async function scoreCell(
  input: { readonly expect: Dimension; readonly prompt: string; readonly files: Record<string, string> },
  deps: {
    readonly judge: (a: {
      prompt: string;
      expect: Dimension;
      files: Record<string, string>;
    }) => Promise<JudgeVerdict | null>;
  },
): Promise<ScoredCell> {
  const analysis = analyzeAccess(input.files["access.js"] ?? "", input.expect);
  const files = checkFiles(input.files);
  const judge = MULTIPLAYER.has(input.expect)
    ? await deps.judge({ prompt: input.prompt, expect: input.expect, files: input.files })
    : null;
  const g = gradeRow({ expect: input.expect, analysis, files, judge });
  return {
    grade: g.grade,
    modelOk: g.modelOk,
    twoFile: files.twoFile,
    renderable: files.renderable,
    formAStrict: analysis.formAStrict,
    formABroad: analysis.formABroad,
    isOwnerWriteGate: analysis.isOwnerWriteGate,
    ok: true,
    judgeVerdict: judge,
    reasons: g.reasons,
  };
}

/** A cell that failed to generate is excluded from the metric via the sentinel grade. */
function generateFailedCell(): ScoredCell {
  return {
    grade: GENERATE_FAILED,
    modelOk: false,
    twoFile: false,
    renderable: false,
    formAStrict: false,
    formABroad: false,
    isOwnerWriteGate: false,
    ok: false,
    judgeVerdict: null,
    reasons: ["generate-failed (platform failure, excluded from score)"],
  };
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const a = argv[ix];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[ix + 1];
}

function subdirs(dir: string): string[] {
  return readdirSync(dir).filter((name) => {
    try {
      return statSync(join(dir, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

/** Pick `--run <dir>` or the most-recently-modified run dir under runs/. */
function resolveRunDir(): string {
  const flag = parseFlag("--run");
  if (flag) return resolve(flag);
  const dirs = subdirs(RUNS_DIR).map((name) => join(RUNS_DIR, name));
  if (dirs.length === 0) throw new Error(`no runs found under ${RUNS_DIR}`);
  return dirs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

/** Locate every cell dir (a subdir containing a cell.json) under the run dir. */
function cellDirs(runDir: string): string[] {
  return subdirs(runDir)
    .map((name) => join(runDir, name))
    .filter((dir) => {
      try {
        return statSync(join(dir, CELL_JSON)).isFile();
      } catch {
        return false;
      }
    });
}

/**
 * Score every cell in a run: read each `cell.json` (the shape generate.ts writes),
 * run `scoreCell` (real judge wired via realJudgeDeps), and write `cell.score.json`
 * beside it. `generate-failed` cells are marked with the sentinel grade and skip the
 * judge entirely.
 */
export async function main(): Promise<void> {
  const matrix: AccessMatrix = parseAccessMatrix(readFileSync(parseFlag("--matrix") ?? DEFAULT_MATRIX, "utf-8"));
  const runDir = resolveRunDir();
  // run.json is informational here; presence confirms a real run dir.
  void RUN_JSON;

  const dirs = cellDirs(runDir);
  stderr.write(`access-model score: ${dirs.length} cells in ${runDir} (concurrency=${matrix.scoreConcurrency})\n`);

  const judgeDeps: JudgeDeps = realJudgeDeps(matrix);
  const judge = (a: { prompt: string; expect: Dimension; files: Record<string, string> }) =>
    judgeSecondVisitor(a, judgeDeps);

  await mapWithConcurrency(dirs, matrix.scoreConcurrency, async (dir) => {
    const cell: AccessCellJson = JSON.parse(readFileSync(join(dir, CELL_JSON), "utf-8"));
    const scored =
      cell.exitState === "generate-failed"
        ? generateFailedCell()
        : await scoreCell(
            { expect: cell.expect as Dimension, prompt: cell.prompt, files: cell.files },
            { judge },
          );
    writeFileSync(join(dir, SCORE_JSON), JSON.stringify(scored, null, 2), "utf-8");
    stderr.write(`  ${cell.promptId} r${cell.rep}: ${scored.grade}\n`);
  });

  stdout.write(`scored ${dirs.length} cells -> ${runDir}\n`);
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`score failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
