import { readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import {
  runRubric,
  computeStructure,
  judgeFeature,
  readDevVars,
  collectSourceFiles,
  type JudgeDeps,
} from "@vibes.diy/eval-codegen-matrix/scoring";
import { CELL_JSON, CELL_SCORE_JSON, type CellScore, type PromptEntry } from "./cell.js";
import { parsePrompts } from "./config.js";
import { mapWithConcurrency } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  return argv[ix].includes("=") ? argv[ix].slice(argv[ix].indexOf("=") + 1) : argv[ix + 1];
}
function latestRunDir(): string {
  const runs = resolve(ROOT, "runs");
  const dirs = readdirSync(runs)
    .filter((n) => n !== ".gitignore")
    .sort();
  if (!dirs.length) throw new Error(`no runs under ${runs}`);
  return join(runs, dirs[dirs.length - 1]);
}

async function main(): Promise<void> {
  const runDir = parseFlag("--run") ?? latestRunDir();
  const prompts = parsePrompts(readFileSync(parseFlag("--prompts") ?? join(ROOT, "config/prompts.jsonl"), "utf-8"));
  const promptText = new Map<string, string>(prompts.map((p: PromptEntry): [string, string] => [p.id, p.prompt]));
  const deps: JudgeDeps = {
    devVars: readDevVars(),
    judgeModel: JSON.parse(readFileSync(join(ROOT, "config/matrix.json"), "utf-8")).judgeModel,
  };
  const cellDirs = readdirSync(runDir).filter((n) => existsSync(join(runDir, n, CELL_JSON)));
  stderr.write(`scoring ${cellDirs.length} cells in ${runDir}\n`);
  let scored = 0,
    nullJudge = 0;
  await mapWithConcurrency(cellDirs, 4, async (name: string) => {
    const cellDir = join(runDir, name);
    const cell = JSON.parse(readFileSync(join(cellDir, CELL_JSON), "utf-8")) as {
      promptId: string;
      model: string;
      mode: CellScore["mode"];
      rep: number;
      exitState: string;
    };
    if (cell.exitState !== "ok") {
      stderr.write(`  skip ${name}: ${cell.exitState}\n`);
      return;
    }
    const files = collectSourceFiles(cellDir);
    const rubric = runRubric(files);
    const structure = computeStructure(files);
    const feature = await judgeFeature(promptText.get(cell.promptId) ?? "", files, deps);
    const score: CellScore = {
      promptId: cell.promptId,
      model: cell.model,
      mode: cell.mode,
      rep: cell.rep,
      rubric,
      feature,
      structure,
    };
    writeFileSync(join(cellDir, CELL_SCORE_JSON), JSON.stringify(score, null, 2), "utf-8");
    scored++;
    if (feature.score === null) nullJudge++;
    stderr.write(`  scored ${name}: rubric=${rubric.passed}/${rubric.total} feature=${feature.score}\n`);
  });
  if (scored > 0 && nullJudge / scored > 0.2)
    stderr.write(`WARNING: ${nullJudge}/${scored} cells have a null judge score (${Math.round((100 * nullJudge) / scored)}%).\n`);
  stderr.write(`done scoring ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`score failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
