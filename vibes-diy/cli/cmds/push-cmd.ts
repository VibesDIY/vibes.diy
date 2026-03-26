import { command, option, string } from "cmd-ts";
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
} from "@adviser/cement";
import { type } from "arktype";
import { resEnsureAppSlug, ResEnsureAppSlug } from "@vibes.diy/api-types";
import type { VibeFile } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

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
});
export type ReqPush = typeof ReqPush.infer;

export function isReqPush(obj: unknown): obj is ReqPush {
  return !(ReqPush(obj) instanceof type.errors);
}

// export function isResPush(obj: unknown): obj is ResEnsureAppSlug {
//   return !(resEnsureAppSlug(obj) instanceof type.errors);
// }

const PushRawArgs = type({ mode: "string", appSlug: "string" });

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
    const rRaw = PushRawArgs(ctx.request.cmdTs.raw);
    if (rRaw instanceof type.errors) {
      return Result.Err(`invalid args: ${rRaw.summary}`);
    }
    const apiUrl = ctx.request.cmdTs.apiUrl;
    const api = ectx.vibesDiyApiFactory(apiUrl);

    const mode = rRaw.mode === "dev" ? "dev" : "production";
    const appSlug = rRaw.appSlug === "" ? basename(process.cwd()) : rRaw.appSlug;

    // Resolve userSlug
    const rList = await api.listUserSlugAppSlug({});
    const userSlug = rList.isOk() && rList.Ok().items.length > 0 ? rList.Ok().items[0].userSlug : undefined;

    // Read files from CWD
    const rFiles = await exception2Result(() => readProjectFiles(process.cwd()));
    if (rFiles.isErr()) {
      return Result.Err(`Failed to read files: ${rFiles.Err().message}`);
    }
    const files = rFiles.Ok();
    if (files.length === 0) {
      return Result.Err("No files found in current directory. Expected at least App.jsx.");
    }

    // Push to API
    const rResult = await api.ensureAppSlug({
      mode,
      appSlug,
      userSlug,
      fileSystem: files,
    });
    if (rResult.isErr()) {
      return Result.Err(`Push failed: ${String(rResult.Err())}`);
    }

    const result = resEnsureAppSlug(rResult.Ok());
    if (result instanceof type.errors) {
      return Result.Err(`type mismatch: ${result.summary}`);
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
    },
    handler: ctx.cliStream.enqueue((_args) => {
      return { type: "use-vibes.cli.push" } satisfies ReqPush;
    }),
  });
}
