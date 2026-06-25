// @openrouter/agent's `tool()` is typed against a Zod v4 core schema
// (`$ZodObject` with the `_zod` brand). The workspace resolves zod 4.x through
// @openrouter/agent; importing `z` from the `zod/v4` subpath gives that v4 API
// so `inputSchema` matches the SDK's overload (mirrors eval/codegen-agentic).
import { z } from "zod/v4";
import { tool } from "@openrouter/agent/tool";
import { stepCountIs, maxCost } from "@openrouter/agent/stop-conditions";
// Workers-safe import: the `/backoff` subpath is the self-contained, import-free
// module. Do NOT import from `/scoring` — that barrel re-exports judgeFeature,
// which drags node:fs/node:path/node:url/call-ai into the Workers request-path
// graph (same reason verify.ts imports `/structure`, not `/scoring`).
import { isTransientError, retryWithBackoff } from "@vibes.diy/eval-codegen-matrix/backoff";
import type { OpenRouter } from "@openrouter/agent";
import { verifyFiles } from "./verify.js";

/** Streamed line callback (wired by the live-streaming task; the type lives here so the contract is fixed). */
export type OnLine = (file: string, lang: string, line: string, lineNr: number) => void;

export interface RunArgs {
  client: OpenRouter;
  /**
   * The model id, or a turn-aware selector (e.g. frontier on the first turn,
   * a cheaper model thereafter). Passed straight through to `callModel`, which
   * accepts a dynamic `(ctx) => string` per @openrouter/agent's async-parameter API.
   */
  model: string | ((ctx: { numberOfTurns: number }) => string);
  systemPrompt: string;
  userPrompt: string;
  needsAccess: boolean;
  maxSteps: number;
  maxCostUsd: number;
  /** Max retries on transient infra errors (total attempts = retries + 1). Defaults to 2. */
  retries?: number;
  onLine?: OnLine;
}

export interface WholeFileResult {
  files: { filename: string; lang: string; content: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/** Normalize a model-supplied path to a leading-slash form (matches verifyFiles' `/App.jsx` lookups). */
function normalizeFilename(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Tag a file's language from its extension: jsx/tsx → "jsx", everything else → "js". */
function langFor(filename: string): string {
  return filename.endsWith(".jsx") || filename.endsWith(".tsx") ? "jsx" : "js";
}

/** A streamed `function_call` output item (cumulative `arguments` JSON). Mirrors @openrouter/agent's StreamableOutputItem. */
interface StreamedFunctionCall {
  type?: string;
  name?: string;
  arguments?: string;
}

/**
 * Pull `path` and `contents` out of a (possibly truncated) write_file arguments
 * JSON blob. While the tool call streams, `arguments` is a growing prefix of the
 * final JSON, so a strict `JSON.parse` usually throws mid-stream. We first try a
 * clean parse, then fall back to extracting each string field, JSON-decoding the
 * portion that has arrived so escapes (`\n`, `\"`, …) resolve correctly.
 */
function extractWriteFileArgs(raw: string): { path?: string; contents?: string } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      path: typeof parsed.path === "string" ? parsed.path : undefined,
      contents: typeof parsed.contents === "string" ? parsed.contents : undefined,
    };
  } catch {
    return { path: extractJsonStringField(raw, "path"), contents: extractJsonStringField(raw, "contents") };
  }
}

/**
 * Decode the string value of `"<field>":"<value>"` from a partial JSON blob,
 * honoring backslash escapes and stopping at the first unescaped quote (the
 * value may be unterminated mid-stream). Returns undefined if the field/opening
 * quote has not arrived yet.
 */
function extractJsonStringField(raw: string, field: string): string | undefined {
  const key = `"${field}"`;
  const keyAt = raw.indexOf(key);
  if (keyAt === -1) return undefined;
  let i = raw.indexOf('"', keyAt + key.length);
  if (i === -1) return undefined;
  i += 1; // step past the opening quote of the value
  let out = "";
  for (; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === undefined) break; // escape sequence still arriving
      out += JSON.parse(`"\\${next}"`) as string;
      i += 1;
      continue;
    }
    if (ch === '"') break; // closing quote → value complete
    out += ch;
  }
  return out;
}

/**
 * Track which lines of each file have already been emitted, so a `function_call`
 * item that is re-emitted with growing `contents` only fires `onLine` for newly
 * completed (newline-terminated) lines. The trailing partial line is withheld
 * until its newline arrives.
 */
function makeLineEmitter(onLine: OnLine) {
  const emitted: Record<string, number> = {};
  return (rawPath: string, contents: string) => {
    const filename = normalizeFilename(rawPath);
    const lang = langFor(filename);
    const nl = contents.lastIndexOf("\n");
    if (nl === -1) return; // no completed line yet
    const lines = contents.slice(0, nl).split("\n");
    const already = emitted[filename] ?? 0;
    for (let nr = already; nr < lines.length; nr++) {
      onLine(filename, lang, lines[nr], nr);
    }
    emitted[filename] = lines.length;
  };
}

async function runOnce(args: RunArgs): Promise<WholeFileResult> {
  const files: Record<string, string> = {};

  // The write_file executor: writes the complete file into the shared map, then
  // runs the Workers-safe verify gate (NOT esbuild) and hands the model feedback
  // it reacts to by re-writing the corrected whole file.
  const writeFileConfig = {
    name: "write_file",
    description: "Write a complete file (App.jsx or access.js). Returns a build + structural check; fix problems by calling again.",
    inputSchema: z.object({ path: z.string(), contents: z.string() }),
    execute: async ({ path, contents }: { path: string; contents: string }) => {
      const filename = normalizeFilename(path);
      files[filename] = contents;
      const v = verifyFiles(files, { needsAccess: args.needsAccess });
      return v.ok ? { ok: true, feedback: "Build and structural checks pass." } : { ok: false, feedback: v.problems.join("\n") };
    },
  };
  // The SDK's `tool()` is typed against a genuine zod@4 `$ZodObject`; bridge the
  // config through the tool-config parameter type (the literal above is still
  // type-checked against the typed `execute` signature). Mirrors the eval.
  const writeFile = tool(writeFileConfig as unknown as Parameters<typeof tool>[0]);

  const result = args.client.callModel({
    model: args.model,
    instructions: args.systemPrompt,
    input: args.userPrompt,
    tools: [writeFile],
    stopWhen: [stepCountIs(args.maxSteps), maxCost(args.maxCostUsd)],
  });

  // Stream completed file lines to the caller as the model writes them. The
  // items stream emits each write_file call cumulatively (same id, growing
  // arguments), so the emitter diffs against the per-file line cursor and only
  // fires onLine for newly-completed lines. Drained concurrently with getText()
  // since both share the underlying reusable stream.
  const streaming = (async () => {
    if (!args.onLine) return;
    const emitLines = makeLineEmitter(args.onLine);
    for await (const item of result.getItemsStream()) {
      const fc = item as StreamedFunctionCall;
      if (fc.type !== "function_call" || fc.name !== "write_file" || typeof fc.arguments !== "string") continue;
      const { path, contents } = extractWriteFileArgs(fc.arguments);
      if (typeof path === "string" && path.length > 0 && typeof contents === "string") {
        emitLines(path, contents);
      }
    }
  })();

  // Drive the loop to completion (tools execute as the stream is consumed).
  await result.getText();
  await streaming;
  const response = await result.getResponse();
  const u = (response as { usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null }).usage ?? {};
  const prompt_tokens = u.inputTokens ?? 0;
  const completion_tokens = u.outputTokens ?? 0;

  return {
    files: Object.entries(files).map(([filename, content]) => ({
      filename,
      lang: langFor(filename),
      content,
    })),
    usage: {
      prompt_tokens,
      completion_tokens,
      total_tokens: u.totalTokens ?? prompt_tokens + completion_tokens,
    },
  };
}

/**
 * Run the whole-file codegen tool-loop: the model writes complete files via the
 * `write_file` tool, each gated by the Workers-safe `verifyFiles` check, and we
 * collect the final file set plus token usage. Transient infra failures are
 * retried with exponential backoff (deterministic failures throw immediately).
 */
export async function runWholeFileCodegen(args: RunArgs): Promise<WholeFileResult> {
  return retryWithBackoff(() => runOnce(args), {
    retries: args.retries ?? 2,
    isRetryable: isTransientError,
  });
}
