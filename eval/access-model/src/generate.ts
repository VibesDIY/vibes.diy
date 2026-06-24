import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { parseAccessMatrix, parseAccessPrompts, type AccessMatrix, type AccessPrompt } from "./config.js";
import { resolveDefaultModel, fetchDefault } from "./model.js";
// Reuse codegen-matrix internals (both packages run under tsx; do NOT modify codegen-matrix).
import { mapWithConcurrency } from "../../codegen-matrix/src/pool.js";
import { runWithRetries, summarizeReason, type AttemptResult } from "../../codegen-matrix/src/generate.js";
import { cellDirName, discoverAppSlug, type AttemptLogEntry } from "../../codegen-matrix/src/cell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_MATRIX = resolve(ROOT, "config/matrix.json");
const DEFAULT_PROMPTS = resolve(ROOT, "config/prompts.eval.jsonl");
const HOLDOUT_PROMPTS = resolve(ROOT, "config/prompts.holdout.jsonl");
const RUNS_DIR = resolve(ROOT, "runs");

export const CELL_JSON = "cell.json";
export const RUN_JSON = "run.json";

/**
 * Build the `vibes-diy generate` arg vector for one access-model cell. Mirrors
 * codegen-matrix's `buildGenerateArgs` but pins `--model` to the resolved default
 * and passes a per-cell `--app-slug` (the live env collides on derived slugs across
 * reps, so each cell gets a unique slug).
 */
export function buildAccessGenerateArgs(o: {
  readonly model: string;
  readonly handle: string;
  readonly apiUrl: string;
  readonly appSlug: string;
  readonly prompt: string;
}): string[] {
  return [
    "generate",
    "--model",
    o.model,
    "--handle",
    o.handle,
    "--api-url",
    o.apiUrl,
    "--app-slug",
    o.appSlug,
    o.prompt,
  ];
}

/** Split "npx vibes-diy@latest" into [cmd, ...prefixArgs] (mirrors codegen-matrix). */
function splitCli(cliCommand: string): { cmd: string; prefix: string[] } {
  const parts = cliCommand.trim().split(/\s+/);
  return { cmd: parts[0], prefix: parts.slice(1) };
}

/** Mirrors codegen-matrix `resolveCliVersion`: scan both streams for the first semver. */
function resolveCliVersion(cliCommand: string): string {
  const { cmd, prefix } = splitCli(cliCommand);
  const r = spawnSync(cmd, [...prefix, "--version"], { encoding: "utf-8" });
  const combined = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  return combined.match(/\d+\.\d+\.\d+/)?.[0] ?? "unknown";
}

function gitCommitSha(): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" });
  return (r.stdout ?? "").trim() || "unknown";
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

/**
 * Run one `generate` to completion without blocking the event loop.
 *
 * REPLICATED from codegen-matrix `generate.ts` (the function there is private —
 * not exported — so it can't be imported; this is a verbatim copy with a comment
 * rather than editing codegen-matrix). Drains stdout and keeps a bounded stderr tail.
 */
function execGenerate(
  cmd: string,
  args: string[],
  cwd: string
): Promise<{ status: number | null; stderrTail: string }> {
  return new Promise((res) => {
    const child = spawn(cmd, args, { cwd });
    let stderrBuf = "";
    const cap = 256 * 1024; // bound memory under high concurrency
    child.stderr.on("data", (d: Buffer) => {
      stderrBuf += d.toString();
      if (stderrBuf.length > cap) stderrBuf = stderrBuf.slice(stderrBuf.length - cap);
    });
    child.stdout.on("data", () => undefined); // drain so the pipe never stalls
    child.on("error", (e) => res({ status: 1, stderrTail: `${stderrBuf}\n${String(e)}` }));
    child.on("close", (code) => res({ status: code, stderrTail: stderrBuf }));
  });
}

/** A short random suffix so app-slugs don't collide across reps in the live env. */
function shortRand(): string {
  return Math.random().toString(36).slice(2, 8);
}

export interface AccessCellJson {
  readonly promptId: string;
  readonly model: string;
  readonly expect: string;
  readonly rep: number;
  readonly appSlug: string;
  readonly ownerHandle: string;
  readonly directory: string;
  readonly latencyMs: number;
  readonly exitState: "ok" | "generate-failed";
  readonly attempts: number;
  readonly attemptLog: readonly AttemptLogEntry[];
  readonly stderrTail: string;
  readonly apiUrl: string;
  readonly runtimeHostBase: string;
  readonly cliVersion: string;
  readonly prompt: string;
  /** The two files the access grader scores (text, or "" when generation failed). */
  readonly files: { readonly "access.js": string; readonly "App.jsx": string };
}

export interface AccessRunJson {
  readonly startedAt: string;
  readonly apiUrl: string;
  readonly model: string; // the pin, recorded so a later bump is visible
  readonly cliVersion: string;
  readonly commitSha: string;
  readonly handle: string;
  readonly reps: number;
  readonly concurrency: number;
  readonly promptsFile: string;
}

function readFileSafe(dir: string, name: string): string {
  try {
    return readFileSync(join(dir, name), "utf-8");
  } catch {
    return "";
  }
}

async function runCell(args: {
  readonly matrix: AccessMatrix;
  readonly model: string;
  readonly prompt: AccessPrompt;
  readonly rep: number;
  readonly runDir: string;
  readonly cliVersion: string;
}): Promise<void> {
  const { matrix, model, prompt, rep, runDir, cliVersion } = args;
  const cellDir = join(runDir, cellDirName(prompt.id, model, rep));
  mkdirSync(cellDir, { recursive: true });
  const { cmd, prefix } = splitCli(matrix.cliCommand);

  // Each cell gets a unique app-slug so reps don't collide on a derived slug in the
  // live env. (Date.now()/Math.random are allowed here — this is normal runtime, not
  // a workflow script.)
  const appSlugBase = `eval-am-${prompt.id}-r${rep}-${shortRand()}`;

  const outcome = await runWithRetries(async (attempt): Promise<AttemptResult> => {
    const attemptDir = join(cellDir, `attempt-${attempt}`);
    mkdirSync(attemptDir, { recursive: true });
    const appSlug = `${appSlugBase}-a${attempt}`;
    const cliArgs = [
      ...prefix,
      ...buildAccessGenerateArgs({
        model,
        handle: matrix.handle,
        apiUrl: matrix.apiUrl,
        appSlug,
        prompt: prompt.prompt,
      }),
    ];
    const t0 = Date.now();
    const res = await execGenerate(cmd, cliArgs, attemptDir);
    const latencyMs = Date.now() - t0;
    const discovered = discoverAppSlug(subdirs(attemptDir));
    return {
      status: res.status,
      appSlug: discovered,
      directory: discovered ? join(attemptDir, discovered) : "",
      latencyMs,
      stderrTail: res.stderrTail.split("\n").slice(-20).join("\n"),
    };
  });

  const exitState: AccessCellJson["exitState"] = outcome.ok ? "ok" : "generate-failed";
  const files = outcome.ok
    ? { "access.js": readFileSafe(outcome.directory, "access.js"), "App.jsx": readFileSafe(outcome.directory, "App.jsx") }
    : { "access.js": "", "App.jsx": "" };

  const cell: AccessCellJson = {
    promptId: prompt.id,
    model,
    expect: prompt.expect,
    rep,
    appSlug: outcome.appSlug,
    ownerHandle: matrix.handle,
    directory: outcome.directory,
    latencyMs: outcome.latencyMs,
    exitState,
    attempts: outcome.attempts,
    attemptLog: outcome.attemptLog,
    stderrTail: outcome.stderrTail,
    apiUrl: matrix.apiUrl,
    runtimeHostBase: matrix.runtimeHostBase,
    cliVersion,
    prompt: prompt.prompt,
    files,
  };
  writeFileSync(join(cellDir, CELL_JSON), JSON.stringify(cell, null, 2), "utf-8");
  stderr.write(
    `  ${prompt.id} r${rep}: ${exitState} after ${outcome.attempts} attempt(s) ${outcome.latencyMs}ms ${outcome.appSlug || "(no app)"}\n`
  );
  for (const a of outcome.attemptLog) {
    if (!a.ok) stderr.write(`      attempt ${a.attempt} failed (${a.latencyMs}ms): ${a.reason}\n`);
  }
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const a = argv[ix];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[ix + 1];
}

function hasSwitch(flag: string): boolean {
  return argv.some((a) => a === flag);
}

/**
 * Live model cross-check (the issue's Task 2 sanity gate): run ONE
 * `vibes-diy generate --dry-run --json --model <model>` against the target env and
 * throw loudly if the dispatched model differs from the pin. Wrapped in try/catch so a
 * dry-run parse hiccup logs a warning rather than hard-failing the whole run — the
 * cross-check is a safety net, not the run's purpose.
 */
function crossCheckModel(matrix: AccessMatrix, model: string, prompt: string): void {
  const { cmd, prefix } = splitCli(matrix.cliCommand);
  try {
    const r = spawnSync(
      cmd,
      [...prefix, "generate", "--dry-run", "--json", "--model", model, "--api-url", matrix.apiUrl, prompt],
      { encoding: "utf-8" }
    );
    const combined = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    const match = combined.match(/\{[\s\S]*\}/);
    if (!match) {
      stderr.write(`model cross-check: warning — could not parse --dry-run JSON; skipping\n`);
      return;
    }
    const dispatched = JSON.parse(match[0]) as { model?: string };
    if (dispatched.model && dispatched.model !== model) {
      throw new Error(`pinned model ${model} but env dispatched ${dispatched.model}`);
    }
    stderr.write(`model cross-check: env dispatched ${dispatched.model ?? "(unknown)"} (pin=${model})\n`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("pinned model ")) throw e;
    stderr.write(`model cross-check: warning — ${(e as Error).message}; skipping\n`);
  }
}

export async function main(): Promise<void> {
  const matrix = parseAccessMatrix(readFileSync(parseFlag("--matrix") ?? DEFAULT_MATRIX, "utf-8"));
  const promptsFile = parseFlag("--prompts") ?? (hasSwitch("--holdout") ? HOLDOUT_PROMPTS : DEFAULT_PROMPTS);
  const prompts = parseAccessPrompts(readFileSync(promptsFile, "utf-8"));

  // Pin the model once. matrix.model is pinned (anthropic/claude-opus-4.8) so the live
  // fetch won't be hit; the fetchDefault stub stays as-is.
  const model =
    matrix.model && matrix.model.trim() ? matrix.model.trim() : await resolveDefaultModel(matrix, { fetchDefault });
  stderr.write(`access-model: pinned model = ${model}\n`);

  if (prompts.length > 0) crossCheckModel(matrix, model, prompts[0].prompt);

  const ts = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const runDir = parseFlag("--run") ? resolve(parseFlag("--run") as string) : join(RUNS_DIR, ts);
  mkdirSync(runDir, { recursive: true });

  const concurrency = Math.max(
    1,
    Math.floor(Number(parseFlag("--concurrency") ?? matrix.concurrency)) || 1
  );
  const cliVersion = resolveCliVersion(matrix.cliCommand);

  const run: AccessRunJson = {
    startedAt: new Date().toISOString(),
    apiUrl: matrix.apiUrl,
    model,
    cliVersion,
    commitSha: gitCommitSha(),
    handle: matrix.handle,
    reps: matrix.reps,
    concurrency,
    promptsFile,
  };
  writeFileSync(join(runDir, RUN_JSON), JSON.stringify(run, null, 2), "utf-8");

  // Build the cell list (prompts × reps), then run up to `concurrency` in parallel.
  const jobs: { prompt: AccessPrompt; rep: number }[] = [];
  for (const prompt of prompts) {
    for (let rep = 0; rep < matrix.reps; rep++) jobs.push({ prompt, rep });
  }
  stderr.write(`access-model: ${jobs.length} cells, concurrency=${concurrency} -> ${runDir}\n`);
  await mapWithConcurrency(jobs, concurrency, async (job) => {
    await runCell({ matrix, model, prompt: job.prompt, rep: job.rep, runDir, cliVersion });
  });
  stderr.write(`done. run dir: ${runDir}\n`);
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`generate failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}

// summarizeReason is re-exported for parity with codegen-matrix / downstream stages.
export { summarizeReason };
