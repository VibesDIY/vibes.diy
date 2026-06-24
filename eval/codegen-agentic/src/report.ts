import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stderr } from "node:process";
import { CELL_JSON, CELL_SCORE_JSON, type ModeName } from "./cell.js";

export interface ReportRow {
  model: string;
  mode: ModeName;
  openWeight: boolean;
  promptId: string;
  needsAccess: boolean;
  buildPass: boolean;
  feature: number | null;
  costUsd: number;
  hasAccessJs: boolean;
}

export interface ModelModeStat {
  model: string;
  mode: ModeName;
  openWeight: boolean;
  n: number;
  buildPassRate: number;
  meanFeature: number | null;
  acceptable: number;
  costPerAcceptable: number | null;
  meanCostUsd: number;
}

export function isAcceptable(r: ReportRow, bar: number): boolean {
  return r.buildPass && r.feature !== null && r.feature >= bar && (!r.needsAccess || r.hasAccessJs);
}

export function aggregate(rows: readonly ReportRow[], bar: number): ModelModeStat[] {
  const groups = new Map<string, ReportRow[]>();
  for (const r of rows) {
    const k = `${r.model}\0${r.mode}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const out: ModelModeStat[] = [];
  for (const g of groups.values()) {
    const feats = g.map((r) => r.feature).filter((f): f is number => f !== null);
    const acceptable = g.filter((r) => isAcceptable(r, bar)).length;
    const totalCost = g.reduce((a, r) => a + r.costUsd, 0);
    out.push({
      model: g[0].model,
      mode: g[0].mode,
      openWeight: g[0].openWeight,
      n: g.length,
      buildPassRate: g.filter((r) => r.buildPass).length / g.length,
      meanFeature: feats.length ? feats.reduce((a, b) => a + b, 0) / feats.length : null,
      acceptable,
      costPerAcceptable: acceptable ? totalCost / acceptable : null,
      meanCostUsd: totalCost / g.length,
    });
  }
  return out.sort((a, b) => a.model.localeCompare(b.model) || a.mode.localeCompare(b.mode));
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function num(n: number | null, d = 2): string {
  return n === null ? "—" : n.toFixed(d);
}

export function renderReport(stats: readonly ModelModeStat[]): string {
  const header =
    "| model | open? | mode | n | build-pass | mean feature | acceptable | $/acceptable | mean $/gen |";
  const sep = "| --- | --- | --- | --: | --: | --: | --: | --: | --: |";
  const body = stats.map(
    (s) =>
      `| ${s.model} | ${s.openWeight ? "open" : "closed"} | ${s.mode} | ${s.n} | ${pct(s.buildPassRate)} | ${num(s.meanFeature)} | ${s.acceptable}/${s.n} | ${s.costPerAcceptable === null ? "—" : "$" + s.costPerAcceptable.toFixed(4)} | $${s.meanCostUsd.toFixed(4)} |`,
  );
  // Delta table: one-shot -> agentic per model.
  const byModel = new Map<string, Record<ModeName, ModelModeStat>>();
  for (const s of stats) {
    const e = byModel.get(s.model) ?? ({} as Record<ModeName, ModelModeStat>);
    e[s.mode] = s;
    byModel.set(s.model, e);
  }
  const delta = [...byModel.entries()]
    .filter(([, e]) => e.oneshot && e.agentic)
    .map(([m, e]) => {
      const df = (e.agentic.meanFeature ?? 0) - (e.oneshot.meanFeature ?? 0);
      const db = e.agentic.buildPassRate - e.oneshot.buildPassRate;
      return `| ${m} | ${pct(e.oneshot.buildPassRate)} → ${pct(e.agentic.buildPassRate)} (${db >= 0 ? "+" : ""}${pct(db)}) | ${num(e.oneshot.meanFeature)} → ${num(e.agentic.meanFeature)} (${df >= 0 ? "+" : ""}${df.toFixed(2)}) |`;
    });
  return [
    "# codegen-agentic summary",
    "",
    "## Per-model × mode",
    "",
    header,
    sep,
    ...body,
    "",
    "## one-shot → agentic delta (the confound-removal result)",
    "",
    "| model | build-pass | mean feature |",
    "| --- | --- | --- |",
    ...delta,
    "",
  ].join("\n");
}

function main(): void {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const runs = resolve(ROOT, "runs");
  const dirs = readdirSync(runs)
    .filter((n) => n !== ".gitignore")
    .sort();
  if (!dirs.length) throw new Error("no runs");
  const runDir = join(runs, dirs[dirs.length - 1]);
  const bar = JSON.parse(readFileSync(join(ROOT, "config/matrix.json"), "utf-8"))
    .featureAcceptBar as number;
  const rows: ReportRow[] = [];
  for (const name of readdirSync(runDir)) {
    const cellDir = join(runDir, name);
    if (!existsSync(join(cellDir, CELL_JSON))) continue;
    const cell = JSON.parse(readFileSync(join(cellDir, CELL_JSON), "utf-8")) as {
      model: string;
      mode: ModeName;
      openWeight: boolean;
      promptId: string;
      needsAccess: boolean;
      buildPass: boolean;
      costUsd: number;
    };
    const sp = join(cellDir, CELL_SCORE_JSON);
    const score = existsSync(sp) ? JSON.parse(readFileSync(sp, "utf-8")) : undefined;
    rows.push({
      model: cell.model,
      mode: cell.mode,
      openWeight: cell.openWeight,
      promptId: cell.promptId,
      needsAccess: cell.needsAccess,
      buildPass: cell.buildPass,
      costUsd: cell.costUsd,
      feature: score?.feature?.score ?? null,
      hasAccessJs: score?.structure?.hasAccessJs ?? false,
    });
  }
  writeFileSync(
    join(runDir, "index.jsonl"),
    rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
    "utf-8",
  );
  writeFileSync(join(runDir, "summary.md"), renderReport(aggregate(rows, bar)), "utf-8");
  stderr.write(`wrote summary.md + index.jsonl to ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
