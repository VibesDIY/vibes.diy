import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { parseMatrix, parsePrompts } from "./config.js";
import { makeClient } from "./client.js";
import { runOneShot } from "./oneshot.js";
import { runAgentic } from "./agentic.js";
import { mapWithConcurrency } from "./pool.js";
import { cellDirName, CELL_JSON, RUN_JSON, type CellResult, type MatrixConfig, type ModeName, type PromptEntry } from "./cell.js";
import type { OpenRouter } from "@openrouter/agent";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

interface Job {
  model: string;
  openWeight: boolean;
  prompt: PromptEntry;
  rep: number;
  mode: ModeName;
}

async function runJob(client: OpenRouter, cfg: MatrixConfig, systemPrompt: string, job: Job, runDir: string): Promise<CellResult> {
  const gen =
    job.mode === "oneshot"
      ? await runOneShot(client, job.model, systemPrompt, job.prompt.prompt)
      : await runAgentic(client, job.model, systemPrompt, job.prompt.prompt, {
          maxSteps: cfg.maxSteps,
          maxCostUsd: cfg.maxCostUsd,
          needsAccess: job.prompt.needsAccess,
        });
  const cell: CellResult = {
    ...gen,
    promptId: job.prompt.id,
    model: job.model,
    mode: job.mode,
    rep: job.rep,
    openWeight: job.openWeight,
    needsAccess: job.prompt.needsAccess,
  };
  const cellDir = join(runDir, cellDirName(job.prompt.id, job.model, job.rep, job.mode));
  mkdirSync(cellDir, { recursive: true });
  // A model may emit a path with a subdir segment (e.g. "src/App.jsx"); mkdir the
  // parent before writing so a stray nested path can't throw ENOENT and abort the sweep.
  for (const [path, contents] of Object.entries(gen.files)) {
    const dest = join(cellDir, path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, contents, "utf-8");
  }
  const { files: _omit, ...meta } = cell; // keep cell.json lean; files are on disk
  writeFileSync(join(cellDir, CELL_JSON), JSON.stringify({ ...meta, fileNames: Object.keys(gen.files) }, null, 2), "utf-8");
  stderr.write(
    `  ${job.prompt.id} ${job.model} r${job.rep} ${job.mode}: ${gen.exitState} build=${gen.buildPass} steps=${gen.steps} $${gen.costUsd.toFixed(4)}\n`
  );
  return cell;
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  return argv[ix].includes("=") ? argv[ix].slice(argv[ix].indexOf("=") + 1) : argv[ix + 1];
}

export async function main(): Promise<void> {
  const cfg = parseMatrix(readFileSync(parseFlag("--matrix") ?? join(ROOT, "config/matrix.json"), "utf-8"));
  const prompts = parsePrompts(readFileSync(parseFlag("--prompts") ?? join(ROOT, "config/prompts.jsonl"), "utf-8"));
  const systemPrompt = readFileSync(parseFlag("--system") ?? join(ROOT, "config/system-prompt.md"), "utf-8");
  const client = makeClient();
  const ts = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const runDir = join(ROOT, "runs", ts);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    join(runDir, RUN_JSON),
    JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        judgeModel: cfg.judgeModel,
        reps: cfg.reps,
        modes: cfg.modes,
        maxSteps: cfg.maxSteps,
        maxCostUsd: cfg.maxCostUsd,
        models: cfg.models.map((m) => m.id),
      },
      null,
      2
    ),
    "utf-8"
  );

  // Preflight: one smoke cell (first model, first prompt, both modes) before the sweep.
  const smokeModel = cfg.models[0];
  for (const mode of cfg.modes) {
    const r = await runJob(
      client,
      cfg,
      systemPrompt,
      { model: smokeModel.id, openWeight: smokeModel.openWeight, prompt: prompts[0], rep: 0, mode },
      runDir
    );
    if (r.exitState === "errored") throw new Error(`preflight ${mode} errored: ${r.note}`);
  }
  stderr.write(`preflight ok. proceeding to full sweep.\n`);

  const jobs: Job[] = [];
  for (const model of cfg.models)
    for (const prompt of prompts)
      for (const mode of cfg.modes)
        for (let rep = 0; rep < cfg.reps; rep++) {
          if (model.id === smokeModel.id && prompt.id === prompts[0].id && rep === 0) continue; // already ran in preflight
          jobs.push({ model: model.id, openWeight: model.openWeight, prompt, rep, mode });
        }

  let spent = 0;
  stderr.write(
    `codegen-agentic: ${jobs.length} cells, concurrency=${cfg.concurrency}, budget $${cfg.budgetUsdTotal} -> ${runDir}\n`
  );
  await mapWithConcurrency(jobs, cfg.concurrency, async (job) => {
    // Soft aggregate cap: no NEW job starts once the budget is reached, but up to
    // `concurrency` jobs already in flight still finish, so total spend can overshoot
    // by at most concurrency × maxCostUsd. The per-cell maxCost SDK stop is the hard
    // per-request cap. (A strictly-hard aggregate cap would require cancelling in-flight
    // requests — out of scope for v1.)
    if (spent >= cfg.budgetUsdTotal) return;
    const r = await runJob(client, cfg, systemPrompt, job, runDir);
    spent += r.costUsd;
    stderr.write(`  [budget] spent $${spent.toFixed(2)} / $${cfg.budgetUsdTotal}\n`);
  });
  stderr.write(`done. spent ~$${spent.toFixed(2)}. run dir: ${runDir}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`generate failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
