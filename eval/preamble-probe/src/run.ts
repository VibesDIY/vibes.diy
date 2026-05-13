/**
 * Fast-loop probe for the pre-allocation prompt.
 *
 * Bypasses the worker — calls OpenRouter directly with the same `callAi`
 * production uses. ~3-8s per call vs ~60-90s for the full codegen-edit eval,
 * so iterating on user-message and schema variants is cheap.
 *
 * Reads the LLM endpoint + API key from
 * `vibes.diy/pkg/.dev.vars` (same file the dev server uses).
 *
 * Usage:
 *   tsx src/run.ts --variant v0-baseline,v1-platform-brief,v2-exemplar \
 *                  --prompts prompts/seed.jsonl \
 *                  --out runs/<timestamp>.jsonl
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { argv, exit, stderr, stdout } from "node:process";
import { callAi, type CallAIOptions } from "call-ai";
import { preAllocParsed, preAllocSchema, type PreAllocParsed } from "@vibes.diy/prompts";
import { type } from "arktype";
import { allVariants, findVariant, type ProbeVariant } from "../variants/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROBE_ROOT = resolve(__dirname, "..");
const DEFAULT_PROMPTS = resolve(PROBE_ROOT, "prompts/seed.jsonl");
const DEFAULT_OUT_DIR = resolve(PROBE_ROOT, "runs");
const DEV_VARS = resolve(PROBE_ROOT, "../../vibes.diy/pkg/.dev.vars");
// Match production's pre-alloc model selection (preSelected: ["app"] in
// vibes.diy/api/svc/models.json). Override with --model if needed.
const DEFAULT_MODEL = "anthropic/claude-opus-4.6-fast";
const PRE_ALLOC_TIMEOUT_MS = 30_000;

interface CorpusEntry {
  readonly id: string;
  readonly prompt: string;
}

interface ProbeRunRow {
  readonly variantId: string;
  readonly promptId: string;
  readonly userPrompt: string;
  readonly model: string;
  readonly startedAt: string;
  readonly latencyMs: number;
  readonly raw: string;
  readonly parsed?: PreAllocParsed;
  readonly parseErr?: string;
  readonly enrichedPromptPresent: boolean;
  readonly enrichedPromptLen: number;
}

function readDevVars(): { llmUrl: string; llmKey: string } {
  const text = readFileSync(DEV_VARS, "utf-8");
  const url = text.match(/^LLM_BACKEND_URL=(.+)$/m)?.[1]?.trim();
  const key = text.match(/^LLM_BACKEND_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!url || !key) {
    throw new Error(`LLM_BACKEND_URL / LLM_BACKEND_API_KEY missing in ${DEV_VARS}`);
  }
  // call-ai's streaming-path uses `options.endpoint` as the FULL URL (the path
  // that ships pre-alloc — Claude forces streaming). Pass through as-is.
  return { llmUrl: url, llmKey: key };
}

function loadCorpus(path: string, ids?: readonly string[]): CorpusEntry[] {
  const entries = readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CorpusEntry);
  if (!ids || ids.length === 0) return entries;
  const set = new Set(ids);
  return entries.filter((e) => set.has(e.id));
}

function parseFlag(flag: string): string | undefined {
  const ix = argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (ix < 0) return undefined;
  const arg = argv[ix];
  if (arg.includes("=")) return arg.slice(arg.indexOf("=") + 1);
  return argv[ix + 1];
}

async function probeOnce(args: {
  readonly variant: ProbeVariant;
  readonly entry: CorpusEntry;
  readonly llmUrl: string;
  readonly llmKey: string;
  readonly model: string;
}): Promise<ProbeRunRow> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const userMessage = await args.variant.buildUserMessage(args.entry.prompt);
  const schema = args.variant.schemaOverride ?? preAllocSchema;
  // Match production's call shape (see vibes.diy/api/svc/intern/pre-allocate.ts).
  // `as const` makes `required` readonly — copy to a mutable string[] for call-ai's Schema type.
  const callOpts: CallAIOptions = {
    model: args.model,
    endpoint: args.llmUrl,
    apiKey: args.llmKey,
    schema: { ...schema, required: [...schema.required] },
    debug: process.env.PROBE_DEBUG === "1",
  };

  let raw = "";
  let parsed: PreAllocParsed | undefined;
  let parseErr: string | undefined;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`probe timed out after ${PRE_ALLOC_TIMEOUT_MS}ms`)), PRE_ALLOC_TIMEOUT_MS)
    );
    const result = await Promise.race([callAi(userMessage, callOpts), timeout]);
    raw = typeof result === "string" ? result : JSON.stringify(result);
    try {
      const json = JSON.parse(raw) as unknown;
      const v = preAllocParsed(json);
      if (v instanceof type.errors) {
        parseErr = `arktype: ${v.summary}`;
      } else {
        parsed = v;
      }
    } catch (e) {
      parseErr = `JSON.parse: ${(e as Error).message}`;
    }
  } catch (e) {
    parseErr = `call: ${(e as Error).message}`;
  }
  const latencyMs = Date.now() - t0;
  const enriched = parsed?.enrichedPrompt ?? "";
  return {
    variantId: args.variant.id,
    promptId: args.entry.id,
    userPrompt: args.entry.prompt,
    model: args.model,
    startedAt,
    latencyMs,
    raw,
    parsed,
    parseErr,
    enrichedPromptPresent: enriched.trim().length > 0,
    enrichedPromptLen: enriched.length,
  };
}

async function main(): Promise<void> {
  const variantArg = parseFlag("--variant") ?? allVariants.map((v) => v.id).join(",");
  const promptIdsArg = parseFlag("--prompts-ids");
  const promptsPath = parseFlag("--prompts") ?? DEFAULT_PROMPTS;
  const model = parseFlag("--model") ?? DEFAULT_MODEL;
  const outArg = parseFlag("--out");
  const concurrencyArg = Number.parseInt(parseFlag("--concurrency") ?? "3", 10);
  const concurrency = Number.isFinite(concurrencyArg) && concurrencyArg > 0 ? concurrencyArg : 3;

  const variantIds = variantArg
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const variants = variantIds.map((id) => {
    const v = findVariant(id);
    if (!v) throw new Error(`unknown variant ${id}; known: ${allVariants.map((x) => x.id).join(",")}`);
    return v;
  });
  const promptIds = promptIdsArg
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const corpus = loadCorpus(promptsPath, promptIds);
  if (corpus.length === 0) {
    stderr.write(`no prompts matched in ${promptsPath}\n`);
    exit(2);
  }

  const { llmUrl, llmKey } = readDevVars();
  const ts = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const outPath = outArg ?? resolve(DEFAULT_OUT_DIR, `${ts}.jsonl`);
  mkdirSync(dirname(outPath), { recursive: true });

  const total = variants.length * corpus.length;
  stderr.write(
    `probe: ${variants.length} variant(s) × ${corpus.length} prompt(s) = ${total} call(s), concurrency=${concurrency}\n`
  );
  stderr.write(`model: ${model}\n`);
  stderr.write(`endpoint: ${llmUrl}\n`);
  stderr.write(`out: ${outPath}\n\n`);

  const jobs: { variant: ProbeVariant; entry: CorpusEntry }[] = [];
  for (const v of variants) for (const e of corpus) jobs.push({ variant: v, entry: e });

  const rows: ProbeRunRow[] = new Array(jobs.length);
  let next = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (true) {
      const ix = next++;
      if (ix >= jobs.length) return;
      const { variant, entry } = jobs[ix];
      const row = await probeOnce({ variant, entry, llmUrl, llmKey, model });
      rows[ix] = row;
      done += 1;
      const status = row.parseErr
        ? `ERR ${row.parseErr.slice(0, 60)}`
        : row.enrichedPromptPresent
          ? `enr=${row.enrichedPromptLen}`
          : "enr=MISSING";
      stderr.write(`[${done}/${total}] ${variant.id} ${entry.id} ${row.latencyMs}ms ${status}\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));

  writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");

  // Summary table
  stdout.write("\n=== summary ===\n");
  for (const v of variants) {
    const own = rows.filter((r) => r.variantId === v.id);
    const ok = own.filter((r) => r.enrichedPromptPresent).length;
    const avgLen = own.filter((r) => r.enrichedPromptPresent).reduce((s, r) => s + r.enrichedPromptLen, 0) / Math.max(ok, 1);
    const avgLat = own.reduce((s, r) => s + r.latencyMs, 0) / own.length;
    stdout.write(
      `${v.id.padEnd(22)} enriched=${ok}/${own.length}  avg_enriched_len=${avgLen.toFixed(0)}  avg_latency=${avgLat.toFixed(0)}ms\n`
    );
  }
  stdout.write(`\nfull results: ${outPath}\n`);
}

main().catch((e) => {
  stderr.write(`probe failed: ${(e as Error).stack ?? (e as Error).message}\n`);
  exit(1);
});
