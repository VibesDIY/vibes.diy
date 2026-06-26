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
import { exception2Result } from "@adviser/cement";
import type { OpenRouter } from "@openrouter/agent";
import { verifyFiles, type VerifyResult } from "./verify.js";

/** One newly-completed streamed line (the `OnLine` payload). */
export interface OnLineArgs {
  file: string;
  lang: string;
  line: string;
  lineNr: number;
}
/** Streamed line callback (wired by the live-streaming task; the type lives here so the contract is fixed). */
export type OnLine = (args: OnLineArgs) => void;

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

/**
 * Streaming-delivery measurement (diagnostic). All @openrouter/agent stream
 * accessors share one broadcaster over a single `reusableStream`, so this
 * reflects whether write_file argument deltas arrive incrementally under the
 * host runtime: `firstDeltaMs` ≈ a few seconds means the SSE body streams;
 * `firstDeltaMs` ≈ total generation time (with `lastDeltaMs` ≈ the same) means
 * the response buffered before any delta was delivered (the workerd symptom).
 */
export interface StreamDiag {
  firstDeltaMs: number;
  lastDeltaMs: number;
  deltaCount: number;
}

export interface WholeFileResult {
  files: { filename: string; lang: string; content: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  /** Final structural verify of the resolved file set; the caller refuses to persist when `ok` is false. */
  verify?: VerifyResult;
  streamDiag?: StreamDiag;
}

/** Normalize a model-supplied path to a leading-slash form (matches verifyFiles' `/App.jsx` lookups). */
function normalizeFilename(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/** Tag a file's language from its extension: jsx/tsx → "jsx", everything else → "js". */
function langFor(filename: string): string {
  return filename.endsWith(".jsx") || filename.endsWith(".tsx") ? "jsx" : "js";
}

/**
 * Pull `path` and `contents` out of a (possibly truncated) write_file arguments
 * JSON blob. While the tool call streams, `arguments` is a growing prefix of the
 * final JSON, so a strict `JSON.parse` usually throws mid-stream. We first try a
 * clean parse, then fall back to extracting each string field, JSON-decoding the
 * portion that has arrived so escapes (`\n`, `\"`, …) resolve correctly.
 */
function extractWriteFileArgs(raw: string): { path?: string; contents?: string } {
  const rParsed = exception2Result(() => JSON.parse(raw) as Record<string, unknown>);
  if (rParsed.isOk()) {
    const parsed = rParsed.Ok();
    return {
      path: typeof parsed.path === "string" ? parsed.path : undefined,
      contents: typeof parsed.contents === "string" ? parsed.contents : undefined,
    };
  }
  // Mid-stream the blob is a growing prefix of the final JSON, so the parse
  // throws; fall back to extracting each string field from the partial text.
  return { path: extractJsonStringField(raw, "path"), contents: extractJsonStringField(raw, "contents") };
}

/**
 * Decode the string value of `"<field>":"<value>"` from a partial JSON blob,
 * honoring backslash escapes (including `\uXXXX` unicode escapes) and stopping
 * at the first unescaped quote (the value may be unterminated mid-stream).
 * Returns undefined if the field/opening quote has not arrived yet.
 */
export function extractJsonStringField(raw: string, field: string): string | undefined {
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
      if (next === "u") {
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex) === false) break; // partial mid-stream escape — wait for more bytes
        out += String.fromCharCode(parseInt(hex, 16));
        i += 5;
        continue;
      }
      const simple: Record<string, string> = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" };
      out += simple[next] ?? next;
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
 * until its newline arrives; call `flush` once the stream ends to emit it.
 */
export function makeLineEmitter(onLine: OnLine) {
  const emitted: Record<string, number> = {};
  const pump = (rawPath: string, contents: string, includeLast: boolean) => {
    const filename = normalizeFilename(rawPath);
    const lang = langFor(filename);
    const nl = contents.lastIndexOf("\n");
    // When flushing, emit up to (and including) the partial trailing content.
    // If the content ends with `\n`, the trailing "line" is empty — skip it.
    // When not flushing, only emit up to the last newline (partial last line is withheld).
    let slice: string | undefined;
    if (includeLast === true) {
      // Only include the trailing segment if there's actual content past the last newline.
      if (nl === -1) {
        slice = contents; // no newline at all — the entire content is a partial line
      } else if (nl < contents.length - 1) {
        slice = contents; // there is trailing content after the last newline
      } else {
        slice = contents.slice(0, nl); // trailing newline — nothing new to flush
      }
    } else {
      slice = nl === -1 ? undefined : contents.slice(0, nl);
    }
    if (slice === undefined) return;
    const lines = slice.split("\n");
    const already = emitted[filename] ?? 0;
    for (let nr = already; nr < lines.length; nr++) {
      onLine({ file: filename, lang, line: lines[nr], lineNr: nr });
    }
    emitted[filename] = lines.length;
  };
  const emit = (rawPath: string, contents: string) => pump(rawPath, contents, false);
  emit.flush = (rawPath: string, contents: string) => pump(rawPath, contents, true);
  return emit;
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

  // Stream completed file lines to the caller as the model writes them, via the
  // SDK's documented full-response stream. We accumulate `write_file` argument
  // deltas (`response.function_call_arguments.delta`) into a per-call cumulative
  // JSON blob, resetting on each new output item, and diff completed lines
  // through `makeLineEmitter`. `streamDiag` records the delivery timing so the
  // caller can tell whether the SSE body actually streamed under the host
  // runtime or buffered to the end. Drained concurrently with getText(); both
  // share the one broadcaster over the reusable stream.
  const streamDiag: StreamDiag = { firstDeltaMs: -1, lastDeltaMs: -1, deltaCount: 0 };
  const startMs = Date.now();
  const streaming = (async () => {
    const emitLines = args.onLine !== undefined ? makeLineEmitter(args.onLine) : undefined;
    let argsAccum = "";
    let lastPath: string | undefined;
    let lastContents: string | undefined;
    for await (const event of result.getFullResponsesStream()) {
      const type = (event as { type?: string }).type;
      if (type === "response.output_item.added") {
        // A new output item begins — flush the trailing line of the previous tool
        // call before resetting the accumulator, so the last partial line is not lost.
        if (emitLines !== undefined && typeof lastPath === "string" && typeof lastContents === "string") {
          emitLines.flush(lastPath, lastContents);
        }
        argsAccum = "";
        lastPath = undefined;
        lastContents = undefined;
        continue;
      }
      if (type !== "response.function_call_arguments.delta") continue;
      streamDiag.deltaCount++;
      const elapsed = Date.now() - startMs;
      if (streamDiag.firstDeltaMs < 0) streamDiag.firstDeltaMs = elapsed;
      streamDiag.lastDeltaMs = elapsed;
      if (emitLines === undefined) continue;
      argsAccum += (event as { delta?: string }).delta ?? "";
      const { path, contents } = extractWriteFileArgs(argsAccum);
      if (typeof path === "string" && path.length > 0 && typeof contents === "string") {
        emitLines(path, contents);
        lastPath = path;
        lastContents = contents;
      }
    }
    // Flush the trailing partial line of the last tool call (if any).
    if (emitLines !== undefined && typeof lastPath === "string" && typeof lastContents === "string") {
      emitLines.flush(lastPath, lastContents);
    }
  })();

  // Drive the loop to completion (tools execute as the stream is consumed).
  await result.getText();
  await streaming;

  // Terminal verify re-check. The write_file executor stores `contents` even on
  // a failing verify, so a stop-limit exit (maxSteps/maxCost reached mid-fix) can
  // leave the model's last, still-broken write in `files`. Return the final
  // verify so the caller refuses to persist a file set the gate already rejected
  // (e.g. an App.jsx with no default export) instead of shipping it blindly.
  const verify = verifyFiles(files, { needsAccess: args.needsAccess });

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
    verify,
    streamDiag,
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
