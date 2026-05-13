import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  exception2Result,
  JSONEnDecoderSingleton,
} from "@adviser/cement";
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
import { base58btc } from "multiformats/bases/base58";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, lt, or, desc } from "drizzle-orm/sql/expressions";
import type { SQL } from "drizzle-orm/sql";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

// Cursor includes pinnedAt as the leading sort key. Older cursors written
// before pin support omit pinnedAt; we tolerate that by defaulting to empty
// (unpinned) so an in-flight paginator keeps working through the rollout.
const cursorShape = type({
  "pinnedAt?": "string",
  updated: "string",
  userSlug: "string",
  appSlug: "string",
});

type DecodedCursor = typeof cursorShape.infer & { pinnedAt: string };

const jsonEnde = JSONEnDecoderSingleton();

function encodeCursor(c: DecodedCursor): string {
  return base58btc.encode(jsonEnde.uint8ify(c));
}

function decodeCursor(raw: string): Result<DecodedCursor> {
  const rBytes = exception2Result(() => base58btc.decode(raw));
  if (rBytes.isErr()) return Result.Err(rBytes.Err());
  const rParsed = jsonEnde.parse<unknown>(rBytes.Ok());
  if (rParsed.isErr()) return Result.Err(rParsed.Err());
  const checked = cursorShape(rParsed.Ok());
  if (checked instanceof type.errors) {
    return Result.Err(`invalid cursor: ${checked.summary}`);
  }
  return Result.Ok({ ...checked, pinnedAt: checked.pinnedAt ?? "" });
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqListRecentVibes>>, ResListRecentVibes | VibesDiyError>
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
        // Tuple predicate: rows that come strictly after the cursor under
        // the order (pinnedAt DESC, updated DESC, userSlug DESC, appSlug DESC).
        const tuplePred = or(
          lt(asb.pinnedAt, c.pinnedAt),
          and(eq(asb.pinnedAt, c.pinnedAt), lt(asb.updated, c.updated)),
          and(eq(asb.pinnedAt, c.pinnedAt), eq(asb.updated, c.updated), lt(asb.userSlug, c.userSlug)),
          and(eq(asb.pinnedAt, c.pinnedAt), eq(asb.updated, c.updated), eq(asb.userSlug, c.userSlug), lt(asb.appSlug, c.appSlug))
        );
        if (tuplePred) conditions.push(tuplePred);
      }

      const rows = await vctx.sql.db
        .select({
          userSlug: asb.userSlug,
          appSlug: asb.appSlug,
          updated: asb.updated,
          pinnedAt: asb.pinnedAt,
          settings: settings.settings,
        })
        .from(usb)
        .innerJoin(asb, eq(asb.userSlug, usb.userSlug))
        .leftJoin(
          settings,
          and(eq(settings.userId, usb.userId), eq(settings.userSlug, usb.userSlug), eq(settings.appSlug, asb.appSlug))
        )
        .where(and(...conditions))
        // Pinned rows float to the top: empty string sorts below any ISO
        // timestamp under DESC, so unpinned rows fall through naturally.
        .orderBy(desc(asb.pinnedAt), desc(asb.updated), desc(asb.userSlug), desc(asb.appSlug))
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
        if (row.pinnedAt.length > 0) item.pinnedAt = row.pinnedAt;
        return item;
      });

      const lastRow = hasMore ? slice[slice.length - 1] : undefined;
      const nextCursor = lastRow
        ? encodeCursor({
            pinnedAt: lastRow.pinnedAt ?? "",
            updated: lastRow.updated,
            userSlug: lastRow.userSlug,
            appSlug: lastRow.appSlug,
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
