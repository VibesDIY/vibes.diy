import { command, flag, option, optional, positional, string } from "cmd-ts";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import {
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  Option,
  EventoHandler,
  EventoResultType,
  exception2Result,
  BuildURI,
  loadAsset,
} from "@adviser/cement";
import { type } from "arktype";
import { ResEnsureAppSlug, isResError, isSectionEvent } from "@vibes.diy/api-types";
import type { ResError, SectionEvent } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";
import { resolveSectionStream } from "./resolve-section-stream.js";
import { pushFromDir } from "./push-from-dir.js";
import { formatErr } from "./format-err.js";
import { formatNoFilesError } from "./format-no-files-error.js";

export const ResGenerate = type({
  type: "'vibes-diy.cli.res-generate'",
  appSlug: "string",
  userSlug: "string",
  url: "string",
  directory: "string",
});
export type ResGenerate = typeof ResGenerate.infer;

export function isResGenerate(obj: unknown): obj is ResGenerate {
  return !(ResGenerate(obj) instanceof type.errors);
}

export const ReqGenerate = type({
  type: "'vibes-diy.cli.generate'",
  prompt: "string",
  appSlug: "string",
  userSlug: "string",
  instantJoin: "boolean",
  verbose: "boolean",
  apiUrl: "string",
  // Optional: file path to focus first in slot rendering. Forwarded to the
  // server as focusPath on the prompt request. Defaults to "App.jsx" server-side.
  "focusPath?": "string",
  // Optional: ephemeral per-request model override. Forwarded as
  // LLMRequest.model; server falls back to appSettings/userSettings/catalog
  // defaults when omitted. Not persisted.
  "model?": "string",
});
export type ReqGenerate = typeof ReqGenerate.infer;

export function isReqGenerate(obj: unknown): obj is ReqGenerate {
  return !(ReqGenerate(obj) instanceof type.errors);
}

export const generateEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqGenerate, ResGenerate | ResEnsureAppSlug> = {
  hash: "vibes-diy.cli.generate",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqGenerate, ResGenerate | ResEnsureAppSlug>) => {
    if (isReqGenerate(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqGenerate, ResGenerate | ResEnsureAppSlug>
  ): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    // Resolve userSlug: explicit flag > default setting > first from list
    const userSlug = await resolveUserSlug(api, args.userSlug === "" ? undefined : args.userSlug);

    await sendProgress(ctx, "info", "Generating...");

    // Open chat — pass prompt for server-side pre-allocation (title+slug)
    const appSlug = args.appSlug === "" ? undefined : args.appSlug;
    const rChat = await api.openChat({
      userSlug,
      appSlug,
      prompt: args.prompt,
      mode: "chat",
    });
    if (rChat.isErr()) {
      return Result.Err(`Failed to open chat: ${formatErr(rChat.Err())}`);
    }
    const chat = rChat.Ok();

    // Send the user prompt
    const rPrompt = await chat.prompt(
      {
        ...(args.model !== undefined ? { model: args.model } : {}),
        messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
      },
      { ...(args.focusPath !== undefined ? { focusPath: args.focusPath } : {}) }
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

    // Pipe the section stream through the same resolver the UI/server use,
    // so Aider-style SEARCH/REPLACE edits compose correctly across blocks
    // instead of being written verbatim to disk.
    const rResolved = await resolveSectionStream({
      sectionStream: sectionOnly,
      streamId: rPrompt.Ok().promptId,
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
      return Result.Err(`Failed to resolve generated stream: ${rResolved.Err().message}`);
    }
    const resolved = rResolved.Ok();
    if (args.verbose) {
      process.stderr.write(
        `[stream-summary] section-events=${sectionEventCount} blocks=${blockCount} bytes=${streamedBytes} snapshots=${resolved.snapshotCount} apply-errors=${resolved.applyErrorCount} turn-end=${resolved.turnEndSeen}\n`
      );
    }
    if (Object.keys(resolved.files).length === 0) {
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

    // Write files to local directory, then push from there so generate uses
    // the exact same lint+push path as `cli push`.
    const dir = join(process.cwd(), pushAppSlug);
    const rDir = await exception2Result(() => mkdir(dir, { recursive: true }));
    if (rDir.isErr()) {
      return Result.Err(`Failed to create directory: ${rDir.Err().message}`);
    }
    for (const [path, content] of Object.entries(resolved.files)) {
      const filename = path.startsWith("/") ? path.slice(1) : path;
      await writeFile(join(dir, filename), content, "utf-8");
    }

    const vibeUrl = BuildURI.from(args.apiUrl)
      .pathname(`/vibe/${pushUserSlug}/${pushAppSlug}`)
      .cleanParams("@stable-entry@", ".stable-entry.")
      .toString();
    await writeFile(join(dir, "README.md"), await generateReadme(pushAppSlug, args.prompt, vibeUrl), "utf-8");

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

    await sendProgress(ctx, "info", `Created: ${dir}`);

    return sendMsg(ctx, {
      type: "vibes-diy.cli.res-generate",
      appSlug: pushAppSlug,
      userSlug: pushUserSlug,
      url: rPush.Ok().publicUrl,
      directory: dir,
    } satisfies ResGenerate);
  },
};

async function generateReadme(appSlug: string, prompt: string, vibeUrl: string): Promise<string> {
  const rTemplate = await loadAsset("./readme-template.md", {
    basePath: () => import.meta.url,
  });
  if (rTemplate.isErr()) {
    // Fallback: minimal README if template can't be loaded
    return `# ${appSlug}\n\n> ${prompt}\n\nLive at [${vibeUrl}](${vibeUrl})\n`;
  }
  return rTemplate
    .Ok()
    .replace(/\{\{APP_SLUG\}\}/g, appSlug)
    .replace(/\{\{PROMPT\}\}/g, prompt)
    .replace(/\{\{VIBE_URL\}\}/g, vibeUrl);
}

export function generateCmd(ctx: CliCtx) {
  return command({
    name: "generate",
    description: "Generate a vibe from a text prompt, write it to disk, and push it live.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      prompt: positional({
        displayName: "prompt",
        description: "Describe the app you want to create",
        type: string,
      }),
      appSlug: option({
        long: "app-slug",
        short: "a",
        description: "App slug (server generates one if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
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
    handler: ctx.cliStream.enqueue((args) => {
      // Same silent-no-op gotcha as edit-cmd: ArkType validate trips on an
      // explicit `focusPath: undefined`, even though the ReqGenerate schema
      // doesn't declare focusPath. Only attach when defined.
      const base = { type: "vibes-diy.cli.generate" as const, ...args };
      const withFocus = args.focus === undefined ? base : { ...base, focusPath: args.focus };
      return args.model === undefined ? withFocus : { ...withFocus, model: args.model };
    }),
  });
}
