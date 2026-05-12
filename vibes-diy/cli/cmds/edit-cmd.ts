import { command, flag, option, positional, string } from "cmd-ts";
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
import type { ResError, SectionEvent, PromptDryRunPayload } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";
import { resolveSectionStream } from "./resolve-section-stream.js";
import { readProjectFiles, pushFromDir } from "./push-from-dir.js";
import { formatErr } from "./format-err.js";
import { formatNoFilesError } from "./format-no-files-error.js";

export const ResEdit = type({
  type: "'use-vibes.cli.res-edit'",
  appSlug: "string",
  userSlug: "string",
  url: "string",
  directory: "string",
});
export type ResEdit = typeof ResEdit.infer;

export function isResEdit(obj: unknown): obj is ResEdit {
  return !(ResEdit(obj) instanceof type.errors);
}

export const ReqEdit = type({
  type: "'use-vibes.cli.edit'",
  appSlug: "string",
  prompt: "string",
  userSlug: "string",
  instantJoin: "boolean",
  verbose: "boolean",
  dir: "string",
  apiUrl: "string",
  // When true: skip file write/push, send dryRun:true to the server,
  // and print the would-be-dispatched LLMRequest from the section stream
  // to stdout. JSON by default; asText renders a human-readable transcript.
  dryRun: "boolean",
  asText: "boolean",
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
  hash: "use-vibes.cli.edit",
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
      return Result.Err("Not logged in. Run 'use-vibes login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    // Resolve userSlug: explicit flag > default setting > first from list
    const userSlug = await resolveUserSlug(api, args.userSlug === "" ? undefined : args.userSlug);
    const dir = args.dir === "" ? process.cwd() : args.dir;

    if (args.dryRun) {
      await sendProgress(ctx, "info", "Dry-run: inspecting prompt assembly...");
      const rChat = await api.openChat({ userSlug, appSlug: args.appSlug, mode: "chat" });
      if (rChat.isErr()) {
        return Result.Err(`Failed to open chat: ${formatErr(rChat.Err())}`);
      }
      const chat = rChat.Ok();
      const rPrompt = await chat.prompt(
        { messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }] },
        { dryRun: true }
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
      const out = args.asText
        ? formatDryRunAsText(payload)
        : JSON.stringify({ model: payload.model, messages: payload.messages }, null, 2);
      process.stdout.write(out + "\n");
      return sendMsg(ctx, {
        type: "use-vibes.cli.res-edit",
        appSlug: chat.appSlug,
        userSlug: chat.userSlug,
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
      userSlug,
      appSlug: args.appSlug,
      mode: "chat",
    });
    if (rChat.isErr()) {
      return Result.Err(`Failed to open chat: ${formatErr(rChat.Err())}`);
    }
    const chat = rChat.Ok();

    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
    });
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
    const pushUserSlug = chat.userSlug;

    for (const [path, content] of Object.entries(resolved.files)) {
      const filename = path.startsWith("/") ? path.slice(1) : path;
      await writeFile(join(dir, filename), content, "utf-8");
    }

    const rPush = await pushFromDir({
      dir,
      mode: "production",
      appSlug: pushAppSlug,
      userSlug: pushUserSlug,
      instantJoin: args.instantJoin,
      apiUrl: args.apiUrl,
      api,
      ctx,
    });
    if (rPush.isErr()) return Result.Err(rPush.Err());

    await sendProgress(ctx, "info", `Updated: ${dir}`);

    return sendMsg(ctx, {
      type: "use-vibes.cli.res-edit",
      appSlug: pushAppSlug,
      userSlug: pushUserSlug,
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
        displayName: "appSlug",
        description: "Slug of the existing app/chat to edit",
        type: string,
      }),
      prompt: positional({
        displayName: "prompt",
        description: "Follow-up prompt describing what to change",
        type: string,
      }),
      userSlug: option({
        long: "user-slug",
        description: "User slug to publish under (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      instantJoin: flag({
        long: "instant-join",
        description: "Auto-accept database sharing view requests",
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
      asText: flag({
        long: "text",
        description: "With --dry-run, render the payload as a human-readable transcript instead of JSON",
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "use-vibes.cli.edit", ...args };
    }),
  });
}
