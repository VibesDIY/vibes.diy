import { argv, exit, stderr } from "node:process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exception2Result } from "@adviser/cement";
import { command, option, optional, positional, run, string } from "cmd-ts";
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
  type ArchiveDirs,
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

interface RunArgs {
  promptId: string | undefined;
  userSlug: string;
  apiUrl: string;
  archiveRoot: string;
  promptsPath: string;
}

async function loadCorpus(path: string): Promise<CorpusEntry[]> {
  const raw = await readFile(path, "utf-8");
  return raw
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CorpusEntry);
}

interface FinalizeOpts {
  readonly archive: ArchiveDirs;
  readonly archiveRoot: string;
  readonly manifest: RunManifest;
  readonly sectionsJsonl: JsonlWriter;
  readonly promptEventsJsonl: JsonlWriter;
  readonly promptId: string;
  readonly startedAt: string;
}

async function finalizeRun(opts: FinalizeOpts, state: RunManifest["exitState"], detail?: string): Promise<void> {
  opts.manifest.finishedAt = new Date().toISOString();
  opts.manifest.exitState = state;
  if (detail !== undefined) opts.manifest.exitDetail = detail;
  await writeManifest(opts.archive, opts.manifest);
  await opts.sectionsJsonl.close();
  await opts.promptEventsJsonl.close();
  await appendIndex(
    opts.archiveRoot,
    JSON.stringify({
      promptId: opts.promptId,
      archive: opts.archive.root,
      startedAt: opts.startedAt,
      finishedAt: opts.manifest.finishedAt,
      exitState: state,
      applyErrors: opts.manifest.turns[0]?.applyErrorCount ?? 0,
      upstreamErrors: opts.manifest.turns[0]?.upstreamErrorCount ?? 0,
      resolvedFiles: opts.manifest.turns[0]?.resolvedFileCount ?? 0,
    })
  );
}

async function runEntry(args: RunArgs, entry: CorpusEntry): Promise<void> {
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
  const fin: FinalizeOpts = {
    archive,
    archiveRoot: args.archiveRoot,
    manifest,
    sectionsJsonl,
    promptEventsJsonl,
    promptId: entry.id,
    startedAt,
  };

  const rAuth = await buildApiFactory();
  if (rAuth.isErr()) {
    await finalizeRun(fin, "auth-failure", String(rAuth.Err()));
    exit(1);
  }
  const auth = rAuth.Ok();

  const api = auth.factory(args.apiUrl);
  const rChat = await api.openChat({
    userSlug: args.userSlug,
    prompt: entry.create,
    mode: "chat",
  });
  if (rChat.isErr()) {
    await api.close().catch(() => undefined);
    await finalizeRun(fin, "open-chat-failure", String(rChat.Err()));
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
    await api.close().catch(() => undefined);
    await finalizeRun(fin, "prompt-failure", JSON.stringify(rPrompt.Err()));
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
  const rRead = await exception2Result<{ sawTurnEnd: boolean }>(async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return { sawTurnEnd: false };
      sectionsJsonl.write({ turn: 0, msg: value });
      if (isResError(value)) {
        upstreamErrors.push(value);
        continue;
      }
      if (isSectionEvent(value) === false) continue;
      const event = value as SectionEvent;
      let containsTurnEnd = false;
      for (const block of event.blocks) {
        await turnWriter.write(block as BlockStreamMsg);
        if (isPromptBlockEnd(block)) containsTurnEnd = true;
      }
      if (containsTurnEnd === true) return { sawTurnEnd: true };
    }
  });

  if (rRead.isErr()) {
    await turnWriter.close().catch(() => undefined);
    reader.releaseLock();
    await chat.close();
    await api.close().catch(() => undefined);
    await writeErrors(archive, applyErrors);
    await writeUpstreamErrors(archive, upstreamErrors);
    const err = rRead.Err();
    await finalizeRun(fin, "stream-error", err.stack ?? err.message);
    exit(1);
  }
  const { sawTurnEnd } = rRead.Ok();

  await turnWriter.close();
  await resolverPromise;
  reader.releaseLock();
  await chat.close();
  await api.close().catch(() => undefined);

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
  if (sawTurnEnd === false) {
    manifest.exitDetail = "stream closed before prompt.block.end";
  }

  await writeResolvedFiles(archive, resolvedFiles);
  await writeErrors(archive, applyErrors);
  await writeUpstreamErrors(archive, upstreamErrors);
  await finalizeRun(fin, sawTurnEnd === true ? "ok" : "stream-error", manifest.exitDetail);

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

const cmd = command({
  name: "codegen-edit-run",
  description: "Drive a single CLI generation flow against the eval corpus and archive the section stream.",
  version: "0.0.0",
  args: {
    promptId: positional({
      type: optional(string),
      displayName: "promptId",
      description: "Corpus entry id (defaults to first entry)",
    }),
    userSlug: option({
      long: "user-slug",
      type: string,
      defaultValue: () => DEFAULT_USER_SLUG,
      defaultValueIsSerializable: true,
    }),
    apiUrl: option({
      long: "api-url",
      type: string,
      defaultValue: () => DEFAULT_API_URL,
      defaultValueIsSerializable: true,
    }),
    archiveRoot: option({
      long: "archive-root",
      type: string,
      defaultValue: () => DEFAULT_ARCHIVE_ROOT,
      defaultValueIsSerializable: true,
    }),
    promptsPath: option({
      long: "prompts",
      type: string,
      defaultValue: () => DEFAULT_PROMPTS_PATH,
      defaultValueIsSerializable: true,
    }),
  },
  handler: async (args) => {
    const corpus = await loadCorpus(args.promptsPath);
    const entry = args.promptId === undefined ? corpus[0] : corpus.find((e) => e.id === args.promptId);
    if (entry === undefined) {
      stderr.write(`Prompt id not found: ${args.promptId ?? "(first entry)"}\n`);
      stderr.write(`Available: ${corpus.map((e) => e.id).join(", ")}\n`);
      exit(2);
    }
    stderr.write(`Running ${entry.id} (single create turn)\n`);
    await runEntry(
      {
        promptId: args.promptId,
        userSlug: args.userSlug,
        apiUrl: args.apiUrl,
        archiveRoot: args.archiveRoot,
        promptsPath: args.promptsPath,
      },
      entry
    );
    stderr.write(`Done.\n`);
  },
});

const rRun = await exception2Result(() => run(cmd, argv.slice(2)));
if (rRun.isErr()) {
  stderr.write(`Fatal: ${rRun.Err().stack ?? rRun.Err().message}\n`);
  exit(1);
}
