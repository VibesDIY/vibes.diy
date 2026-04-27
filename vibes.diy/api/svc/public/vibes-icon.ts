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
import { ensureLogger } from "@fireproof/core-runtime";
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
    if (rRow.isErr()) {
      ensureLogger(vctx.sthis, "vibesIcon").Error().Any({ err: rRow.Err(), userSlug, appSlug }).Msg("appSettings read failed");
      return serverError(ctx, userSlug, appSlug);
    }
    const row = rRow.Ok();
    const entries = row ? parseArrayWarning((row.settings as unknown[]) ?? [], ActiveEntry).filtered : [];
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
        return Result.Ok(EventoResult.Stop);
      case isFetchNotFoundResult(rAsset):
        // Stale ActiveIcon — underlying storage blob was deleted or never
        // landed. Clear the entry so the next repair event regenerates
        // instead of short-circuiting on the dangling cid.
        await clearStaleIcon(vctx, userSlug, appSlug, entries, iconEntry.cid);
        return notFound(vctx, ctx, userSlug, appSlug);
      case isFetchErrResult(rAsset):
      default:
        ensureLogger(vctx.sthis, "vibesIcon").Error().Any({ userSlug, appSlug, cid: iconEntry.cid }).Msg("storage.fetch failed");
        return serverError(ctx, userSlug, appSlug);
    }
  },
};

async function isKnownApp(vctx: VibesApiSQLCtx, userSlug: string, appSlug: string): Promise<boolean> {
  const rBinding = await exception2Result(() =>
    vctx.sql.db
      .select({ appSlug: vctx.sql.tables.appSlugBinding.appSlug })
      .from(vctx.sql.tables.appSlugBinding)
      .where(and(eq(vctx.sql.tables.appSlugBinding.userSlug, userSlug), eq(vctx.sql.tables.appSlugBinding.appSlug, appSlug)))
      .limit(1)
      .then((r) => r[0])
  );
  return rBinding.isOk() && rBinding.Ok() !== undefined;
}

async function clearStaleIcon(
  vctx: VibesApiSQLCtx,
  userSlug: string,
  appSlug: string,
  entries: ActiveEntry[],
  staleCid: string
): Promise<void> {
  const remaining = entries.filter((e) => !isActiveIcon(e) || e.cid !== staleCid);
  const now = new Date().toISOString();
  const rUp = await exception2Result(() =>
    vctx.sql.db
      .update(vctx.sql.tables.appSettings)
      .set({ settings: remaining, updated: now })
      .where(and(eq(vctx.sql.tables.appSettings.userSlug, userSlug), eq(vctx.sql.tables.appSettings.appSlug, appSlug)))
  );
  if (rUp.isErr()) {
    ensureLogger(vctx.sthis, "vibesIcon")
      .Error()
      .Any({ err: rUp.Err(), userSlug, appSlug, staleCid })
      .Msg("failed to clear stale ActiveIcon");
  }
}

async function notFound(
  vctx: VibesApiSQLCtx,
  ctx: HandleTriggerCtx<Request, ValidatedIconReq, unknown>,
  userSlug: string,
  appSlug: string
): Promise<Result<EventoResultType>> {
  // Lazy hydration: only enqueue repair when the app actually exists. Without
  // this gate, /vibes-icon is a public endpoint that any visitor can hit with
  // arbitrary slugs — unbounded queue churn otherwise.
  if (await isKnownApp(vctx, userSlug, appSlug)) {
    void vctx
      .postQueue({
        payload: { type: "vibes.diy.evt-icon-repair", userSlug, appSlug },
        tid: "queue-event",
        src: "vibesIcon",
        dst: "vibes-service",
        ttl: 1,
      } satisfies MsgBase<EvtIconRepair>)
      .catch(() => undefined);
  }

  await ctx.send.send(ctx, {
    type: "http.Response.JSON",
    status: 404,
    json: { type: "error", message: `No icon for ${userSlug}/${appSlug}` },
  } satisfies HttpResponseJsonType);
  return Result.Ok(EventoResult.Stop);
}

async function serverError(
  ctx: HandleTriggerCtx<Request, ValidatedIconReq, unknown>,
  userSlug: string,
  appSlug: string
): Promise<Result<EventoResultType>> {
  await ctx.send.send(ctx, {
    type: "http.Response.JSON",
    status: 500,
    json: { type: "error", message: `Failed to serve icon for ${userSlug}/${appSlug}` },
  } satisfies HttpResponseJsonType);
  return Result.Ok(EventoResult.Stop);
}
