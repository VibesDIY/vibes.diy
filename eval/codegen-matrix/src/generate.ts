import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, stderr } from "node:process";
import { parseMatrixConfig, parsePromptsJsonl, type MatrixConfig, type ModelEntry, type PromptEntry } from "./config.js";
import { cellDirName, discoverAppSlug, writeCellJson, type CellJson, type RunJson, RUN_JSON } from "./cell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DEFAULT_MATRIX = resolve(ROOT, "config/matrix.json");
const DEFAULT_PROMPTS = resolve(ROOT, "config/prompts.jsonl");
const RUNS_DIR = resolve(ROOT, "runs");

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt, "utf-8").digest("hex");
}

export function buildGenerateArgs(o: {
  readonly model: string;
  readonly handle: string;
  readonly apiUrl: string;
  readonly prompt: string;
}): string[] {
  return ["generate", "--model", o.model, "--handle", o.handle, "--api-url", o.apiUrl, o.prompt];
}

/** Split "npx vibes-diy@latest" into [cmd, ...prefixArgs]. */
function splitCli(cliCommand: string): { cmd: string; prefix: string[] } {
  const parts = cliCommand.trim().split(/\s+/);
  return { cmd: parts[0], prefix: parts.slice(1) };
}

function resolveCliVersion(cliCommand: string): string {
  const { cmd, prefix } = splitCli(cliCommand);
  const r = spawnSync(cmd, [...prefix, "--version"], { encoding: "utf-8" });
  // The CLI prints its version to stderr (and npx adds its own warn lines), so
  // scan both streams for the first semver rather than trusting stdout.
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

function runCell(args: {
  readonly cfg: MatrixConfig;
  readonly model: ModelEntry;
  readonly prompt: PromptEntry;
  readonly rep: number;
  readonly runDir: string;
  readonly cliVersion: string;
}): void {
  const { cfg, model, prompt, rep, runDir, cliVersion } = args;
  const cellDir = join(runDir, cellDirName(prompt.id, model.id, rep));
  mkdirSync(cellDir, { recursive: true });
  const { cmd, prefix } = splitCli(cfg.cliCommand);
  const cliArgs = [
    ...prefix,
    ...buildGenerateArgs({ model: model.id, handle: cfg.handle, apiUrl: cfg.apiUrl, prompt: prompt.prompt }),
  ];

  const t0 = Date.now();
  const res = spawnSync(cmd, cliArgs, { cwd: cellDir, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  const latencyMs = Date.now() - t0;

  const created = subdirs(cellDir);
  const appSlug = discoverAppSlug(created);
  const stderrTail = (res.stderr ?? "").split("\n").slice(-20).join("\n");
  const exitState: CellJson["exitState"] = res.status === 0 && appSlug !== undefined ? "ok" : "generate-failed";

  const cell: CellJson = {
    promptId: prompt.id,
    model: model.id,
    class: model.class,
    tier: model.tier,
    rep,
    appSlug: appSlug ?? "",
    ownerHandle: cfg.handle,
    directory: appSlug ? join(cellDir, appSlug) : "",
    latencyMs,
    exitState,
    stderrTail,
    apiUrl: cfg.apiUrl,
    runtimeHostBase: cfg.runtimeHostBase,
    cliVersion,
    promptHash: promptHash(prompt.prompt),
  };
  writeCellJson(cellDir, cell);
  stderr.write(`  ${prompt.id} ${model.id} r${rep}: ${exitState} ${latencyMs}ms ${appSlug ?? "(no app)"}\n`);
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const a = argv[ix];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[ix + 1];
}

export async function main(): Promise<void> {
  const cfg = parseMatrixConfig(readFileSync(parseFlag("--matrix") ?? DEFAULT_MATRIX, "utf-8"));
  const prompts = parsePromptsJsonl(readFileSync(parseFlag("--prompts") ?? DEFAULT_PROMPTS, "utf-8"));
  const ts = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const runDir = join(RUNS_DIR, ts);
  mkdirSync(runDir, { recursive: true });

  const cliVersion = resolveCliVersion(cfg.cliCommand);
  const run: RunJson = {
    startedAt: new Date().toISOString(),
    apiUrl: cfg.apiUrl,
    cliCommand: cfg.cliCommand,
    cliVersion,
    commitSha: gitCommitSha(),
    judgeModel: cfg.judgeModel,
    reps: cfg.reps,
    promptsHash: promptHash(prompts.map((p) => `${p.id}:${p.prompt}`).join("\n")),
  };
  writeFileSync(join(runDir, RUN_JSON), JSON.stringify(run, null, 2), "utf-8");

  const total = cfg.models.length * prompts.length * cfg.reps;
  stderr.write(`codegen-matrix: ${total} cells -> ${runDir}\n`);
  // Sequential: parallelizing risks rate-limit noise in results.
  for (const model of cfg.models) {
    for (const prompt of prompts) {
      for (let rep = 0; rep < cfg.reps; rep++) {
        runCell({ cfg, model, prompt, rep, runDir, cliVersion });
      }
    }
  }
  stderr.write(`done. run dir: ${runDir}\n`);
}

// Only run when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    stderr.write(`generate failed: ${(e as Error).stack ?? (e as Error).message}\n`);
    process.exit(1);
  });
}
