import { command, flag, option, string } from "cmd-ts";
import { readdir, readFile } from "fs/promises";
import { basename, extname, join } from "path";
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
import { resEnsureAppSlug, isResEnsureAppSlugOk, ResEnsureAppSlug } from "@vibes.diy/api-types";
import type { VibeFile } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";

const CODE_EXTENSIONS = new Set(["jsx", "js", "ts", "tsx"]);
const ALLOWED_EXTENSIONS = new Set([...CODE_EXTENSIONS, "css", "html", "json", "md", "txt", "svg"]);

async function readProjectFiles(dir: string): Promise<VibeFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: VibeFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const lang = extname(entry.name).toLowerCase().slice(1);
    if (ALLOWED_EXTENSIONS.has(lang) === false) continue;

    const content = await readFile(join(dir, entry.name), "utf-8");
    const filename = `/${entry.name}`;

    switch (true) {
      case CODE_EXTENSIONS.has(lang):
        files.push({ type: "code-block", lang, content, filename });
        break;
      default:
        files.push({ type: "str-asset-block", content, filename });
        break;
    }
  }
  return files;
}

export const ReqPush = type({
  type: "'use-vibes.cli.push'",
  mode: "string",
  appSlug: "string",
  userSlug: "string",
  instantJoin: "boolean",
  apiUrl: "string",
});
export type ReqPush = typeof ReqPush.infer;

export function isReqPush(obj: unknown): obj is ReqPush {
  return !(ReqPush(obj) instanceof type.errors);
}

export const pushEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug> = {
  hash: "use-vibes.cli.push",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug>) => {
    if (isReqPush(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqPush, ResEnsureAppSlug>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'use-vibes login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);
    const mode = args.mode === "dev" ? "dev" : "production";
    const appSlug = args.appSlug === "" ? basename(process.cwd()) : args.appSlug;

    // Resolve userSlug: explicit flag > default setting > first from list
    const userSlug = await resolveUserSlug(api, args.userSlug === "" ? undefined : args.userSlug);

    // Read files from CWD
    const rFiles = await exception2Result(() => readProjectFiles(process.cwd()));
    if (rFiles.isErr()) {
      return Result.Err(`Failed to read files: ${rFiles.Err().message}`);
    }
    const files = rFiles.Ok();
    if (files.length === 0) {
      return Result.Err("No files found in current directory. Expected at least App.jsx.");
    }
    if (!files.some((f) => f.type === "code-block")) {
      return Result.Err("No code files (.jsx, .js, .ts, .tsx) found in current directory. Expected at least App.jsx.");
    }

    // Push to API
    const rResult = await api.ensureAppSlug({
      mode,
      appSlug,
      userSlug,
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

    // Enable requests on every push, with instant-join controlled by flag
    if (userSlug) {
      const rSettings = await api.ensureAppSettings({
        appSlug,
        userSlug,
        request: { enable: true, autoAcceptViewRequest: args.instantJoin },
      });
      if (rSettings.isErr()) {
        const settErr = rSettings.Err();
        await sendProgress(
          ctx,
          "warn",
          `Warning: failed to update app settings: ${typeof settErr === "object" ? JSON.stringify(settErr) : String(settErr)}`
        );
      } else {
        const instantJoin = rSettings.Ok().settings.entry.enableRequest?.autoAcceptViewRequest;
        await sendProgress(ctx, "info", `Requests enabled${instantJoin ? " (instant-join)" : ""}`);
      }
    }

    if (isResEnsureAppSlugOk(result)) {
      const publicUrl = BuildURI.from(args.apiUrl)
        .pathname(`/vibe/${result.userSlug}/${result.appSlug}`)
        .cleanParams("@stable-entry@", ".stable-entry.")
        .toString();
      await sendProgress(ctx, "info", `Deployed: ${result.userSlug}/${result.appSlug}`);
      await sendProgress(ctx, "info", `URL: ${publicUrl}`);
    }

    return sendMsg(ctx, result);
  },
};

export function pushCmd(ctx: CliCtx) {
  return command({
    name: "push",
    description: "Upload files from the current directory to a vibe.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      mode: option({
        long: "mode",
        description: "Deploy mode: production or dev",
        type: string,
        defaultValue: () => "production",
        defaultValueIsSerializable: true,
      }),
      appSlug: option({
        long: "app-slug",
        short: "a",
        description: "App slug (defaults to directory name)",
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
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "use-vibes.cli.push", ...args };
    }),
  });
}
