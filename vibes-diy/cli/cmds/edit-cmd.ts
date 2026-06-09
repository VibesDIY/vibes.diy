import { command, flag, option, optional, positional, string } from "cmd-ts";
import { writeFile } from "fs/promises";
import { join } from "path";
import {
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  Option,
  EventoHandler,
  EventoResultType,
  exception2Result,
} from "@adviser/cement";
import { type } from "arktype";
import { ResEnsureAppSlug, isResError, isSectionEvent, isPromptDryRunPayload } from "@vibes.diy/api-types";
import type { ChatMessage } from "@vibes.diy/call-ai-v2";
import type { ResError, SectionEvent, PromptDryRunPayload, SelectedSlotInput } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { resolveVibePositionals } from "../parse-vibe.js";
import { collectDiskDraft } from "./disk-drift.js";
import { resolveSectionStream } from "./resolve-section-stream.js";
import { readProjectFiles, pushFromDir } from "./push-from-dir.js";
import { formatErr } from "./format-err.js";
import { formatNoFilesError } from "./format-no-files-error.js";

export const ResEdit = type({
  type: "'vibes-diy.cli.res-edit'",
  appSlug: "string",
  ownerHandle: "string",
  url: "string",
  directory: "string",
});
export type ResEdit = typeof ResEdit.infer;

export function isResEdit(obj: unknown): obj is ResEdit {
  return !(ResEdit(obj) instanceof type.errors);
}

export const ReqEdit = type({
  type: "'vibes-diy.cli.edit'",
  appSlug: "string",
  prompt: "string",
  ownerHandle: "string",
  "instantJoin?": "boolean", // kept for backward compat; fast path is now always on
  verbose: "boolean",
  dir: "string",
  apiUrl: "string",
  // When true: skip file write/push, send dryRun:true to the server,
  // and print the would-be-dispatched LLMRequest from the section stream
  // to stdout. JSON by default; transcript renders a human-readable
  // role-headed view of the assembled messages.
  dryRun: "boolean",
  transcript: "boolean",
  // Optional: file path to focus first in slot rendering. Forwarded to the
  // server as focusPath on the prompt request. Defaults to "App.jsx" server-side.
  "focusPath?": "string",
  // Optional: ephemeral per-request model override. Forwarded as
  // LLMRequest.model; server falls back to appSettings/userSettings/catalog
  // defaults when omitted. Not persisted.
  "model?": "string",
});
export type ReqEdit = typeof ReqEdit.infer;

export function isReqEdit(obj: unknown): obj is ReqEdit {
  return !(ReqEdit(obj) instanceof type.errors);
}

interface DryRunPayload {
  readonly model: string;
  readonly messages: ChatMessage[];
}

// Read the section stream until a prompt.dry-run-payload block for `chatId`
// arrives, or until the stream closes / msg cap is hit. The server emits
// exactly one such block per dryRun:true request (framed by block-begin
// and block-end), so a small msg cap is enough.
async function readDryRunPayloadFromStream(
  stream: ReadableStream<unknown>,
  chatId: string,
  maxMsgs = 32
): Promise<DryRunPayload | undefined> {
  const reader = stream.getReader();
  let seen = 0;
  try {
    while (seen < maxMsgs) {
      const { value, done } = await reader.read();
      if (done) return undefined;
      seen++;
      if (!isSectionEvent(value)) continue;
      const evt = value as SectionEvent;
      if (evt.chatId !== chatId) continue;
      for (const block of evt.blocks) {
        if (isPromptDryRunPayload(block)) {
          const b = block as PromptDryRunPayload;
          return { model: b.request.model ?? "", messages: b.request.messages as ChatMessage[] };
        }
      }
    }
    return undefined;
  } finally {
    reader.releaseLock();
  }
}

// Human-readable transcript for --text mode. Preserves message order;
// concatenates multi-part text content; renders non-text parts as
// [type] placeholders.
export function formatDryRunAsText(payload: DryRunPayload): string {
  const lines: string[] = [];
  lines.push(`# model: ${payload.model}`);
  lines.push("");
  for (const msg of payload.messages) {
    lines.push(`=== ${msg.role.toUpperCase()} ===`);
    const rendered = msg.content.map((part) => (part.type === "text" ? part.text : `[${part.type}]`)).join("");
    lines.push(rendered);
    lines.push("");
  }
  return lines.join("\n");
}

export interface PromptOpts {
  readonly focusPath?: string;
  readonly selected?: SelectedSlotInput;
}

export async function buildEditPromptRequest(input: {
  readonly chatId: string;
  readonly appSlug: string;
  readonly ownerHandle: string;
  readonly prompt: string;
  readonly dir: string;
  readonly focus: string | undefined;
}): Promise<PromptOpts> {
  const base: PromptOpts = input.focus !== undefined ? { focusPath: input.focus } : {};
  const drift = await collectDiskDraft(input.dir);
  if (drift === undefined) return base;
  const files: SelectedSlotInput = {
    kind: "draft",
    files: drift.files.map((f) => ({
      type: "code-block" as const,
      lang: f.lang,
      filename: f.filename,
      content: f.content,
    })),
  };
  return { ...base, selected: files };
}

export async function readSeedFilesFromDir(dir: string): Promise<Result<ReadonlyMap<string, string>>> {
  const rFiles = await exception2Result(() => readProjectFiles(dir));
  if (rFiles.isErr()) {
    return Result.Err(`Failed to read edit directory: ${rFiles.Err().message}`);
  }
  return Result.Ok(
    new Map(
      rFiles.Ok().flatMap((file) => {
        if (!("content" in file) || typeof file.content !== "string") return [];
        return [[file.filename.startsWith("/") ? file.filename.slice(1) : file.filename, file.content] as const];
      })
    )
  );
}

export const editEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqEdit, ResEdit | ResEnsureAppSlug> = {
  hash: "vibes-diy.cli.edit",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqEdit, ResEdit | ResEnsureAppSlug>) => {
    if (isReqEdit(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqEdit, ResEdit | ResEnsureAppSlug>
  ): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    // Resolve ownerHandle: explicit flag > default setting > first from list
    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);
    const dir = args.dir === "" ? process.cwd() : args.dir;

    if (args.dryRun) {
      await sendProgress(ctx, "info", "Dry-run: inspecting prompt assembly...");
      const rChat = await api.openChat({ ownerHandle, appSlug: args.appSlug, mode: "chat" });
      if (rChat.isErr()) {
        return Result.Err(`Failed to open chat: ${formatErr(rChat.Err())}`);
      }
      const chat = rChat.Ok();
      const dryRunOpts = await buildEditPromptRequest({
        chatId: chat.chatId,
        appSlug: chat.appSlug,
        ownerHandle: chat.ownerHandle,
        prompt: args.prompt,
        dir,
        focus: args.focusPath,
      });
      const rPrompt = await chat.prompt(
        {
          ...(args.model !== undefined ? { model: args.model } : {}),
          messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
        },
        { ...dryRunOpts, dryRun: true }
      );
      if (rPrompt.isErr()) {
        await chat.close();
        return Result.Err(`Dry-run failed: ${formatErr(rPrompt.Err())}`);
      }
      const payload = await readDryRunPayloadFromStream(chat.sectionStream, chat.chatId);
      await chat.close();
      if (!payload) {
        return Result.Err("Dry-run: no payload block received from server");
      }
      const out = args.transcript
        ? formatDryRunAsText(payload)
        : JSON.stringify({ model: payload.model, messages: payload.messages }, null, 2);
      process.stdout.write(out + "\n");
      return sendMsg(ctx, {
        type: "vibes-diy.cli.res-edit",
        appSlug: chat.appSlug,
        ownerHandle: chat.ownerHandle,
        url: "",
        directory: dir,
      } satisfies ResEdit);
    }

    const rSeed = await readSeedFilesFromDir(dir);
    if (rSeed.isErr()) {
      return Result.Err(rSeed.Err());
    }

    await sendProgress(ctx, "info", "Editing...");

    const rChat = await api.openChat({
      ownerHandle,
      appSlug: args.appSlug,
      mode: "chat",
    });
    if (rChat.isErr()) {
      return Result.Err(`Failed to open chat: ${formatErr(rChat.Err())}`);
    }
    const chat = rChat.Ok();

    const promptOpts = await buildEditPromptRequest({
      chatId: chat.chatId,
      appSlug: chat.appSlug,
      ownerHandle: chat.ownerHandle,
      prompt: args.prompt,
      dir,
      focus: args.focusPath,
    });
    const rPrompt = await chat.prompt(
      {
        ...(args.model !== undefined ? { model: args.model } : {}),
        messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
      },
      promptOpts
    );
    if (rPrompt.isErr()) {
      return Result.Err(`Failed to send prompt: ${formatErr(rPrompt.Err())}`);
    }

    // chat.sectionStream emits SectionEvent | ResError. Capture error
    // envelopes so we can surface upstream failures (e.g. provider quota,
    // model errors) instead of bottoming out as "no files resolved."
    // Also tally activity counters so the bottom-out error can tell the user
    // whether anything reached the CLI at all (issue #1626).
    const upstreamErrors: ResError[] = [];
    let sectionEventCount = 0;
    let blockCount = 0;
    let streamedBytes = 0;
    const sectionOnly = chat.sectionStream.pipeThrough(
      new TransformStream<unknown, SectionEvent>({
        transform(msg, controller) {
          if (isSectionEvent(msg)) {
            sectionEventCount += 1;
            blockCount += msg.blocks.length;
            streamedBytes += JSON.stringify(msg).length;
            controller.enqueue(msg);
            return;
          }
          if (isResError(msg)) {
            upstreamErrors.push(msg);
            if (args.verbose) {
              const code = msg.error?.code ? ` [${msg.error.code}]` : "";
              process.stderr.write(`[upstream-error]${code} ${msg.error?.message ?? "(no message)"}\n`);
            }
          }
        },
      })
    );

    // Seed from local disk so one-block SEARCH/REPLACE edit turns can apply
    // against the existing project content in the target directory.
    const rResolved = await resolveSectionStream({
      sectionStream: sectionOnly,
      streamId: rPrompt.Ok().promptId,
      seed: rSeed.Ok(),
      onSnapshot: (snap) => {
        if (args.verbose) {
          process.stderr.write(`[${snap.source}] ${snap.path} (${snap.content.length} chars, ${snap.appliedSections} sections)\n`);
        }
      },
      onError: (err) => {
        if (args.verbose) {
          for (const fail of err.failures) {
            process.stderr.write(`[error] ${err.path}: ${fail.reason}${fail.search ? ` near ${fail.search.slice(0, 40)}` : ""}\n`);
          }
        }
      },
    });
    await chat.close();
    if (rResolved.isErr()) {
      return Result.Err(`Failed to resolve edited stream: ${rResolved.Err().message}`);
    }
    const resolved = rResolved.Ok();
    if (args.verbose) {
      process.stderr.write(
        `[stream-summary] section-events=${sectionEventCount} blocks=${blockCount} bytes=${streamedBytes} snapshots=${resolved.snapshotCount} apply-errors=${resolved.applyErrorCount} turn-end=${resolved.turnEndSeen}\n`
      );
    }
    // A turn that ended with zero successful snapshots is a silent no-op:
    // `resolved.files` is the seed read from disk, so writing it back would
    // produce a byte-identical update and a phantom redeploy. Surface it
    // through the same diagnostics path as the empty-resolution case.
    const noChanges = resolved.turnEndSeen && resolved.snapshotCount === 0;
    if (Object.keys(resolved.files).length === 0 || noChanges) {
      return Result.Err(
        formatNoFilesError({
          sectionEventCount,
          blockCount,
          streamedBytes,
          upstreamErrors: upstreamErrors.map((e) => ({
            code: e.error?.code,
            message: e.error?.message ?? "(no message)",
          })),
          applyErrors: resolved.errors,
          noChanges,
        })
      );
    }
    if (upstreamErrors.length > 0 && !args.verbose) {
      const first = upstreamErrors[0];
      const code = first.error?.code ? ` [${first.error.code}]` : "";
      await sendProgress(ctx, "warn", `Upstream warning${code}: ${first.error?.message ?? "(no message)"}`);
    }
    if (resolved.errors.length > 0 && !args.verbose) {
      await sendProgress(ctx, "warn", `Resolved with ${resolved.errors.length} apply error(s); rerun with --verbose for detail.`);
    }

    const pushAppSlug = chat.appSlug;
    const pushUserSlug = chat.ownerHandle;

    for (const [path, content] of Object.entries(resolved.files)) {
      const filename = path.startsWith("/") ? path.slice(1) : path;
      await writeFile(join(dir, filename), content, "utf-8");
    }

    const rPush = await pushFromDir({
      dir,
      mode: "production",
      appSlug: pushAppSlug,
      ownerHandle: pushUserSlug,
      apiUrl: args.apiUrl,
      api,
      ctx,
    });
    if (rPush.isErr()) return Result.Err(rPush.Err());

    await sendProgress(ctx, "info", `Updated: ${dir}`);

    return sendMsg(ctx, {
      type: "vibes-diy.cli.res-edit",
      appSlug: pushAppSlug,
      ownerHandle: pushUserSlug,
      url: rPush.Ok().publicUrl,
      directory: dir,
    } satisfies ResEdit);
  },
};

export function editCmd(ctx: CliCtx) {
  return command({
    name: "edit",
    description: "Send a follow-up prompt to an existing vibe, write files to disk, and push live.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug",
        type: optional(string),
      }),
      prompt: positional({
        displayName: "prompt",
        description: "Follow-up prompt describing what to change",
        type: optional(string),
      }),
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      handle: option({
        long: "handle",
        description: "Handle to publish under (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      userSlug: option({
        long: "user-slug",
        // No description — hidden from help output (deprecated alias for --handle)
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      instantJoin: flag({
        long: "instant-join",
        description: "[Deprecated: no-op. Auto-accept editor is now always enabled by default.]",
      }),
      verbose: flag({
        long: "verbose",
        short: "v",
        description: "Stream AI response to stderr as it arrives",
      }),
      dir: option({
        long: "dir",
        description: "Directory to write resolved files and push from (defaults to cwd)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      dryRun: flag({
        long: "dry-run",
        description: "Inspect the prompt the server would dispatch; do not write files or push",
      }),
      transcript: flag({
        long: "transcript",
        description: "With --dry-run, render the payload as a human-readable transcript instead of JSON",
      }),
      focus: option({
        long: "focus",
        description: "Path to focus first in slot rendering (e.g. Card.jsx for multi-file edits)",
        type: optional(string),
      }),
      model: option({
        long: "model",
        description: "Ephemeral model override for this run (e.g. qwen/qwen3-coder-480b-a35b-instruct); not persisted",
        type: optional(string),
      }),
    },
    handler: ctx.cliStream.enqueue(({ focus, model, handle, userSlug, vibe, appSlug, prompt, ...rest }) => {
      if (userSlug) process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
      // When --vibe supplies the vibe, the positional the user typed is the
      // prompt, not the vibe — resolveVibePositionals shifts it into `trailing`.
      const resolved = resolveVibePositionals({ vibe, handle: handle || userSlug, positionals: [appSlug, prompt] });
      const resolvedPrompt = resolved.trailing[0] ?? "";
      if (resolvedPrompt === "") {
        throw new Error("No prompt provided — pass a follow-up prompt describing what to change.");
      }
      // ArkType's optional-with-typed-value fields (`focusPath?: "string"`,
      // `model?: "string"`) allow the key to be ABSENT but reject an explicit
      // `undefined`. Spreading an `undefined` value when the flag isn't passed
      // makes ReqEdit validation silently miss and the evento dispatcher drop
      // the message with no error — a silent exit 0 for every default-flag
      // CLI run. Destructure both out of the spread and only attach when defined.
      const base = {
        type: "vibes-diy.cli.edit" as const,
        ...rest,
        appSlug: resolved.appSlug,
        prompt: resolvedPrompt,
        ownerHandle: resolved.handle,
      };
      const withFocus = focus === undefined ? base : { ...base, focusPath: focus };
      return model === undefined ? withFocus : { ...withFocus, model };
    }),
  });
}
