import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { readCellJson, writeCellScore, screenshotUrl, type CellJson, type CellScore, CELL_JSON } from "./cell.js";
import { runRubric } from "./rubric.js";
import { computeStructure } from "./structure.js";
import { readDevVars, judgeFeature, judgeDesign, type JudgeDeps } from "./judge.js";
import { waitForScreenshot } from "./readiness.js";
import { mapWithConcurrency } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = resolve(__dirname, "..", "runs");

const SOURCE_EXTS = new Set([".jsx", ".js", ".tsx", ".ts", ".css"]);

/** Read the generated source files (App.jsx, access.js, …) from a cell's app directory. */
export function collectSourceFiles(directory: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(directory)) {
    if (name === "README.md") continue;
    if (!SOURCE_EXTS.has(extname(name))) continue;
    out[name] = readFileSync(join(directory, name), "utf-8");
  }
  return out;
}

export function toDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function fetchImage(url: string): Promise<Uint8Array | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}

async function scoreCell(args: {
  readonly cellDir: string;
  readonly cell: CellJson;
  readonly userPrompt: string;
  readonly judgeDeps: JudgeDeps;
  readonly screenshotTimeoutMs: number;
}): Promise<CellScore> {
  const { cellDir, cell, userPrompt, judgeDeps, screenshotTimeoutMs } = args;
  const files = collectSourceFiles(cell.directory);
  const rubric = runRubric(files);
  const structure = computeStructure(files);
  const feature = await judgeFeature(userPrompt, files, judgeDeps);

  const shotUrl = screenshotUrl(cell.runtimeHostBase, cell.appSlug, cell.ownerHandle);
  const readiness = await waitForScreenshot(shotUrl, { timeoutMs: screenshotTimeoutMs });
  let design: CellScore["design"];
  if (!readiness.ready) {
    design = { available: false, score: null, reason: "screenshot not ready before timeout", judgeModel: judgeDeps.judgeModel };
  } else {
    const bytes = await fetchImage(shotUrl);
    design = bytes
      ? await judgeDesign(userPrompt, toDataUrl(bytes, "image/jpeg"), judgeDeps)
      : { available: false, score: null, reason: "screenshot fetch failed", judgeModel: judgeDeps.judgeModel };
  }

  const score: CellScore = { promptId: cell.promptId, model: cell.model, rep: cell.rep, rubric, feature, design, structure };
  writeCellScore(cellDir, score);
  stderr.write(
    `  scored ${cell.promptId} ${cell.model} r${cell.rep}: rubric=${rubric.passed}/${rubric.total} feature=${feature.score} design=${design.score}` +
      ` [access.js=${structure.hasAccessJs ? "y" : "n"} can=${structure.gatesOnCan ? "y" : "n"} reqAccess=${structure.usesRequireAccess ? "y" : "n"}]\n`
  );
  return score;
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

async function main(): Promise<void> {
  const runDir = parseFlag("--run") ?? latestRunDir();
  const promptsPath = parseFlag("--prompts") ?? resolve(__dirname, "..", "config/prompts.jsonl");
  const judgeModelOverride = parseFlag("--judge-model");
  // Map promptId -> prompt text for the judges.
  const promptText = new Map<string, string>();
  for (const line of readFileSync(promptsPath, "utf-8")
    .split("\n")
    .filter((l) => l.trim())) {
    const e = JSON.parse(line) as { id: string; prompt: string };
    promptText.set(e.id, e.prompt);
  }
  // screenshotTimeoutMs + judgeModel + scoreConcurrency come from the matrix config.
  const matrix = JSON.parse(readFileSync(resolve(__dirname, "..", "config/matrix.json"), "utf-8")) as {
    screenshotTimeoutMs: number;
    judgeModel: string;
    scoreConcurrency?: number;
  };
  const judgeDeps: JudgeDeps = {
    devVars: readDevVars(),
    judgeModel: judgeModelOverride ?? matrix.judgeModel,
  };
  // Score concurrency defaults lower than generate (judge backend is more
  // rate-limit-sensitive); --concurrency still overrides per run.
  const concurrency = Math.max(1, Math.floor(Number(parseFlag("--concurrency") ?? matrix.scoreConcurrency ?? 4)) || 1);

  const cellDirs = readdirSync(runDir).filter((n) => existsSync(join(runDir, n, CELL_JSON)));
  stderr.write(`scoring ${cellDirs.length} cell(s) in ${runDir}, concurrency=${concurrency}\n`);
  let scored = 0;
  let nullJudge = 0; // cells where a judge score came back null (transient backend failure, etc.)
  await mapWithConcurrency(cellDirs, concurrency, async (name) => {
    const cellDir = join(runDir, name);
    const cell = readCellJson(cellDir);
    if (!cell || cell.exitState !== "ok") {
      stderr.write(`  skip ${name}: ${cell?.exitState ?? "no cell.json"}\n`);
      return;
    }
    const userPrompt = promptText.get(cell.promptId) ?? "";
    const score = await scoreCell({ cellDir, cell, userPrompt, judgeDeps, screenshotTimeoutMs: matrix.screenshotTimeoutMs });
    scored++;
    if (score.feature.score === null || score.design.score === null) nullJudge++;
  });
  // Surface degraded signal: if many cells couldn't be judged, the run's scores
  // are weaker than they look (e.g. judge-backend rate limiting under concurrency).
  if (scored > 0 && nullJudge / scored > 0.2) {
    stderr.write(
      `WARNING: ${nullJudge}/${scored} scored cells have a null judge score (${Math.round((100 * nullJudge) / scored)}%). ` +
        `Judge signal is degraded — consider lowering --concurrency or re-running score.\n`
    );
  }
  stderr.write(`done scoring ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`score failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
