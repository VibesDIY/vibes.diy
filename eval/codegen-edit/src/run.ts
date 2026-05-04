import { argv, exit, stderr } from "node:process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
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

  const finalize = async (state: RunManifest["exitState"], detail?: string) => {
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
        applyErrors: manifest.turns[0]?.applyErrorCount ?? 0,
        upstreamErrors: manifest.turns[0]?.upstreamErrorCount ?? 0,
        resolvedFiles: manifest.turns[0]?.resolvedFileCount ?? 0,
      })
    );
  };

  let auth;
  try {
    auth = await buildApiFactory();
  } catch (e) {
    await finalize("auth-failure", String(e));
    throw e;
  }

  const api = auth.factory(args.apiUrl);
  const rChat = await api.openChat({
    userSlug: args.userSlug,
    prompt: entry.create,
    mode: "chat",
  });
  if (rChat.isErr()) {
    await finalize("open-chat-failure", String(rChat.Err()));
    return;
  }
  const chat = rChat.Ok();
  manifest.appSlug = chat.appSlug;
  manifest.userSlug = chat.userSlug;
  await writeManifest(archive, manifest);
  stderr.write(`  appSlug: ${chat.appSlug}\n`);

  const rPrompt = await chat.prompt({
    messages: [{ role: "user", content: [{ type: "text", text: entry.create }] }],
  });
  if (rPrompt.isErr()) {
    await chat.close();
    await finalize("prompt-failure", JSON.stringify(rPrompt.Err()));
    return;
  }
  const promptId = rPrompt.Ok().promptId;
  promptEventsJsonl.write({ turn: 0, promptId, startedAt });

  // Drain the chat stream for one turn. Tee every event into sections.jsonl,
  // forward SectionEvent blocks into createFileSystemStream, capture
  // upstream ResErrors. Stop once prompt.block.end arrives.
  const turnTransform = new TransformStream<BlockStreamMsg, BlockStreamMsg>();
  const turnWriter = turnTransform.writable.getWriter();
  const fsStream = createFileSystemStream({
    streamId: promptId,
    createId: () => crypto.randomUUID(),
  });

  const upstreamErrors: ResError[] = [];
  const applyErrors: FsApplyErrorMsg[] = [];
  let resolvedFiles: Readonly<Record<string, string>> = {};

  const resolverPromise = (async () => {
    const fsReader = turnTransform.readable.pipeThrough(fsStream).getReader();
    try {
      for (;;) {
        const { value, done } = await fsReader.read();
        if (done) break;
        if (isFsFileSnapshot(value)) continue;
        if (isFsApplyError(value)) {
          applyErrors.push(value);
          continue;
        }
        if (isFsTurnEnd(value)) {
          resolvedFiles = value.files;
          continue;
        }
      }
    } finally {
      fsReader.releaseLock();
    }
  })();

  const reader = chat.sectionStream.getReader();
  let sawTurnEnd = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      sectionsJsonl.write({ turn: 0, msg: value });
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
  } catch (e) {
    await turnWriter.close().catch(() => {});
    reader.releaseLock();
    await chat.close();
    await writeErrors(archive, applyErrors);
    await writeUpstreamErrors(archive, upstreamErrors);
    await finalize("stream-error", e instanceof Error ? (e.stack ?? e.message) : String(e));
    throw e;
  }

  await turnWriter.close();
  await resolverPromise;
  reader.releaseLock();
  await chat.close();

  manifest.turns.push({
    index: 0,
    prompt: entry.create,
    promptId,
    startedAt,
    finishedAt: new Date().toISOString(),
    upstreamErrorCount: upstreamErrors.length,
    applyErrorCount: applyErrors.length,
    resolvedFileCount: Object.keys(resolvedFiles).length,
  });
  if (!sawTurnEnd) {
    manifest.exitDetail = "stream closed before prompt.block.end";
  }

  await writeResolvedFiles(archive, resolvedFiles);
  await writeErrors(archive, applyErrors);
  await writeUpstreamErrors(archive, upstreamErrors);
  await finalize(sawTurnEnd ? "ok" : "stream-error", manifest.exitDetail);

  stderr.write(
    `  resolved=${Object.keys(resolvedFiles).length} applyErrors=${applyErrors.length} upstreamErrors=${upstreamErrors.length}\n`
  );
  if (applyErrors.length > 0) {
    for (const err of applyErrors) {
      for (const line of summarizeFailures(err.failures)) {
        stderr.write(`    [apply] ${err.path}: ${line}\n`);
      }
    }
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
  stderr.write(`Running ${entry.id} (single create turn)\n`);
  await runEntry(args, entry);
  stderr.write(`Done.\n`);
}

main().catch((e) => {
  stderr.write(`Fatal: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  exit(1);
});
