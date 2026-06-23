import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { readCellJson, readCellScore, CELL_JSON } from "./cell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, "..", "runs");

export interface JoinedCell {
  readonly promptId: string;
  readonly model: string;
  readonly class: string;
  readonly tier: string;
  readonly rep: number;
  readonly latencyMs: number;
  readonly exitState: "ok" | "generate-failed";
  readonly attempts: number;
  readonly rubricRatio: number | null;
  readonly featureScore: number | null;
  readonly designScore: number | null;
}

export interface Row {
  readonly promptId: string;
  readonly model: string;
  readonly class: string;
  readonly tier: string;
  readonly reps: number;
  readonly medianLatencyMs: number;
  readonly meanRubric: number | null;
  readonly meanFeature: number | null;
  readonly meanDesign: number | null;
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(xs: readonly (number | null)[]): number | null {
  const vals = xs.filter((x): x is number => x !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function buildRows(cells: readonly JoinedCell[]): Row[] {
  const groups = new Map<string, JoinedCell[]>();
  for (const c of cells) {
    const key = `${c.model} ${c.promptId}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  const rows: Row[] = [];
  for (const group of groups.values()) {
    const first = group[0];
    rows.push({
      promptId: first.promptId,
      model: first.model,
      class: first.class,
      tier: first.tier,
      reps: group.length,
      medianLatencyMs: median(group.map((g) => g.latencyMs)),
      meanRubric: mean(group.map((g) => g.rubricRatio)),
      meanFeature: mean(group.map((g) => g.featureScore)),
      meanDesign: mean(group.map((g) => g.designScore)),
    });
  }
  return rows.sort((a, b) => a.model.localeCompare(b.model) || a.promptId.localeCompare(b.promptId));
}

function fmt(n: number | null, digits = 2): string {
  return n === null || Number.isNaN(n) ? "—" : n.toFixed(digits);
}

export function renderSummary(rows: readonly Row[]): string {
  const header = "| model | class | tier | prompt | reps | median ms | rubric | feature | design |";
  const sep = "| --- | --- | --- | --- | --: | --: | --: | --: | --: |";
  const body = rows.map(
    (r) =>
      `| ${r.model} | ${r.class} | ${r.tier} | ${r.promptId} | ${r.reps} | ${r.medianLatencyMs} | ${fmt(r.meanRubric)} | ${fmt(r.meanFeature)} | ${fmt(r.meanDesign)} |`
  );
  return [`# codegen-matrix summary`, "", header, sep, ...body, ""].join("\n");
}

function joinCells(runDir: string): JoinedCell[] {
  const out: JoinedCell[] = [];
  for (const name of readdirSync(runDir)) {
    const cellDir = join(runDir, name);
    if (!existsSync(join(cellDir, CELL_JSON))) continue;
    const cell = readCellJson(cellDir);
    if (!cell) continue;
    const score = readCellScore(cellDir); // may be undefined for failed/unscored cells
    out.push({
      promptId: cell.promptId,
      model: cell.model,
      class: cell.class,
      tier: cell.tier,
      rep: cell.rep,
      latencyMs: cell.latencyMs,
      exitState: cell.exitState,
      attempts: cell.attempts,
      rubricRatio: score ? score.rubric.passed / score.rubric.total : null,
      featureScore: score?.feature.score ?? null,
      designScore: score?.design.score ?? null,
    });
  }
  return out;
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const a = argv[ix];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[ix + 1];
}

function latestRunDir(): string {
  const dirs = readdirSync(RUNS_DIR)
    .filter((n) => n !== ".gitignore")
    .sort();
  if (dirs.length === 0) throw new Error(`no runs under ${RUNS_DIR}`);
  return join(RUNS_DIR, dirs[dirs.length - 1]);
}

function main(): void {
  const runDir = parseFlag("--run") ?? latestRunDir();
  const cells = joinCells(runDir);
  writeFileSync(join(runDir, "index.jsonl"), cells.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf-8");
  writeFileSync(join(runDir, "summary.md"), renderSummary(buildRows(cells)), "utf-8");
  stderr.write(`wrote index.jsonl + summary.md to ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
