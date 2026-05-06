import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  ActiveEntry,
  isActiveIcon,
  isActiveTitle,
  MsgBase,
  reqListRecentVibes,
  ReqListRecentVibes,
  ReqWithVerifiedAuth,
  ResListRecentVibes,
  ResRecentVibesItem,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, lt, or, desc } from "drizzle-orm/sql/expressions";
import type { SQL } from "drizzle-orm/sql";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

const cursorShape = type({
  updated: "string",
  userSlug: "string",
  appSlug: "string",
});

interface DecodedCursor {
  updated: string;
  userSlug: string;
  appSlug: string;
}

function encodeCursor(c: DecodedCursor): string {
  const json = JSON.stringify(c);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8").toString("base64url");
  }
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeCursor(raw: string): Result<DecodedCursor> {
  try {
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(raw, "base64url").toString("utf-8");
    } else {
      const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
      json = atob(padded);
    }
    const parsed = JSON.parse(json) as unknown;
    const checked = cursorShape(parsed);
    if (checked instanceof type.errors) {
      return Result.Err(`invalid cursor: ${checked.summary}`);
    }
    return Result.Ok(checked);
  } catch (err) {
    return Result.Err(err instanceof Error ? err : new Error(String(err)));
  }
}

// Clamp limit to [MIN_LIMIT, MAX_LIMIT] and reject NaN / non-finite / non-integer.
// Anything malformed falls back to DEFAULT_LIMIT rather than 0 or negative —
// SQLite/PG handle limit(0) as "return nothing" which silently breaks pagination,
// and limit(-N) is an error on PG.
function clampLimit(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  const i = Math.floor(raw);
  if (i < MIN_LIMIT) return MIN_LIMIT;
  if (i > MAX_LIMIT) return MAX_LIMIT;
  return i;
}

export const listRecentVibesEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListRecentVibes>,
  ResListRecentVibes | VibesDiyError
> = {
  hash: "list-recent-vibes",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListRecentVibes(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqListRecentVibes>>,
        ResListRecentVibes | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const limit = clampLimit(req.limit);

      const asb = vctx.sql.tables.appSlugBinding;
      const usb = vctx.sql.tables.userSlugBinding;
      const settings = vctx.sql.tables.appSettings;

      const conditions: SQL[] = [eq(usb.userId, userId)];
      if (req.cursor) {
        const rDecoded = decodeCursor(req.cursor);
        if (rDecoded.isErr()) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.error",
            message: `Invalid cursor: ${rDecoded.Err().message}`,
            code: "list-recent-vibes-invalid-cursor",
          } as unknown as VibesDiyError);
          return Result.Ok(EventoResult.Continue);
        }
        const c = rDecoded.Ok();
        const tuplePred = or(
          lt(asb.updated, c.updated),
          and(eq(asb.updated, c.updated), lt(asb.userSlug, c.userSlug)),
          and(eq(asb.updated, c.updated), eq(asb.userSlug, c.userSlug), lt(asb.appSlug, c.appSlug))
        );
        if (tuplePred) conditions.push(tuplePred);
      }

      const rows = await vctx.sql.db
        .select({
          userSlug: asb.userSlug,
          appSlug: asb.appSlug,
          updated: asb.updated,
          settings: settings.settings,
        })
        .from(usb)
        .innerJoin(asb, eq(asb.userSlug, usb.userSlug))
        .leftJoin(
          settings,
          and(eq(settings.userId, usb.userId), eq(settings.userSlug, usb.userSlug), eq(settings.appSlug, asb.appSlug))
        )
        .where(and(...conditions))
        .orderBy(desc(asb.updated), desc(asb.userSlug), desc(asb.appSlug))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const slice = hasMore ? rows.slice(0, limit) : rows;

      const items: ResRecentVibesItem[] = slice.map((row) => {
        const entries = (row.settings as ActiveEntry[] | null) ?? [];
        const titleEntry = entries.find(isActiveTitle);
        const iconEntry = entries.find(isActiveIcon);
        const head = iconEntry?.versions.find((v) => v.cid === iconEntry.currentCid);
        const icon = head && head.cid.length > 0 ? { cid: head.cid, mime: head.mime } : undefined;
        const item: ResRecentVibesItem = {
          userSlug: row.userSlug,
          appSlug: row.appSlug,
          updated: row.updated,
        };
        if (titleEntry) item.title = titleEntry.title;
        if (icon) item.icon = icon;
        return item;
      });

      const nextCursor = hasMore
        ? encodeCursor({
            updated: items[items.length - 1].updated,
            userSlug: items[items.length - 1].userSlug,
            appSlug: items[items.length - 1].appSlug,
          })
        : undefined;

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-recent-vibes",
        items,
        ...(nextCursor ? { nextCursor } : {}),
      } satisfies ResListRecentVibes);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
