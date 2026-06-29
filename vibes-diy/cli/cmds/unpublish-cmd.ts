import { command, option, optional, positional, string } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { resolveVibePositionals } from "../parse-vibe.js";
import { formatErr } from "./format-err.js";

// `unpublish` request — soft-tombstone a deployed vibe (#2688). `publish` no
// longer shares this path: it does more than clear the tombstone (it also
// promotes the latest draft to production), so it has its own request below.
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

// `publish` request — make a vibe live: promote the latest dev draft (or an
// explicit `--fsId`) to a new top-of-stack production release, and clear any
// unpublish tombstone in the same step. This is the inverse of `unpublish` and
// the CLI surface for the same draft→production promotion the web app exposes.
export const ReqPublish = type({
  type: "'vibes-diy.cli.publish'",
  appSlug: "string",
  ownerHandle: "string",
  "fsId?": "string",
  apiUrl: "string",
});
export type ReqPublish = typeof ReqPublish.infer;
export function isReqPublish(obj: unknown): obj is ReqPublish {
  return !(ReqPublish(obj) instanceof type.errors);
}

export const ResPublishCli = type({
  type: "'vibes-diy.cli.res-publish'",
  appSlug: "string",
  ownerHandle: "string",
  fsId: "string",
  releaseSeq: "number",
  // true = a new production release was minted; false = already the highest
  // production (idempotent "up to date").
  released: "boolean",
  // true = a prior unpublish tombstone was cleared as part of this publish.
  restored: "boolean",
});
export type ResPublishCli = typeof ResPublishCli.infer;
export function isResPublishCli(obj: unknown): obj is ResPublishCli {
  return !(ResPublishCli(obj) instanceof type.errors);
}

export const publishEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqPublish, ResPublishCli> = {
  hash: "vibes-diy.cli.publish",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqPublish, ResPublishCli>) => {
    if (isReqPublish(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqPublish, ResPublishCli>): Promise<Result<EventoResultType>> => {
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

    // 1. Promote: mint the latest draft (or the explicit fsId) to production.
    const rPub = await api.publishApp({ appSlug: args.appSlug, ownerHandle, ...(args.fsId ? { fsId: args.fsId } : {}) });
    if (rPub.isErr()) {
      return Result.Err(formatErr(rPub.Err()));
    }
    const pub = rPub.Ok();

    // 2. Make it live: clear any unpublish tombstone. The response reports the
    //    value we replaced, so `restored` is accurate — true only when the slug
    //    was actually tombstoned before this publish.
    const rRestore = await api.setUnpublish({ appSlug: args.appSlug, ownerHandle, unpublish: false });
    if (rRestore.isErr()) {
      return Result.Err(formatErr(rRestore.Err()));
    }

    return sendMsg(ctx, {
      type: "vibes-diy.cli.res-publish",
      appSlug: args.appSlug,
      ownerHandle,
      fsId: pub.fsId,
      releaseSeq: pub.releaseSeq,
      released: pub.published,
      restored: rRestore.Ok().previousUnpublishedAt.length > 0,
    } satisfies ResPublishCli);
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
      "Take a deployed vibe down (reversible). De-indexes the slug and blocks its public URL/remix/version listing; code, data, and grants are kept. Bring it back with `publish`.",
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
    description:
      "Make a vibe live: promote its latest draft (or --fsId) to a new production release, and clear any unpublish tombstone. Use after editing in dev mode, or to bring an unpublished vibe back.",
    args: {
      ...vibeArgs(ctx),
      fsId: option({
        long: "fsId",
        description: "Publish a specific version (fsId from `vibes-diy versions`) instead of the latest draft.",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      const resolved = resolveVibePositionals({ vibe: args.vibe, handle: args.handle, positionals: [args.appSlug] });
      return {
        type: "vibes-diy.cli.publish",
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
        ...(args.fsId ? { fsId: args.fsId } : {}),
        apiUrl: args.apiUrl,
      } satisfies ReqPublish;
    }),
  });
}
