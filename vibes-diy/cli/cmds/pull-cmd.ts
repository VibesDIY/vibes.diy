import { command, option, optional, positional, string } from "cmd-ts";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import {
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  Option,
  EventoHandler,
  EventoResultType,
  exception2Result,
  URI,
} from "@adviser/cement";
import { type } from "arktype";
import type { FileSystemItem } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { resolveVibePositionals } from "../parse-vibe.js";
import { formatErr } from "./format-err.js";

export const ReqPull = type({
  type: "'vibes-diy.cli.pull'",
  appSlug: "string",
  ownerHandle: "string",
  dir: "string",
  apiUrl: "string",
});
export type ReqPull = typeof ReqPull.infer;

export function isReqPull(obj: unknown): obj is ReqPull {
  return !(ReqPull(obj) instanceof type.errors);
}

export const ResPull = type({
  type: "'vibes-diy.cli.res-pull'",
  appSlug: "string",
  ownerHandle: "string",
  directory: "string",
  files: type({ name: "string", size: "number" }).array(),
});
export type ResPull = typeof ResPull.infer;

export function isResPull(obj: unknown): obj is ResPull {
  return !(ResPull(obj) instanceof type.errors);
}

export function deriveHostnameBase(apiUrl: string): string {
  const u = URI.from(apiUrl);
  const hostname = u.hostname;
  const port = u.port;
  if (hostname === "vibes.diy") {
    return apiUrl.includes(".stable-entry.=cli") ? "cli-v2.vibesdiy.net" : "prod-v2.vibesdiy.net";
  }
  const localMatch = hostname.match(/^[^.]+\.(localhost\.vibesdiy\.net)$/);
  if (localMatch) return `${localMatch[1]}${port ? ":" + port : ""}`;
  const envMatch = hostname.match(/^[^.]+\.(.+-v2\.vibesdiy\.net)$/);
  if (envMatch) return envMatch[1];
  return "prod-v2.vibesdiy.net";
}

function isSourceFile(item: FileSystemItem): boolean {
  return item.transform === undefined || item.transform.type === "jsx-to-js" || item.transform.type === "imports";
}

export const pullEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqPull, ResPull> = {
  hash: "vibes-diy.cli.pull",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqPull, ResPull>) => {
    if (isReqPull(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqPull, ResPull>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (!ectx.vibesDiyApiFactory) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);
    if (ownerHandle === undefined) {
      return Result.Err("Could not resolve user slug. Run 'vibes-diy login' first.");
    }

    const rApp = await api.getAppByFsId({ appSlug: args.appSlug, ownerHandle });
    if (rApp.isErr()) {
      return Result.Err(formatErr(rApp.Err()));
    }
    const app = rApp.Ok();

    if (app.grant === "not-found") {
      return Result.Err(`App not found: ${ownerHandle}/${args.appSlug}`);
    }
    if (app.grant === "not-grant") {
      return Result.Err(`Access denied: ${ownerHandle}/${args.appSlug}`);
    }

    const sourceFiles = app.fileSystem.filter(isSourceFile);
    if (sourceFiles.length === 0) {
      return Result.Err(`No source files found for ${ownerHandle}/${args.appSlug}`);
    }

    const dir = args.dir === "" ? resolve(process.cwd(), args.appSlug) : resolve(args.dir);
    const rMkdir = await exception2Result(() => mkdir(dir, { recursive: true }));
    if (rMkdir.isErr()) {
      return Result.Err(`Failed to create directory: ${dir}`);
    }

    const hostnameBase = deriveHostnameBase(args.apiUrl);
    const written: { name: string; size: number }[] = [];
    const fsIdSegment = app.fsId ? `/~${app.fsId}~` : "";

    for (const item of sourceFiles) {
      const fileName = item.fileName.startsWith("/") ? item.fileName.slice(1) : item.fileName;
      const fileUrl = `https://${args.appSlug}--${ownerHandle}.${hostnameBase}${fsIdSegment}/${fileName}?source=true`;
      const rFetch = await exception2Result(() => fetch(fileUrl));
      if (rFetch.isErr()) {
        return Result.Err(`Failed to fetch ${fileName}: ${rFetch.Err().message}`);
      }
      const resp = rFetch.Ok();
      if (!resp.ok) {
        return Result.Err(`Failed to fetch ${fileName}: HTTP ${resp.status}`);
      }
      const content = await resp.text();
      const filePath = join(dir, fileName);
      await mkdir(dirname(filePath), { recursive: true });
      const rWrite = await exception2Result(() => writeFile(filePath, content, "utf-8"));
      if (rWrite.isErr()) {
        return Result.Err(`Failed to write ${fileName}: ${rWrite.Err().message}`);
      }
      written.push({ name: fileName, size: content.length });
    }

    return sendMsg(ctx, {
      type: "vibes-diy.cli.res-pull",
      appSlug: args.appSlug,
      ownerHandle,
      directory: dir,
      files: written,
    } satisfies ResPull);
  },
};

export function pullCmd(ctx: CliCtx) {
  return command({
    name: "pull",
    description: "Download source files of a deployed vibe to disk.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug (e.g. jchris/hat-smeller)",
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
        description: "Handle (uses default if omitted)",
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
      dir: option({
        long: "dir",
        description: "Directory to write files into (defaults to ./<appSlug>/)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      if (args.userSlug) process.stderr.write("[deprecated] --user-slug is deprecated, use --handle or --vibe instead\n");
      const resolved = resolveVibePositionals({
        vibe: args.vibe,
        handle: args.handle || args.userSlug,
        positionals: [args.appSlug],
      });
      return {
        type: "vibes-diy.cli.pull",
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
        dir: args.dir,
        apiUrl: args.apiUrl,
      } satisfies ReqPull;
    }),
  });
}
