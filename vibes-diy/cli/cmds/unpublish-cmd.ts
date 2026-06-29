import { command, option, optional, positional, string } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { resolveVibePositionals } from "../parse-vibe.js";
import { formatErr } from "./format-err.js";

// Shared request/response for both `unpublish` and `publish` (restore) — they
// differ only by the `unpublish` boolean (#2688).
export const ReqSetUnpublish = type({
  type: "'vibes-diy.cli.set-unpublish'",
  appSlug: "string",
  ownerHandle: "string",
  unpublish: "boolean",
  apiUrl: "string",
});
export type ReqSetUnpublish = typeof ReqSetUnpublish.infer;
export function isReqSetUnpublish(obj: unknown): obj is ReqSetUnpublish {
  return !(ReqSetUnpublish(obj) instanceof type.errors);
}

export const ResSetUnpublishCli = type({
  type: "'vibes-diy.cli.res-set-unpublish'",
  appSlug: "string",
  ownerHandle: "string",
  unpublishedAt: "string",
});
export type ResSetUnpublishCli = typeof ResSetUnpublishCli.infer;
export function isResSetUnpublishCli(obj: unknown): obj is ResSetUnpublishCli {
  return !(ResSetUnpublishCli(obj) instanceof type.errors);
}

export const setUnpublishEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqSetUnpublish, ResSetUnpublishCli> = {
  hash: "vibes-diy.cli.set-unpublish",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqSetUnpublish, ResSetUnpublishCli>) => {
    if (isReqSetUnpublish(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (
    ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqSetUnpublish, ResSetUnpublishCli>
  ): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (!ectx.vibesDiyApiFactory) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);
    if (ownerHandle === undefined) {
      return Result.Err("Could not resolve handle. Run 'vibes-diy login' first.");
    }
    if (args.appSlug === "") {
      return Result.Err("Missing vibe — pass an app slug or handle/app-slug.");
    }

    const rSet = await api.setUnpublish({ appSlug: args.appSlug, ownerHandle, unpublish: args.unpublish });
    if (rSet.isErr()) {
      return Result.Err(formatErr(rSet.Err()));
    }
    return sendMsg(ctx, {
      type: "vibes-diy.cli.res-set-unpublish",
      appSlug: args.appSlug,
      ownerHandle,
      unpublishedAt: rSet.Ok().unpublishedAt,
    } satisfies ResSetUnpublishCli);
  },
};

function vibeArgs(ctx: CliCtx) {
  return {
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
  };
}

export function unpublishCmd(ctx: CliCtx) {
  return command({
    name: "unpublish",
    description:
      "Take a deployed vibe down (reversible). De-indexes the slug and blocks its public URL/remix/version listing; code, data, and grants are kept. Restore with `publish`.",
    args: vibeArgs(ctx),
    handler: ctx.cliStream.enqueue((args) => {
      const resolved = resolveVibePositionals({ vibe: args.vibe, handle: args.handle, positionals: [args.appSlug] });
      return {
        type: "vibes-diy.cli.set-unpublish",
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
        unpublish: true,
        apiUrl: args.apiUrl,
      } satisfies ReqSetUnpublish;
    }),
  });
}

export function publishCmd(ctx: CliCtx) {
  return command({
    name: "publish",
    description: "Restore a previously unpublished vibe — clears the tombstone so its public URL resolves again.",
    args: vibeArgs(ctx),
    handler: ctx.cliStream.enqueue((args) => {
      const resolved = resolveVibePositionals({ vibe: args.vibe, handle: args.handle, positionals: [args.appSlug] });
      return {
        type: "vibes-diy.cli.set-unpublish",
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
        unpublish: false,
        apiUrl: args.apiUrl,
      } satisfies ReqSetUnpublish;
    }),
  });
}
