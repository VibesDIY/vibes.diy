import {
  EventoHandler,
  EventoResult,
  EventoResultType,
  HandleTriggerCtx,
  Option,
  Result,
  URI,
  ValidateTriggerCtx,
  exception2Result,
} from "@adviser/cement";
import {
  ActiveEntry,
  EvtIconRepair,
  HttpResponseBodyType,
  HttpResponseJsonType,
  MsgBase,
  isActiveIcon,
  isFetchErrResult,
  isFetchNotFoundResult,
  isFetchOkResult,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { and, eq } from "drizzle-orm/sql/expressions";
import { VibesApiSQLCtx } from "../types.js";

interface ValidatedIconReq {
  userSlug: string;
  appSlug: string;
}

// Parses `/vibes-icon/:userSlug/:appSlug` — trailing slashes ignored.
function parseIconPath(pathname: string): ValidatedIconReq | undefined {
  const parts = pathname.split("/").filter((p) => p.length > 0);
  if (parts.length !== 3 || parts[0] !== "vibes-icon") return undefined;
  return { userSlug: parts[1], appSlug: parts[2] };
}

export const vibesIcon: EventoHandler<Request, ValidatedIconReq, unknown> = {
  hash: "vibes-icon",
  validate: (ctx: ValidateTriggerCtx<Request, ValidatedIconReq, unknown>) => {
    const { request: req } = ctx;
    if (!req) return Promise.resolve(Result.Ok(Option.None()));
    if (req.method !== "GET" && req.method !== "HEAD") {
      return Promise.resolve(Result.Ok(Option.None()));
    }
    const url = URI.from(req.url);
    const parsed = parseIconPath(url.pathname);
    if (!parsed) return Promise.resolve(Result.Ok(Option.None()));
    return Promise.resolve(Result.Ok(Option.Some(parsed)));
  },
  handle: async (ctx: HandleTriggerCtx<Request, ValidatedIconReq, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { userSlug, appSlug } = ctx.validated;

    const rRow = await exception2Result(() =>
      vctx.sql.db
        .select({ settings: vctx.sql.tables.appSettings.settings })
        .from(vctx.sql.tables.appSettings)
        .where(
          and(eq(vctx.sql.tables.appSettings.userSlug, userSlug), eq(vctx.sql.tables.appSettings.appSlug, appSlug))
        )
        .limit(1)
        .then((r) => r[0])
    );
    if (rRow.isErr() || !rRow.Ok()) {
      return notFound(vctx, ctx, userSlug, appSlug);
    }

    const { filtered: entries } = parseArrayWarning((rRow.Ok().settings as unknown[]) ?? [], ActiveEntry);
    const iconEntry = entries.find(isActiveIcon);
    if (!iconEntry) {
      return notFound(vctx, ctx, userSlug, appSlug);
    }

    const rAsset = await vctx.storage.fetch(iconEntry.cid);
    switch (true) {
      case isFetchOkResult(rAsset):
        await ctx.send.send(ctx, {
          type: "http.Response.Body",
          status: 200,
          headers: {
            "Content-Type": iconEntry.mime,
            "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          },
          body: rAsset.data,
        } satisfies HttpResponseBodyType);
        break;
      case isFetchNotFoundResult(rAsset):
        return notFound(vctx, ctx, userSlug, appSlug);
      case isFetchErrResult(rAsset):
      default:
        await ctx.send.send(ctx, {
          type: "http.Response.JSON",
          status: 500,
          json: { type: "error", message: `Failed to fetch icon asset for ${userSlug}/${appSlug}` },
        } satisfies HttpResponseJsonType);
    }
    return Result.Ok(EventoResult.Stop);
  },
};

async function notFound(
  vctx: VibesApiSQLCtx,
  ctx: HandleTriggerCtx<Request, ValidatedIconReq, unknown>,
  userSlug: string,
  appSlug: string
): Promise<Result<EventoResultType>> {
  // Lazy hydration: enqueue a repair event so the icon gets generated on a
  // future load. The handler dedupes if ActiveIcon already landed between
  // this call and its turn on the queue.
  void vctx
    .postQueue({
      payload: { type: "vibes.diy.evt-icon-repair", userSlug, appSlug },
      tid: "queue-event",
      src: "vibesIcon",
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtIconRepair>)
    .catch(() => undefined);

  await ctx.send.send(ctx, {
    type: "http.Response.JSON",
    status: 404,
    json: { type: "error", message: `No icon for ${userSlug}/${appSlug}` },
  } satisfies HttpResponseJsonType);
  return Result.Ok(EventoResult.Stop);
}
