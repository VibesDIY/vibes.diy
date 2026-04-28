import { command, flag, option, positional, string } from "cmd-ts";
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
import { resEnsureAppSlug, ResEnsureAppSlug, isSectionEvent } from "@vibes.diy/api-types";
import type { SectionEvent, VibeFile } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";
import { resolveSectionStream } from "./resolve-section-stream.js";

export const ResGenerate = type({
  type: "'use-vibes.cli.res-generate'",
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
  type: "'use-vibes.cli.generate'",
  prompt: "string",
  appSlug: "string",
  userSlug: "string",
  instantJoin: "boolean",
  verbose: "boolean",
  apiUrl: "string",
});
export type ReqGenerate = typeof ReqGenerate.infer;

export function isReqGenerate(obj: unknown): obj is ReqGenerate {
  return !(ReqGenerate(obj) instanceof type.errors);
}

export const generateEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqGenerate, ResGenerate | ResEnsureAppSlug> = {
  hash: "use-vibes.cli.generate",
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
      return Result.Err("Not logged in. Run 'use-vibes login' first.");
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
      return Result.Err(`Failed to open chat: ${rChat.Err()}`);
    }
    const chat = rChat.Ok();

    // Send the user prompt
    const rPrompt = await chat.prompt({
      messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
    });
    if (rPrompt.isErr()) {
      return Result.Err(`Failed to send prompt: ${JSON.stringify(rPrompt.Err())}`);
    }

    // chat.sectionStream emits SectionEvent | ResError. Drop the error
    // envelopes here so the resolver only sees structured section events.
    const sectionOnly = chat.sectionStream.pipeThrough(
      new TransformStream<unknown, SectionEvent>({
        transform(msg, controller) {
          if (isSectionEvent(msg)) controller.enqueue(msg);
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
    if (Object.keys(resolved.files).length === 0) {
      const tail = resolved.errors.length > 0 ? ` (${resolved.errors.length} apply errors)` : "";
      return Result.Err(`No files resolved from AI response${tail}.`);
    }
    if (resolved.errors.length > 0 && !args.verbose) {
      await sendProgress(ctx, "warn", `Resolved with ${resolved.errors.length} apply error(s); rerun with --verbose for detail.`);
    }

    // Build VibeFile array and disk-write list from resolved file map.
    const files: VibeFile[] = Object.entries(resolved.files).map(([path, content]) => {
      const filename = path.startsWith("/") ? path : `/${path}`;
      return {
        type: "code-block" as const,
        lang: extLang(filename),
        content,
        filename,
      };
    });
    const fileContents = Object.entries(resolved.files).map(([path, content]) => ({
      filename: path.startsWith("/") ? path.slice(1) : path,
      content,
    }));

    // Push to API
    const pushAppSlug = chat.appSlug;
    const pushUserSlug = chat.userSlug;
    const rResult = await api.ensureAppSlug({
      mode: "production",
      appSlug: pushAppSlug,
      userSlug: pushUserSlug,
      fileSystem: files,
    });
    if (rResult.isErr()) {
      const pushErr = rResult.Err();
      return Result.Err(`Push failed: ${typeof pushErr === "object" ? JSON.stringify(pushErr) : String(pushErr)}`);
    }

    const result = resEnsureAppSlug(rResult.Ok());
    if (result instanceof type.errors) {
      return Result.Err(`type mismatch: ${result.summary}`);
    }

    // Write files to local directory
    const dir = join(process.cwd(), pushAppSlug);
    const rDir = await exception2Result(() => mkdir(dir, { recursive: true }));
    if (rDir.isErr()) {
      return Result.Err(`Failed to create directory: ${rDir.Err().message}`);
    }
    for (const file of fileContents) {
      await writeFile(join(dir, file.filename), file.content, "utf-8");
    }

    // Generate a README and write to disk (not pushed to API)
    const vibeUrl = BuildURI.from(args.apiUrl)
      .pathname(`/vibe/${pushUserSlug}/${pushAppSlug}`)
      .cleanParams("@stable-entry@", ".stable-entry.")
      .toString();
    await writeFile(join(dir, "README.md"), await generateReadme(pushAppSlug, args.prompt, vibeUrl), "utf-8");

    // Configure instant-join if flagged
    if (args.instantJoin && pushUserSlug) {
      const rSettings = await api.ensureAppSettings({
        appSlug: pushAppSlug,
        userSlug: pushUserSlug,
        request: { enable: true, autoAcceptRole: "viewer" },
      });
      if (rSettings.isErr()) {
        const settErr = rSettings.Err();
        await sendProgress(
          ctx,
          "warn",
          `Warning: failed to update app settings: ${typeof settErr === "object" ? JSON.stringify(settErr) : String(settErr)}`
        );
      } else {
        await sendProgress(ctx, "info", "Requests enabled (instant-join)");
      }
    }

    const publicUrl = BuildURI.from(args.apiUrl)
      .pathname(`/vibe/${pushUserSlug}/${pushAppSlug}`)
      .cleanParams("@stable-entry@", ".stable-entry.")
      .toString();

    await sendProgress(ctx, "info", `Created: ${dir}`);
    await sendProgress(ctx, "info", `URL: ${publicUrl}`);

    return sendMsg(ctx, {
      type: "use-vibes.cli.res-generate",
      appSlug: pushAppSlug,
      userSlug: pushUserSlug,
      url: publicUrl,
      directory: dir,
    } satisfies ResGenerate);
  },
};

function extLang(filename: string): string {
  const ext = filename.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (ext === undefined) return "jsx";
  if (ext === "js") return "jsx";
  return ext;
}

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
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "use-vibes.cli.generate", ...args };
    }),
  });
}
