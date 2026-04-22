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
} from "@adviser/cement";
import { type } from "arktype";
import { resEnsureAppSlug, ResEnsureAppSlug, isSectionEvent } from "@vibes.diy/api-types";
import type { VibeFile, PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";

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

    // Consume section stream and collect code blocks until block.end
    const codeBlocks: { lang: string; lines: string[] }[] = [];
    let currentBlock: { lang: string; lines: string[] } | undefined;
    let done = false;

    const reader = chat.sectionStream.getReader();
    while (!done) {
      const { value: event, done: streamDone } = await reader.read();
      if (streamDone) break;
      if (!isSectionEvent(event)) continue;
      for (const msg of event.blocks) {
        const m = msg as PromptAndBlockMsgs & Record<string, unknown>;
        switch (m.type) {
          case "block.code.begin":
            currentBlock = { lang: (m.lang as string) ?? "jsx", lines: [] };
            if (args.verbose) process.stderr.write(`\n--- code block (${currentBlock.lang}) ---\n`);
            break;
          case "block.code.line":
            if (currentBlock) {
              currentBlock.lines.push(m.line as string);
              if (args.verbose) process.stderr.write((m.line as string) + "\n");
            }
            break;
          case "block.code.end":
            if (currentBlock) {
              codeBlocks.push(currentBlock);
              currentBlock = undefined;
              if (args.verbose) process.stderr.write("--- end code block ---\n");
            }
            break;
          case "block.toplevel.line":
            if (args.verbose) process.stderr.write((m.line as string) + "\n");
            break;
          case "block.end":
            done = true;
            break;
        }
        if (done) break;
      }
    }
    reader.releaseLock();
    await chat.close();

    if (codeBlocks.length === 0) {
      return Result.Err("No code blocks received from AI response.");
    }

    // Build VibeFile array — first block is App.jsx
    const files: VibeFile[] = codeBlocks.map((block, idx) => ({
      type: "code-block" as const,
      lang: block.lang,
      content: block.lines.join("\n"),
      filename: idx === 0 ? "/App.jsx" : `/File-${idx}.${block.lang}`,
    }));

    // Build content map for writing to disk
    const fileContents = codeBlocks.map((block, idx) => ({
      filename: idx === 0 ? "App.jsx" : `File-${idx}.${block.lang}`,
      content: block.lines.join("\n"),
    }));

    // Push to API
    const pushAppSlug = chat.appSlug;
    const pushUserSlug = chat.userSlug;
    const rResult = await api.ensureAppSlug({
      mode: "dev",
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

    // Configure instant-join if flagged
    if (args.instantJoin && pushUserSlug) {
      const rSettings = await api.ensureAppSettings({
        appSlug: pushAppSlug,
        userSlug: pushUserSlug,
        request: { enable: true, autoAcceptViewRequest: true },
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
