import { argv, exit, stderr } from "node:process";
import { readFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isResError, isSectionEvent, isPromptBlockEnd } from "@vibes.diy/api-types";
import type { ResError, SectionEvent } from "@vibes.diy/api-types";
import {
  createFileSystemStream,
  isFsApplyError,
  isFsFileSnapshot,
  isFsTurnEnd,
  summarizeFailures,
  type BlockStreamMsg,
  type FsApplyErrorMsg,
} from "@vibes.diy/call-ai-v2";
import { buildApiFactory } from "./auth.js";
import {
  createArchive,
  JsonlWriter,
  writeManifest,
  writeErrors,
  writeUpstreamErrors,
  writeResolvedFiles,
  appendIndex,
  type RunManifest,
  type TurnSummary,
} from "./archive.js";

const DEFAULT_API_URL = "https://vibes.diy/api?.stable-entry.=cli";
const DEFAULT_USER_SLUG = "eval";
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ARCHIVE_ROOT = resolve(__dirname, "..", "archive");
const DEFAULT_PROMPTS_PATH = resolve(__dirname, "..", "prompts", "seed.jsonl");

interface CorpusEntry {
  id: string;
  create: string;
  edits: string[];
}

interface CliArgs {
  promptId?: string;
  userSlug: string;
  apiUrl: string;
  archiveRoot: string;
  promptsPath: string;
  maxEdits?: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {
    userSlug: DEFAULT_USER_SLUG,
    apiUrl: DEFAULT_API_URL,
    archiveRoot: DEFAULT_ARCHIVE_ROOT,
    promptsPath: DEFAULT_PROMPTS_PATH,
  };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--user-slug") args.userSlug = rest[++i];
    else if (a === "--api-url") args.apiUrl = rest[++i];
    else if (a === "--archive-root") args.archiveRoot = resolve(rest[++i]);
    else if (a === "--prompts") args.promptsPath = resolve(rest[++i]);
    else if (a === "--max-edits") args.maxEdits = Number(rest[++i]);
    else if (a === "--") continue;
    else if (!a.startsWith("--")) args.promptId = a;
    else throw new Error(`Unknown flag: ${a}`);
  }
  return args;
}

async function loadCorpus(path: string): Promise<CorpusEntry[]> {
  const raw = await readFile(path, "utf-8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CorpusEntry);
}

interface TurnResult {
  files: Readonly<Record<string, string>>;
  applyErrors: FsApplyErrorMsg[];
  upstreamErrors: ResError[];
  summarizedErrors: string[];
}

/**
 * Read SectionEvent / ResError messages from the open chat stream until the
 * turn-ending `prompt.block.end` arrives. Each message is teed to:
 *   - sectionsJsonl (every event, with turn index)
 *   - upstreamErrors[] when ResError
 *   - the per-turn TransformStream feeding `createFileSystemStream`
 *
 * Returns when the resolver finishes (after seeing prompt.block.end among the
 * flattened blocks). Subsequent turns reuse the same outer reader.
 */
async function consumeTurn(opts: {
  reader: ReadableStreamDefaultReader<unknown>;
  sectionsJsonl: JsonlWriter;
  turnIndex: number;
  streamId: string;
  seed?: ReadonlyMap<string, string>;
}): Promise<TurnResult> {
  const turnTransform = new TransformStream<BlockStreamMsg, BlockStreamMsg>();
  const turnWriter = turnTransform.writable.getWriter();
  const upstreamErrors: ResError[] = [];
  const applyErrors: FsApplyErrorMsg[] = [];
  const summarizedErrors: string[] = [];

  const fsStream = createFileSystemStream({
    streamId: opts.streamId,
    createId: () => crypto.randomUUID(),
    seed: opts.seed,
  });

  let files: Readonly<Record<string, string>> = {};
  const resolverPromise = (async () => {
    const fsReader = turnTransform.readable.pipeThrough(fsStream).getReader();
    try {
      for (;;) {
        const { value, done } = await fsReader.read();
        if (done) break;
        if (isFsFileSnapshot(value)) continue;
        if (isFsApplyError(value)) {
          applyErrors.push(value);
          for (const line of summarizeFailures(value.failures)) {
            summarizedErrors.push(`${value.path}: ${line}`);
          }
          continue;
        }
        if (isFsTurnEnd(value)) {
          files = value.files;
          continue;
        }
        if (isPromptBlockEnd(value)) break;
      }
    } finally {
      fsReader.releaseLock();
    }
  })();

  let sawTurnEnd = false;
  for (;;) {
    const { value, done } = await opts.reader.read();
    if (done) {
      sawTurnEnd = true;
      break;
    }
    opts.sectionsJsonl.write({ turn: opts.turnIndex, msg: value });
    if (isResError(value)) {
      upstreamErrors.push(value);
      continue;
    }
    if (!isSectionEvent(value)) continue;
    const event = value as SectionEvent;
    let containsTurnEnd = false;
    for (const block of event.blocks) {
      await turnWriter.write(block as BlockStreamMsg);
      if (isPromptBlockEnd(block)) containsTurnEnd = true;
    }
    if (containsTurnEnd) {
      sawTurnEnd = true;
      break;
    }
  }

  await turnWriter.close();
  await resolverPromise;

  if (!sawTurnEnd) {
    summarizedErrors.push("(stream closed before prompt.block.end)");
  }

  return { files, applyErrors, upstreamErrors, summarizedErrors };
}

async function runEntry(args: CliArgs, entry: CorpusEntry): Promise<void> {
  const archive = await createArchive(args.archiveRoot, entry.id);
  const sectionsJsonl = new JsonlWriter(archive.sectionsPath);
  const promptEventsJsonl = new JsonlWriter(archive.promptEventsPath);
  const startedAt = new Date().toISOString();
  const manifest: RunManifest = {
    promptId: entry.id,
    userSlug: args.userSlug,
    appSlug: "(pending)",
    apiUrl: args.apiUrl,
    startedAt,
    exitState: "in-progress",
    turns: [],
  };
  await writeManifest(archive, manifest);

  const writeFinal = async (state: RunManifest["exitState"], detail?: string) => {
    manifest.finishedAt = new Date().toISOString();
    manifest.exitState = state;
    if (detail) manifest.exitDetail = detail;
    await writeManifest(archive, manifest);
    await sectionsJsonl.close();
    await promptEventsJsonl.close();
    await appendIndex(
      args.archiveRoot,
      JSON.stringify({
        promptId: entry.id,
        archive: archive.root,
        startedAt,
        finishedAt: manifest.finishedAt,
        exitState: state,
        turns: manifest.turns.length,
        applyErrors: manifest.turns.reduce((a, t) => a + t.applyErrorCount, 0),
        upstreamErrors: manifest.turns.reduce((a, t) => a + t.upstreamErrorCount, 0),
      })
    );
  };

  let auth;
  try {
    auth = await buildApiFactory();
  } catch (e) {
    await writeFinal("auth-failure", String(e));
    throw e;
  }

  const api = auth.factory(args.apiUrl);
  const rChat = await api.openChat({
    userSlug: args.userSlug,
    prompt: entry.create,
    mode: "chat",
  });
  if (rChat.isErr()) {
    await writeFinal("open-chat-failure", String(rChat.Err()));
    return;
  }
  const chat = rChat.Ok();
  manifest.appSlug = chat.appSlug;
  manifest.userSlug = chat.userSlug;

  const reader = chat.sectionStream.getReader();
  const allApplyErrors: FsApplyErrorMsg[] = [];
  const allUpstreamErrors: ResError[] = [];

  try {
    const turns: { idx: number; prompt: string }[] = [
      { idx: 0, prompt: entry.create },
      ...entry.edits.slice(0, args.maxEdits ?? entry.edits.length).map((p, i) => ({ idx: i + 1, prompt: p })),
    ];

    let cumulativeFiles: Map<string, string> | undefined;

    for (const turn of turns) {
      const turnStartedAt = new Date().toISOString();
      stderr.write(`  turn ${turn.idx}: ${turn.prompt.slice(0, 60)}…\n`);

      // Turn 0 was already opened with the create prompt above (server pre-allocated
      // title+slug). We still need to send the prompt explicitly to start the stream.
      const rPrompt = await chat.prompt({
        messages: [{ role: "user", content: [{ type: "text", text: turn.prompt }] }],
      });
      if (rPrompt.isErr()) {
        await writeFinal("prompt-failure", `turn ${turn.idx}: ${JSON.stringify(rPrompt.Err())}`);
        return;
      }
      const promptId = rPrompt.Ok().promptId;
      promptEventsJsonl.write({ turn: turn.idx, promptId, startedAt: turnStartedAt });

      const result = await consumeTurn({
        reader,
        sectionsJsonl,
        turnIndex: turn.idx,
        streamId: promptId,
        seed: cumulativeFiles,
      });

      cumulativeFiles = new Map(Object.entries(result.files));
      allApplyErrors.push(...result.applyErrors);
      allUpstreamErrors.push(...result.upstreamErrors);

      manifest.turns.push({
        index: turn.idx,
        prompt: turn.prompt,
        promptId,
        startedAt: turnStartedAt,
        finishedAt: new Date().toISOString(),
        upstreamErrorCount: result.upstreamErrors.length,
        applyErrorCount: result.applyErrors.length,
        resolvedFileCount: Object.keys(result.files).length,
      } satisfies TurnSummary);
      await writeManifest(archive, manifest);

      if (turn.idx === turns.length - 1) {
        await writeResolvedFiles(archive, result.files);
      }
    }

    await writeErrors(archive, allApplyErrors);
    await writeUpstreamErrors(archive, allUpstreamErrors);
    reader.releaseLock();
    await chat.close();
    await writeFinal("ok");
  } catch (e) {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
    try {
      await chat.close();
    } catch {
      /* noop */
    }
    await writeErrors(archive, allApplyErrors);
    await writeUpstreamErrors(archive, allUpstreamErrors);
    await writeFinal("stream-error", e instanceof Error ? (e.stack ?? e.message) : String(e));
    throw e;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  const corpus = await loadCorpus(args.promptsPath);
  const entry = args.promptId ? corpus.find((e) => e.id === args.promptId) : corpus[0];
  if (!entry) {
    stderr.write(`Prompt id not found: ${args.promptId}\n`);
    stderr.write(`Available: ${corpus.map((e) => e.id).join(", ")}\n`);
    exit(2);
  }
  stderr.write(`Running ${entry.id} (${entry.edits.length + 1} turns)\n`);
  await runEntry(args, entry);
  stderr.write(`Done.\n`);
}

main().catch((e) => {
  stderr.write(`Fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  exit(1);
});
