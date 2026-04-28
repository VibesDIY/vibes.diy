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
  reqListDbNames,
  ReqListDbNames,
  ResListDbNames,
  ReqWithVerifiedAuth,
  ReqWithOptionalAuth,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth, optAuth } from "../check-auth.js";
import { WSSendProvider } from "../svc-ws-send-provider.js";
import { eq, and, sql } from "drizzle-orm";
import { max } from "drizzle-orm/sql";
import { type } from "arktype";
import { checkDocAccess, canRead, canWrite, isPublicReadable } from "./access-helpers.js";
import { resolveDbPolicy, stampDoc } from "./app-db-policies.js";

// Access the raw WSSendProvider from Evento's wrapped ctx.send.
// Evento wraps the send provider — the raw instance is at .provider.
// Pattern from fireproof: qs-room-evento.ts clientWs()
function clientWsSend(ctx: { send: unknown }): WSSendProvider {
  return (ctx.send as { provider: WSSendProvider }).provider;
}

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
      const claims = req._auth.verifiedAuth.claims;
      const userId = claims.userId;

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      const policy = await resolveDbPolicy(vctx, req.userSlug, req.appSlug, req.dbName);

      let allowed: boolean;
      if (policy.write === "any-reader") {
        allowed = canRead(access) || (await isPublicReadable(vctx, req.appSlug, req.userSlug));
      } else {
        allowed = canWrite(access);
      }
      if (!allowed) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      const now = new Date().toISOString();
      const docId = req.docId ?? vctx.sthis.nextId().str;
      const dbName = req.dbName;
      const t = vctx.sql.tables.appDocuments;

      const stampedDoc = stampDoc(req.doc, policy, claims, now);

      // Get current max seq for this doc
      const maxSeqResult = await vctx.sql.db
        .select({ maxSeq: max(t.seq) })
        .from(t)
        .where(and(eq(t.userSlug, req.userSlug), eq(t.appSlug, req.appSlug), eq(t.dbName, dbName), eq(t.docId, docId)))
        .then((r) => r[0]);

      const nextSeq = (maxSeqResult?.maxSeq ?? 0) + 1;

      await vctx.sql.db.insert(t).values({
        userSlug: req.userSlug,
        appSlug: req.appSlug,
        dbName,
        docId,
        seq: nextSeq,
        userId,
        data: stampedDoc,
        deleted: 0,
        created: now,
      });

      // Notify DocNotify coordinator for cross-shard fan-out
      if (vctx.notifyDocChanged) {
        vctx
          .notifyDocChanged({ userSlug: req.userSlug, appSlug: req.appSlug, docId })
          .catch((e: unknown) => console.error("DocNotify error:", e));
      }

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
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithOptionalAuth<ReqGetDoc>>,
        ResGetDoc | ResGetDocNotFound | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Access check: grant-based read, or public app (authed or not)
      const access = req._auth
        ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.userSlug)
        : "none";
      if (!canRead(access)) {
        const pub = await isPublicReadable(vctx, req.appSlug, req.userSlug);
        if (!pub) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } as unknown as VibesDiyError);
          return Result.Ok(EventoResult.Continue);
        }
      }

      const t = vctx.sql.tables.appDocuments;

      // Get latest revision
      const row = await vctx.sql.db
        .select()
        .from(t)
        .where(and(eq(t.userSlug, req.userSlug), eq(t.appSlug, req.appSlug), eq(t.dbName, req.dbName), eq(t.docId, req.docId)))
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
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqQueryDocs>>, ResQueryDocs | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Access check: grant-based read, or public app (authed or not)
      const access = req._auth
        ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.userSlug)
        : "none";
      if (!canRead(access)) {
        const pub = await isPublicReadable(vctx, req.appSlug, req.userSlug);
        if (!pub) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } as unknown as VibesDiyError);
          return Result.Ok(EventoResult.Continue);
        }
      }

      const t = vctx.sql.tables.appDocuments;

      // Fetch all rows for this app, ordered by docId + seq asc (matches PK index)
      // Then deduplicate in JS — last row per docId is the latest revision
      const rows = await vctx.sql.db
        .select()
        .from(t)
        .where(and(eq(t.userSlug, req.userSlug), eq(t.appSlug, req.appSlug), eq(t.dbName, req.dbName)))
        .orderBy(sql`${t.docId}, ${t.seq}`);

      // Last row per docId wins (highest seq), skip deleted
      const latest = new Map<string, (typeof rows)[0]>();
      for (const row of rows) {
        latest.set(row.docId, row);
      }
      const docs: ({ _id: string } & Record<string, unknown>)[] = [];
      for (const row of latest.values()) {
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
      const userId = req._auth.verifiedAuth.claims.userId;

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      const policy = await resolveDbPolicy(vctx, req.userSlug, req.appSlug, req.dbName);

      let allowed = canWrite(access);
      if (!allowed && policy.delete === "author-or-writer") {
        // Look up the existing doc's author
        const t = vctx.sql.tables.appDocuments;
        const existing = await vctx.sql.db
          .select({ userId: t.userId })
          .from(t)
          .where(and(eq(t.userSlug, req.userSlug), eq(t.appSlug, req.appSlug), eq(t.dbName, req.dbName), eq(t.docId, req.docId)))
          .orderBy(sql`${t.seq} desc`)
          .limit(1)
          .then((r) => r[0]);
        if (existing && existing.userId === userId) {
          allowed = true;
        }
      }

      if (!allowed) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      const now = new Date().toISOString();
      const t = vctx.sql.tables.appDocuments;

      const dbName = req.dbName;

      // Insert tombstone
      const maxSeqResult = await vctx.sql.db
        .select({ maxSeq: max(t.seq) })
        .from(t)
        .where(and(eq(t.userSlug, req.userSlug), eq(t.appSlug, req.appSlug), eq(t.dbName, dbName), eq(t.docId, req.docId)))
        .then((r) => r[0]);

      const nextSeq = (maxSeqResult?.maxSeq ?? 0) + 1;

      await vctx.sql.db.insert(t).values({
        userSlug: req.userSlug,
        appSlug: req.appSlug,
        dbName,
        docId: req.docId,
        seq: nextSeq,
        userId: req._auth.verifiedAuth.claims.userId,
        data: {},
        deleted: 1,
        created: now,
      });

      // Notify DocNotify coordinator for cross-shard fan-out
      if (vctx.notifyDocChanged) {
        vctx
          .notifyDocChanged({ userSlug: req.userSlug, appSlug: req.appSlug, docId: req.docId })
          .catch((e: unknown) => console.error("DocNotify error:", e));
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

// ── subscribeDocs ───────────────────────────────────────────────────

export const subscribeDocsEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqSubscribeDocs>, ResSubscribeDocs | VibesDiyError> = {
  hash: "subscribe-docs",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqSubscribeDocs(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqSubscribeDocs>>, ResSubscribeDocs | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Access check: grant-based read, or public app (authed or not)
      const access = req._auth
        ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.userSlug)
        : "none";
      if (!canRead(access)) {
        const pub = await isPublicReadable(vctx, req.appSlug, req.userSlug);
        if (!pub) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } as unknown as VibesDiyError);
          return Result.Ok(EventoResult.Continue);
        }
      }

      // Store subscription on the connection object (fireproof pattern).
      // Access raw WSSendProvider via Evento's .provider wrapper.
      const wsSend = clientWsSend(ctx);
      const subscriptionKey = `${req.userSlug}/${req.appSlug}`;
      wsSend.subscribedAppSlugs.add(subscriptionKey);

      // Register this shard with DocNotify coordinator for cross-shard fan-out
      if (vctx.registerDocSubscription) {
        vctx.registerDocSubscription(subscriptionKey).catch((e: unknown) => console.error("DocNotify error:", e));
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-subscribe-docs",
        status: "ok",
      } satisfies ResSubscribeDocs);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── listDbNames ────────────────────────────────────────────────────

export const listDbNamesEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqListDbNames>, ResListDbNames | VibesDiyError> = {
  hash: "list-db-names",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListDbNames(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqListDbNames>>, ResListDbNames | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      if (access !== "owner") {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      const t = vctx.sql.tables.appDocuments;
      const rows = await vctx.sql.db
        .selectDistinct({ dbName: t.dbName })
        .from(t)
        .where(and(eq(t.userSlug, req.userSlug), eq(t.appSlug, req.appSlug)));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-db-names",
        status: "ok",
        dbNames: rows.map((r) => r.dbName),
      } satisfies ResListDbNames);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
