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
import { resolveHandle } from "../resolve-handle.js";
import { resolveVibeArgs } from "../parse-vibe.js";
import { resolveSectionStream } from "./resolve-section-stream.js";
import { pushFromDir } from "./push-from-dir.js";
import { formatErr } from "./format-err.js";
import { formatNoFilesError } from "./format-no-files-error.js";
import { formatDryRunAsText, readDryRunPayloadFromStream } from "./dry-run.js";

export const ResGenerate = type({
  type: "'vibes-diy.cli.res-generate'",
  appSlug: "string",
  ownerHandle: "string",
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
  ownerHandle: "string",
  "instantJoin?": "boolean", // kept for backward compat; fast path is now always on
  verbose: "boolean",
  apiUrl: "string",
  // When true: skip file write/push and vibe creation, send dryRun:true to the
  // server, and print the would-be-dispatched LLMRequest from the section
  // stream to stdout. JSON by default; transcript renders a human-readable
  // role-headed view of the assembled messages. Mirrors `edit --dry-run`.
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

    if (args.dryRun) {
      await sendProgress(ctx, "info", "Dry-run: inspecting prompt assembly...");
      // Open a chat purely to assemble the prompt — mirror the edit dry-run.
      // Deliberately omit `prompt` from openChat so the server skips persisting
      // pre-allocation (title/slug/theme/icon + appSettings writes): a fresh
      // `generate --dry-run` produces no vibe metadata. Fidelity is preserved
      // by `dryRunPreAllocate` below, which runs pre-allocation in-memory at
      // assembly time so the preview matches a real generate's system prompt.
      // `dryRun: true` makes openChat fully persistence-free: owner + app-slug
      // are resolved/synthesized in-memory and NO chatContexts row or
      // appSlugBinding is created — so a preview leaves no sidebar clutter
      // (#2364). The synthesized owner/app ride back to the prompt handler
      // inline (LLMChatImpl forwards chat.ownerHandle/appSlug on dry-run).
      //
      // Do NOT run the CLI `resolveHandle` here: with no explicit handle it
      // calls api.ensureUserSettings({...}), which inserts a userSettings row
      // for first-time users — server-side state a dry-run must not create.
      // Forward only an explicit handle; the server's dry-run resolver picks
      // the default handle read-only.
      const ownerHandle = args.ownerHandle === "" ? undefined : args.ownerHandle;
      const appSlug = args.appSlug === "" ? undefined : args.appSlug;
      const rChat = await api.openChat({ ownerHandle, appSlug, mode: "chat", dryRun: true });
      if (rChat.isErr()) {
        return Result.Err(`Failed to open chat: ${formatErr(rChat.Err())}`);
      }
      const chat = rChat.Ok();
      const rPrompt = await chat.prompt(
        {
          ...(args.model !== undefined ? { model: args.model } : {}),
          messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
        },
        { ...(args.focusPath !== undefined ? { focusPath: args.focusPath } : {}), dryRun: true, dryRunPreAllocate: true }
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
        type: "vibes-diy.cli.res-generate",
        appSlug: chat.appSlug,
        ownerHandle: chat.ownerHandle,
        url: "",
        directory: "",
      } satisfies ResGenerate);
    }

    await sendProgress(ctx, "info", "Generating...");

    // Resolve ownerHandle: explicit flag > default setting > first from list.
    // (Only the real generate path — the dry-run above stays read-only.)
    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);

    // Open chat — pass prompt for server-side pre-allocation (title+slug)
    const appSlug = args.appSlug === "" ? undefined : args.appSlug;
    const rChat = await api.openChat({
      ownerHandle,
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
    const promptId = rPrompt.Ok().promptId;

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
      streamId: promptId,
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
          upstreamErrors: [
            ...upstreamErrors.map((e) => ({
              code: e.error?.code,
              message: e.error?.message ?? "(no message)",
            })),
            // Fold in `prompt.error` envelopes: the server emits these (not
            // `vibes.diy.res-error`) when the codegen turn ends abnormally, so
            // without this the real upstream reason was silently dropped (#2048).
            ...resolved.promptErrors.map((message) => ({ message })),
          ],
          applyErrors: resolved.errors,
        })
      );
    }
    // Files resolved but the turn never completed cleanly — recovered from
    // snapshots after an abnormal stream end (#2048). Tell the user we wrote a
    // best-effort result and why, instead of silently shipping a partial app.
    if (!resolved.turnEndSeen) {
      const reason = resolved.promptErrors.length > 0 ? `: ${resolved.promptErrors.join("; ")}` : "";
      await sendProgress(
        ctx,
        "warn",
        `Stream ended before the turn completed${reason}. Recovered ${Object.keys(resolved.files).length} file(s) from snapshots; the result may be incomplete.`
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
      ownerHandle: pushUserSlug,
      runId: promptId,
      apiUrl: args.apiUrl,
      api,
      ctx,
    });
    if (rPush.isErr()) return Result.Err(rPush.Err());

    await sendProgress(ctx, "info", `Created: ${dir}`);

    return sendMsg(ctx, {
      type: "vibes-diy.cli.res-generate",
      appSlug: pushAppSlug,
      ownerHandle: pushUserSlug,
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
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
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
      dryRun: flag({
        long: "dry-run",
        description:
          "Inspect the prompt the server would dispatch; writes no files, pushes nothing, and creates nothing server-side (no vibe metadata, no chat/app-slug bookkeeping row)",
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
    handler: ctx.cliStream.enqueue(({ focus, model, handle, userSlug, vibe, ...rest }) => {
      if (userSlug) process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
      const resolved = resolveVibeArgs({
        vibe,
        handle: handle || userSlug,
        appSlug: rest.appSlug,
        positionalAppSlug: "",
      });
      // Same silent-no-op gotcha as edit-cmd: ArkType validate trips on an
      // explicit `focusPath: undefined` / `model: undefined`. Destructure
      // both out of the spread and only attach when defined.
      const base = { type: "vibes-diy.cli.generate" as const, ...rest, appSlug: resolved.appSlug, ownerHandle: resolved.handle };
      const withFocus = focus === undefined ? base : { ...base, focusPath: focus };
      return model === undefined ? withFocus : { ...withFocus, model };
    }),
  });
}
