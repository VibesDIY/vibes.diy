import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqPutDoc,
  ReqPutDoc,
  ResPutDoc,
  reqGetDoc,
  ReqGetDoc,
  ResGetDoc,
  ResGetDocNotFound,
  reqQueryDocs,
  ReqQueryDocs,
  ResQueryDocs,
  reqDeleteDoc,
  ReqDeleteDoc,
  ResDeleteDoc,
  reqSubscribeDocs,
  ReqSubscribeDocs,
  ResSubscribeDocs,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and } from "drizzle-orm";
import { sql, max } from "drizzle-orm/sql";
import { type } from "arktype";

// ── putDoc ──────────────────────────────────────────────────────────

export const putDocEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqPutDoc>, ResPutDoc | VibesDiyError> = {
  hash: "put-doc",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqPutDoc(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPutDoc>>, ResPutDoc | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const now = new Date().toISOString();
      const docId = req.docId ?? crypto.randomUUID();
      const t = vctx.sql.tables.appDocuments;

      // Get current max seq for this doc
      const maxSeqResult = await vctx.sql.db
        .select({ maxSeq: max(t.seq) })
        .from(t)
        .where(and(eq(t.appSlug, req.appSlug), eq(t.docId, docId)))
        .then((r) => r[0]);

      const nextSeq = (maxSeqResult?.maxSeq ?? 0) + 1;

      await vctx.sql.db.insert(t).values({
        appSlug: req.appSlug,
        docId,
        seq: nextSeq,
        data: req.doc,
        deleted: 0,
        created: now,
      });

      // Broadcast to connections subscribed to this appSlug
      const subs = vctx.subscriptions.get(req.appSlug);
      const subCount = subs?.size ?? 0;
      for (const sub of subs ?? []) {
        sub({ type: "vibes.diy.evt-doc-changed", appSlug: req.appSlug, docId });
      }
      console.log("[Firefly API] broadcast doc-changed to", subCount, "subscribers for", req.appSlug);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-put-doc",
        status: "ok",
        id: docId,
      } satisfies ResPutDoc);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── getDoc ──────────────────────────────────────────────────────────

export const getDocEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqGetDoc>, ResGetDoc | ResGetDocNotFound | VibesDiyError> = {
  hash: "get-doc",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetDoc(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqGetDoc>>,
        ResGetDoc | ResGetDocNotFound | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const t = vctx.sql.tables.appDocuments;

      // Get latest revision
      const row = await vctx.sql.db
        .select()
        .from(t)
        .where(and(eq(t.appSlug, req.appSlug), eq(t.docId, req.docId)))
        .orderBy(sql`${t.seq} desc`)
        .limit(1)
        .then((r) => r[0]);

      if (!row || row.deleted === 1) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-get-doc",
          status: "not-found",
          id: req.docId,
        } satisfies ResGetDocNotFound);
        return Result.Ok(EventoResult.Continue);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-doc",
        status: "ok",
        id: row.docId,
        doc: row.data as Record<string, unknown>,
      } satisfies ResGetDoc);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── queryDocs ───────────────────────────────────────────────────────

export const queryDocsEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqQueryDocs>, ResQueryDocs | VibesDiyError> = {
  hash: "query-docs",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqQueryDocs(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqQueryDocs>>, ResQueryDocs | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const t = vctx.sql.tables.appDocuments;

      // Fetch all rows for this app, ordered by docId + seq desc
      // Then deduplicate in JS to get the latest revision per docId
      const rows = await vctx.sql.db
        .select()
        .from(t)
        .where(eq(t.appSlug, req.appSlug))
        .orderBy(sql`${t.docId}, ${t.seq} desc`);

      // Keep only the latest revision per docId, skip deleted
      const seen = new Set<string>();
      const docs: ({ _id: string } & Record<string, unknown>)[] = [];
      for (const row of rows) {
        if (seen.has(row.docId)) continue;
        seen.add(row.docId);
        if (row.deleted === 1) continue;
        docs.push({
          _id: row.docId,
          ...(row.data as Record<string, unknown>),
        });
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-query-docs",
        status: "ok",
        docs,
      } satisfies ResQueryDocs);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── deleteDoc ───────────────────────────────────────────────────────

export const deleteDocEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqDeleteDoc>, ResDeleteDoc | VibesDiyError> = {
  hash: "delete-doc",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqDeleteDoc(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqDeleteDoc>>, ResDeleteDoc | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const now = new Date().toISOString();
      const t = vctx.sql.tables.appDocuments;

      // Get current max seq
      const maxSeqResult = await vctx.sql.db
        .select({ maxSeq: max(t.seq) })
        .from(t)
        .where(and(eq(t.appSlug, req.appSlug), eq(t.docId, req.docId)))
        .then((r) => r[0]);

      const nextSeq = (maxSeqResult?.maxSeq ?? 0) + 1;

      // Insert tombstone
      await vctx.sql.db.insert(t).values({
        appSlug: req.appSlug,
        docId: req.docId,
        seq: nextSeq,
        data: {},
        deleted: 1,
        created: now,
      });

      // Broadcast to connections subscribed to this appSlug
      for (const sub of vctx.subscriptions.get(req.appSlug) ?? []) {
        sub({ type: "vibes.diy.evt-doc-changed", appSlug: req.appSlug, docId: req.docId });
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-delete-doc",
        status: "ok",
        id: req.docId,
      } satisfies ResDeleteDoc);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── subscribeDocs ───────────────────────────────────��───────────────

export const subscribeDocsEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqSubscribeDocs>, ResSubscribeDocs | VibesDiyError> = {
  hash: "subscribe-docs",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqSubscribeDocs(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqSubscribeDocs>>, ResSubscribeDocs | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;

      // Register this connection for document change notifications.
      // Store a closure that captures ctx.send.send — each call creates a unique closure
      // so the Set won't deduplicate connections that share the same Evento wrapper.
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      let subs = vctx.subscriptions.get(req.appSlug);
      if (!subs) {
        subs = new Set();
        vctx.subscriptions.set(req.appSlug, subs);
      }
      const sendFn = (data: unknown) => {
        ctx.send.send(ctx, data);
      };
      subs.add(sendFn);
      console.log(
        "[Firefly API] registered subscription for",
        req.appSlug,
        "subs:",
        subs.size,
        "connections:",
        vctx.connections.size
      );

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-subscribe-docs",
        status: "ok",
      } satisfies ResSubscribeDocs);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
