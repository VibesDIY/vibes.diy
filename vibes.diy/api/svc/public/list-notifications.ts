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
  MsgBase,
  reqListNotifications,
  ReqListNotifications,
  ResListNotifications,
  reqMarkNotificationsRead,
  ReqMarkNotificationsRead,
  ResMarkNotificationsRead,
  NotificationRow,
  NotificationType,
  ReqWithVerifiedAuth,
  VibesDiyError,
  ResError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { base58btc } from "multiformats/bases/base58";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, lt, or, desc, isNull, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm/sql";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

function clampLimit(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_LIMIT;
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  const i = Math.floor(raw);
  if (i < MIN_LIMIT) return MIN_LIMIT;
  if (i > MAX_LIMIT) return MAX_LIMIT;
  return i;
}

// Cursor is (created, id): created is the primary sort key, id (a sortable
// ULID) breaks ties so pagination is stable when two rows share a timestamp.
const cursorShape = type({ created: "string", id: "string" });
type DecodedCursor = typeof cursorShape.infer;

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
  return Result.Ok(checked);
}

// Map a raw Notifications row to the wire NotificationRow shape. Nullable
// columns come back as `null`; the arktype shape models them as `string | null`
// / `unknown`, so pass them through unchanged.
function toRow(r: {
  id: string;
  userId: string;
  notificationType: string;
  ownerHandle: string;
  appSlug: string;
  body: string;
  actorHandle: string | null;
  actorUserId: string | null;
  targetRef: unknown;
  dedupeKey: string;
  created: string;
  readAt: string | null;
}): NotificationRow {
  return {
    id: r.id,
    userId: r.userId,
    notificationType: r.notificationType as NotificationType,
    ownerHandle: r.ownerHandle,
    appSlug: r.appSlug,
    body: r.body,
    actorHandle: r.actorHandle,
    actorUserId: r.actorUserId,
    targetRef: r.targetRef ?? undefined,
    dedupeKey: r.dedupeKey,
    created: r.created,
    readAt: r.readAt,
  };
}

export const listNotificationsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListNotifications>,
  ResListNotifications | VibesDiyError
> = {
  hash: "list-notifications",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListNotifications(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqListNotifications>>,
        ResListNotifications | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const t = vctx.sql.tables.notifications;
      const limit = clampLimit(req.limit);

      // Caller-scoping is the access boundary: every row read is gated on userId.
      const conditions: SQL[] = [eq(t.userId, userId)];
      if (req.appSlug) conditions.push(eq(t.appSlug, req.appSlug));
      if (req.ownerHandle) conditions.push(eq(t.ownerHandle, req.ownerHandle));
      if (req.notificationType) conditions.push(eq(t.notificationType, req.notificationType));
      if (req.cursor) {
        const rDecoded = decodeCursor(req.cursor);
        if (rDecoded.isErr()) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: `Invalid cursor: ${rDecoded.Err().message}`, code: "list-notifications-invalid-cursor" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
        const c = rDecoded.Ok();
        // Rows strictly after the cursor under (created DESC, id DESC).
        const tuplePred = or(lt(t.created, c.created), and(eq(t.created, c.created), lt(t.id, c.id)));
        if (tuplePred) conditions.push(tuplePred);
      }

      const rows = await vctx.sql.db
        .select()
        .from(t)
        .where(and(...conditions))
        .orderBy(desc(t.created), desc(t.id))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const slice = hasMore ? rows.slice(0, limit) : rows;
      const items = slice.map(toRow);

      const lastRow = hasMore ? slice[slice.length - 1] : undefined;
      const nextCursor = lastRow ? encodeCursor({ created: lastRow.created, id: lastRow.id }) : undefined;

      // Unread count is the user's TOTAL unread (not the filtered subset) so the
      // bell badge is stable regardless of which filtered view requested it.
      const unreadRow = await vctx.sql.db
        .select({ count: sql<number>`count(*)` })
        .from(t)
        .where(and(eq(t.userId, userId), isNull(t.readAt)))
        .then((r) => r[0]);
      const unreadCount = Number(unreadRow?.count ?? 0);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-notifications",
        items,
        ...(nextCursor ? { nextCursor } : {}),
        unreadCount,
      } satisfies ResListNotifications);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const markNotificationsReadEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqMarkNotificationsRead>,
  ResMarkNotificationsRead | VibesDiyError
> = {
  hash: "mark-notifications-read",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqMarkNotificationsRead(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqMarkNotificationsRead>>,
        ResMarkNotificationsRead | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const t = vctx.sql.tables.notifications;
      const now = new Date().toISOString();

      // Only flip rows that are currently unread so the returned count reflects
      // rows actually touched (and a repeat mark-all is naturally idempotent).
      // ids are always intersected with userId so a caller can never mark
      // another user's row read by guessing its id.
      const conditions: SQL[] = [eq(t.userId, userId), isNull(t.readAt)];
      if (req.ids !== undefined) {
        if (req.ids.length === 0) {
          // Empty id list explicitly means "touch nothing".
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-mark-notifications-read",
            ok: 0,
          } satisfies ResMarkNotificationsRead);
          return Result.Ok(EventoResult.Continue);
        }
        conditions.push(inArray(t.id, req.ids));
      }

      const updated = await vctx.sql.db
        .update(t)
        .set({ readAt: now })
        .where(and(...conditions))
        .returning({ id: t.id });

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-mark-notifications-read",
        ok: updated.length,
      } satisfies ResMarkNotificationsRead);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
