import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
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
  ReqWithOptionalAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  Role,
  isResHasAccessInviteAccepted,
  isResHasAccessRequestApproved,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth, optAuth } from "../check-auth.js";
import { WSSendProvider } from "../svc-ws-send-provider.js";
import { eq, and } from "drizzle-orm";
import { sql, max } from "drizzle-orm/sql";
import { type } from "arktype";
import { hasAccessInvite } from "./invite-flow.js";
import { hasAccessRequest } from "./request-flow.js";
import { ensureAppSettings } from "./ensure-app-settings.js";

// Access the raw WSSendProvider from Evento's wrapped ctx.send.
// Evento wraps the send provider — the raw instance is at .provider.
// Pattern from fireproof: qs-room-evento.ts clientWs()
function clientWsSend(ctx: { send: unknown }): WSSendProvider {
  return (ctx.send as { provider: WSSendProvider }).provider;
}

// ── Access control helpers ─────────────────────────────────────────

type DocAccessLevel = Role | "owner" | "none";

const canRead = (level: DocAccessLevel) => level === "owner" || level === "editor" || level === "viewer";
const canWrite = (level: DocAccessLevel) => level === "owner" || level === "editor" || level === "submitter";

async function checkDocAccess(vctx: VibesApiSQLCtx, userId: string, appSlug: string, userSlug: string): Promise<DocAccessLevel> {
  // 1. Check ownership via UserSlugBinding
  const binding = await vctx.sql.db
    .select({ userId: vctx.sql.tables.userSlugBinding.userId })
    .from(vctx.sql.tables.userSlugBinding)
    .where(eq(vctx.sql.tables.userSlugBinding.userSlug, userSlug))
    .limit(1)
    .then((r) => r[0]);

  if (binding?.userId === userId) return "owner";

  // 2. Check invite grants
  const rInvite = await hasAccessInvite(vctx, { grantUserId: userId, appSlug, userSlug });
  if (rInvite.isOk()) {
    const invite = rInvite.Ok();
    if (isResHasAccessInviteAccepted(invite)) {
      return invite.role;
    }
  }

  // 3. Check request grants
  const rReq = await hasAccessRequest(vctx, { foreignUserId: userId, appSlug, userSlug });
  if (rReq.isOk()) {
    const req = rReq.Ok();
    if (isResHasAccessRequestApproved(req)) {
      return req.role;
    }
  }

  return "none";
}

async function isPublicReadable(vctx: VibesApiSQLCtx, appSlug: string, userSlug: string): Promise<boolean> {
  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    userSlug,
    env: [],
  });
  if (rSettings.isErr()) return false;
  return !!rSettings.Ok().settings.entry.publicAccess?.enable;
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
      const userId = req._auth.verifiedAuth.claims.userId;

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      if (!canWrite(access)) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      const now = new Date().toISOString();
      const docId = req.docId ?? vctx.sthis.nextId().str;
      const dbName = req.dbName;
      const t = vctx.sql.tables.appDocuments;

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
        userId: req._auth.verifiedAuth.claims.userId,
        data: req.doc,
        deleted: 0,
        created: now,
      });

      // Broadcast doc-changed to subscribed connections (fireproof pattern: direct ws.send)
      const evt = { type: "vibes.diy.evt-doc-changed", userSlug: req.userSlug, appSlug: req.appSlug, docId };
      const subscriptionKey = `${req.userSlug}/${req.appSlug}`;
      for (const conn of vctx.connections) {
        if (!conn.subscribedAppSlugs.has(subscriptionKey)) continue;
        exception2Result(() =>
          conn.ws.send(
            conn.ende.uint8ify({
              tid: crypto.randomUUID(),
              src: "vibes.diy.api",
              dst: "vibes.diy.client",
              ttl: 10,
              payload: evt,
            })
          )
        );
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

      // Access check: authenticated user with read access, or public app
      if (req._auth) {
        const access = await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.userSlug);
        if (!canRead(access)) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } as unknown as VibesDiyError);
          return Result.Ok(EventoResult.Continue);
        }
      } else {
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

      // Access check: authenticated user with read access, or public app
      if (req._auth) {
        const access = await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.userSlug);
        if (!canRead(access)) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } as unknown as VibesDiyError);
          return Result.Ok(EventoResult.Continue);
        }
      } else {
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

      // Fetch all rows for this app, ordered by docId + seq desc
      // Then deduplicate in JS to get the latest revision per docId
      const rows = await vctx.sql.db
        .select()
        .from(t)
        .where(and(eq(t.userSlug, req.userSlug), eq(t.appSlug, req.appSlug), eq(t.dbName, req.dbName)))
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
      const userId = req._auth.verifiedAuth.claims.userId;

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      if (!canWrite(access)) {
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

      // Broadcast doc-changed to subscribed connections (fireproof pattern: direct ws.send)
      const evt = { type: "vibes.diy.evt-doc-changed", userSlug: req.userSlug, appSlug: req.appSlug, docId: req.docId };
      const subscriptionKey = `${req.userSlug}/${req.appSlug}`;
      for (const conn of vctx.connections) {
        if (!conn.subscribedAppSlugs.has(subscriptionKey)) continue;
        exception2Result(() =>
          conn.ws.send(
            conn.ende.uint8ify({
              tid: crypto.randomUUID(),
              src: "vibes.diy.api",
              dst: "vibes.diy.client",
              ttl: 10,
              payload: evt,
            })
          )
        );
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
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      if (!canRead(access)) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      // Store subscription on the connection object (fireproof pattern).
      // Access raw WSSendProvider via Evento's .provider wrapper.
      const wsSend = clientWsSend(ctx);
      wsSend.subscribedAppSlugs.add(`${req.userSlug}/${req.appSlug}`);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-subscribe-docs",
        status: "ok",
      } satisfies ResSubscribeDocs);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
