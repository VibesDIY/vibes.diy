import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr, stdout } from "node:process";
import { rollup, type MetricCell, type Rollup } from "./metric.js";
import type { Grade } from "./grade.js";
import { CELL_JSON, type AccessCellJson } from "./generate.js";
import { SCORE_JSON, GENERATE_FAILED, type ScoredCell } from "./score.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RUNS_DIR = resolve(ROOT, "runs");

export const RESULTS_JSON = "results.json";
export const SUMMARY_MD = "access-summary.md";

type CellGrade = Grade | typeof GENERATE_FAILED;

/** One scored cell as consumed by the report aggregation (a join of cell.json + cell.score.json). */
export interface ScoredRow {
  readonly id: string;
  readonly expect: string;
  readonly grade: CellGrade;
  readonly twoFile: boolean;
  readonly renderable: boolean;
  readonly formAStrict: boolean;
  readonly formABroad: boolean;
  readonly isOwnerWriteGate: boolean;
  readonly ok: boolean;
  readonly reasons?: readonly string[];
}

/** One aggregated row per prompt id (mirrors the per-row shape of the #2588 results JSON). */
export interface ResultRow {
  readonly id: string;
  readonly prompt: string;
  readonly dimension: string;
  readonly reps: number;
  readonly pass: number;
  readonly soft_fail: number;
  readonly fail: number;
  readonly generate_failed: number;
  /** the modal grade across reps (most common; ties resolve worst-first PASS>SOFT>FAIL). */
  readonly grade: CellGrade;
  readonly formA: boolean;
  readonly formABroad: boolean;
  readonly isOwner: boolean;
  readonly twoFile: boolean;
  readonly renderable: boolean;
  readonly reasons: readonly string[];
}

export interface Results {
  readonly rollup: Rollup;
  readonly rows: readonly ResultRow[];
}

function toMetricCell(r: ScoredRow): MetricCell {
  return {
    grade: r.grade,
    twoFile: r.twoFile,
    renderable: r.renderable,
    formAStrict: r.formAStrict,
    formABroad: r.formABroad,
    isOwnerWriteGate: r.isOwnerWriteGate,
    ok: r.ok,
  };
}

function modalGrade(reps: readonly ScoredRow[]): CellGrade {
  const order: CellGrade[] = ["PASS", "SOFT", "FAIL", GENERATE_FAILED];
  const counts = new Map<CellGrade, number>();
  for (const r of reps) counts.set(r.grade, (counts.get(r.grade) ?? 0) + 1);
  let best: CellGrade = reps[0]?.grade ?? "FAIL";
  let bestN = -1;
  for (const g of order) {
    const n = counts.get(g) ?? 0;
    if (n > bestN) {
      best = g;
      bestN = n;
    }
  }
  return best;
}

/**
 * Aggregate scored cells into the rollup (via metric.ts) plus one row per prompt id.
 * Row order follows first appearance, so the eval matrix order is preserved.
 */
export function buildResults(cells: readonly ScoredRow[]): Results {
  const r = rollup(cells.map(toMetricCell));

  const byId = new Map<string, ScoredRow[]>();
  const order: string[] = [];
  for (const c of cells) {
    if (!byId.has(c.id)) {
      byId.set(c.id, []);
      order.push(c.id);
    }
    byId.get(c.id)!.push(c);
  }

  const rows: ResultRow[] = order.map((id) => {
    const reps = byId.get(id)!;
    const count = (g: CellGrade) => reps.filter((x) => x.grade === g).length;
    const any = (p: (x: ScoredRow) => boolean) => reps.some(p);
    const all = (p: (x: ScoredRow) => boolean) => reps.every(p);
    const reasons = [...new Set(reps.flatMap((x) => x.reasons ?? []))];
    return {
      id,
      prompt: "",
      dimension: reps[0].expect,
      reps: reps.length,
      pass: count("PASS"),
      soft_fail: count("SOFT"),
      fail: count("FAIL"),
      generate_failed: count(GENERATE_FAILED),
      grade: modalGrade(reps),
      formA: any((x) => x.formAStrict),
      formABroad: any((x) => x.formABroad),
      isOwner: any((x) => x.isOwnerWriteGate),
      twoFile: all((x) => x.twoFile),
      renderable: all((x) => x.renderable),
      reasons,
    };
  });

  return { rollup: r, rows };
}

/** The single scalar line the autoresearch loop greps for. */
export function renderMetricLine(metric: number): string {
  return `METRIC=${metric}`;
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** A human-readable markdown table summarizing the run. */
export function renderSummary(results: Results): string {
  const r = results.rollup;
  const lines: string[] = [];
  lines.push(`# Access-model eval summary`);
  lines.push("");
  lines.push(`- METRIC: **${r.metric.toFixed(4)}** (mean PASS=1/SOFT=.5/FAIL=0 over ${r.scored} scored cells)`);
  lines.push(`- platform-failed (excluded): ${r.platformFailed}`);
  lines.push(`- Form-A strict rate: ${pct(r.formAStrictRate)} | Form-A broad rate: ${pct(r.formABroadRate)}`);
  lines.push(`- isOwner write-gate count: ${r.isOwnerCount}`);
  lines.push(`- two-file rate: ${pct(r.twoFileRate)} | renderable rate: ${pct(r.renderableRate)}`);
  lines.push("");
  lines.push(`| prompt | dimension | grade | pass | soft | fail | gen-failed | formA | twoFile | renderable |`);
  lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`);
  for (const row of results.rows) {
    lines.push(
      `| ${row.id} | ${row.dimension} | ${row.grade} | ${row.pass} | ${row.soft_fail} | ${row.fail} | ${row.generate_failed} | ${row.formA} | ${row.twoFile} | ${row.renderable} |`
    );
  }
  lines.push("");
  return lines.join("\n");
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

function resolveRunDir(): string {
  const flag = parseFlag("--run");
  if (flag) return resolve(flag);
  const dirs = subdirs(RUNS_DIR).map((name) => join(RUNS_DIR, name));
  if (dirs.length === 0) throw new Error(`no runs found under ${RUNS_DIR}`);
  return dirs.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

/** Join cell.json + cell.score.json across the run into the report's ScoredRow shape. */
function loadScoredRows(runDir: string): { rows: ScoredRow[]; prompts: Map<string, string>; dims: Map<string, string> } {
  const rows: ScoredRow[] = [];
  const prompts = new Map<string, string>();
  const dims = new Map<string, string>();
  for (const name of subdirs(runDir)) {
    const dir = join(runDir, name);
    let cell: AccessCellJson;
    let score: ScoredCell;
    try {
      cell = JSON.parse(readFileSync(join(dir, CELL_JSON), "utf-8"));
      score = JSON.parse(readFileSync(join(dir, SCORE_JSON), "utf-8"));
    } catch {
      continue; // not a scored cell dir
    }
    prompts.set(cell.promptId, cell.prompt);
    dims.set(cell.promptId, cell.expect);
    rows.push({
      id: cell.promptId,
      expect: cell.expect,
      grade: score.grade,
      twoFile: score.twoFile,
      renderable: score.renderable,
      formAStrict: score.formAStrict,
      formABroad: score.formABroad,
      isOwnerWriteGate: score.isOwnerWriteGate,
      ok: score.ok,
      reasons: score.reasons,
    });
  }
  return { rows, prompts, dims };
}

/**
 * Aggregate a scored run into results.json (#2588 schema) + access-summary.md, and
 * print `METRIC=<x>` as the LAST line of stdout (the scalar the autoresearch loop reads).
 */
export async function main(): Promise<void> {
  const runDir = resolveRunDir();
  const { rows: scoredRows, prompts } = loadScoredRows(runDir);
  if (scoredRows.length === 0) throw new Error(`no scored cells (cell.score.json) under ${runDir} — run score first`);

  const results = buildResults(scoredRows);
  // backfill the prompt text on each row (buildResults doesn't see cell.json).
  const rowsWithPrompts: ResultRow[] = results.rows.map((row) => ({ ...row, prompt: prompts.get(row.id) ?? "" }));
  const out: Results = { rollup: results.rollup, rows: rowsWithPrompts };

  writeFileSync(join(runDir, RESULTS_JSON), JSON.stringify(out, null, 2), "utf-8");
  writeFileSync(join(runDir, SUMMARY_MD), renderSummary(out), "utf-8");
  stderr.write(`access-model report: wrote ${RESULTS_JSON} + ${SUMMARY_MD} -> ${runDir}\n`);

  // LAST line: the metric scalar.
  stdout.write(`${renderMetricLine(out.rollup.metric)}\n`);
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`report failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
