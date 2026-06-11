import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqGetDoc,
  ReqGetDoc,
  ResGetDoc,
  ResGetDocNotFound,
  reqQueryDocs,
  ReqQueryDocs,
  ResQueryDocs,
  reqSubscribeDocs,
  ReqSubscribeDocs,
  ResSubscribeDocs,
  reqSubscribeViewerGrants,
  ReqSubscribeViewerGrants,
  ResSubscribeViewerGrants,
  reqListDbNames,
  ReqListDbNames,
  ResListDbNames,
  ReqWithVerifiedAuth,
  ReqWithOptionalAuth,
  VibesDiyError,
  ResError,
  W3CWebSocketEvent,
  isDirectChannel,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth, optAuth } from "../check-auth.js";
import { eq, and, sql, inArray } from "drizzle-orm";
import { type } from "arktype";
import { checkDocAccess, DocAccessLevel, canRead, isPublicReadable } from "./access-helpers.js";
import type { AccessDescriptor } from "./access-function.js";
import { resolveDbAcl, checkDirectChannelAccess } from "./db-acl-resolver.js";
import { GrantReduce, extractContribution } from "./grant-reduce.js";
import { normalizeChannels } from "./normalize-channels.js";
import { filterDocsByChannel } from "./channel-read-filter.js";
import { mintFilesUrls } from "./files-url-mint.js";
import { applyQueryFilter } from "./app-documents-query-filter.js";
import { readAllowed, clientWsSend, connectionAdminMode } from "./app-documents-shared.js";
import { resolveActiveHandle } from "./resolve-active-handle.js";

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

      // Access check: ACL-aware (read defaults to canRead || isPublicReadable).
      // DM dbs are implicitly safe here: a `_d.` direct-channel ownerHandle slug
      // never matches a handleBinding.handle, so checkDocAccess returns "none" and
      // override can never reach another user's DMs (parallel to TODO(#2290) in queryDocs).
      const reqAdmin = req.adminMode === true;
      const { access } = req._auth
        ? await checkDocAccess(
            vctx,
            req._auth.verifiedAuth.claims.userId,
            req.appSlug,
            req.ownerHandle,
            connectionAdminMode(ctx) || reqAdmin
          )
        : { access: "none" as DocAccessLevel };
      const rAcl = await resolveDbAcl(vctx, req.ownerHandle, req.appSlug, req.dbName);
      if (rAcl.isErr() || !(await readAllowed(vctx, rAcl.Ok(), access, req.appSlug, req.ownerHandle))) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access denied" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const t = vctx.sql.tables.appDocuments;

      // Get latest revision
      const row = await vctx.sql.db
        .select()
        .from(t)
        .where(
          and(eq(t.ownerHandle, req.ownerHandle), eq(t.appSlug, req.appSlug), eq(t.dbName, req.dbName), eq(t.docId, req.docId))
        )
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

      // Channel-gated read: if access fn binding exists, verify doc is in user's channels
      const tAfbG = vctx.sql.tables.accessFunctionBindings;
      const afbRowG = await vctx.sql.db
        .select({ accessFnCid: tAfbG.accessFnCid })
        .from(tAfbG)
        .where(
          and(eq(tAfbG.ownerHandle, req.ownerHandle), eq(tAfbG.appSlug, req.appSlug), inArray(tAfbG.dbName, [req.dbName, "*"]))
        )
        .orderBy(sql`CASE WHEN ${tAfbG.dbName} = ${req.dbName} THEN 0 ELSE 1 END`)
        .limit(1)
        .then((r) => r[0]);

      if (afbRowG?.accessFnCid && access !== "override") {
        const tOutputsG = vctx.sql.tables.accessFnOutputs;
        const docOutput = await vctx.sql.db
          .select({ output: tOutputsG.output })
          .from(tOutputsG)
          .where(
            and(
              eq(tOutputsG.ownerHandle, req.ownerHandle),
              eq(tOutputsG.appSlug, req.appSlug),
              eq(tOutputsG.dbName, req.dbName),
              eq(tOutputsG.docId, req.docId),
              eq(tOutputsG.fnCid, afbRowG.accessFnCid)
            )
          )
          .limit(1)
          .then((r) => r[0]);

        const parsed = docOutput ? (JSON.parse(docOutput.output) as { channels?: string[] }) : undefined;
        const docChannels = parsed?.channels;

        if (docChannels === undefined || docChannels.length === 0) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-get-doc",
            status: "not-found",
            id: req.docId,
          } satisfies ResGetDocNotFound);
          return Result.Ok(EventoResult.Continue);
        }

        const grantOutputs = await vctx.sql.db
          .select({ docId: tOutputsG.docId, output: tOutputsG.output })
          .from(tOutputsG)
          .where(
            and(
              eq(tOutputsG.ownerHandle, req.ownerHandle),
              eq(tOutputsG.appSlug, req.appSlug),
              eq(tOutputsG.dbName, req.dbName),
              eq(tOutputsG.fnCid, afbRowG.accessFnCid),
              eq(tOutputsG.hasGrants, 1)
            )
          );

        const reduce = new GrantReduce();
        for (const r of grantOutputs) {
          reduce.addDoc(r.docId, extractContribution(JSON.parse(r.output) as AccessDescriptor));
        }

        // Reader's ACTIVE handle (defaultHandle setting, else any bound handle) —
        // shared with the write path and the viewer payload so a multi-handle
        // reader's channel/grant access is computed for the handle they're
        // actually acting as, not an arbitrary bound one (#2275).
        const userHandle = req._auth ? ((await resolveActiveHandle(vctx, req._auth.verifiedAuth.claims.userId)) ?? null) : null;

        const effectiveChannels = userHandle !== null ? reduce.resolveEffectiveChannels(userHandle) : new Set<string>();
        const hasAccess = docChannels.some((ch) => effectiveChannels.has(ch) || reduce.publicChannels.has(ch));

        if (!hasAccess) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-get-doc",
            status: "not-found",
            id: req.docId,
          } satisfies ResGetDocNotFound);
          return Result.Ok(EventoResult.Continue);
        }
      }

      const doc = mintFilesUrls(row.data as Record<string, unknown>, {
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        dbName: req.dbName,
        docId: row.docId,
        svc: vctx.params.vibes.svc,
      });
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-doc",
        status: "ok",
        id: row.docId,
        doc,
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

      // Access check: ACL-aware (read defaults to canRead || isPublicReadable).
      // TODO(#2290): remove this isDirectChannel special case once DM access is
      // modeled as an access.js fn. The branch deliberately leaves access = "none"
      // for DM dbs so the owner override never reaches another user's DMs.
      let access: DocAccessLevel = "none";
      if (isDirectChannel(req.ownerHandle)) {
        const userId = req._auth?.verifiedAuth.claims.userId;
        const rAccess = userId ? await checkDirectChannelAccess(vctx, req.ownerHandle, userId) : Result.Ok(false);
        if (rAccess.isErr() || !rAccess.Ok()) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
      } else {
        const reqAdmin = req.adminMode === true;
        ({ access } = req._auth
          ? await checkDocAccess(
              vctx,
              req._auth.verifiedAuth.claims.userId,
              req.appSlug,
              req.ownerHandle,
              connectionAdminMode(ctx) || reqAdmin
            )
          : { access: "none" as DocAccessLevel });
        const rAcl = await resolveDbAcl(vctx, req.ownerHandle, req.appSlug, req.dbName);
        if (rAcl.isErr() || !(await readAllowed(vctx, rAcl.Ok(), access, req.appSlug, req.ownerHandle))) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
      }

      const t = vctx.sql.tables.appDocuments;

      // Fetch all rows for this app, ordered by docId + seq asc (matches PK index)
      // Then deduplicate in JS — last row per docId is the latest revision
      const rows = await vctx.sql.db
        .select()
        .from(t)
        .where(and(eq(t.ownerHandle, req.ownerHandle), eq(t.appSlug, req.appSlug), eq(t.dbName, req.dbName)))
        .orderBy(sql`${t.docId}, ${t.seq}`);

      // Last row per docId wins (highest seq), skip deleted
      const latest = new Map<string, (typeof rows)[0]>();
      for (const row of rows) {
        latest.set(row.docId, row);
      }
      const docs: ({ _id: string } & Record<string, unknown>)[] = [];
      for (const row of latest.values()) {
        if (row.deleted === 1) continue;
        const doc = mintFilesUrls(row.data as Record<string, unknown>, {
          ownerHandle: req.ownerHandle,
          appSlug: req.appSlug,
          dbName: req.dbName,
          docId: row.docId,
          svc: vctx.params.vibes.svc,
        });
        docs.push({
          _id: row.docId,
          ...doc,
        });
      }

      // Channel-gated read filter: if an access fn binding exists for this db,
      // filter docs to only those in the user's effective channels or public channels.
      const tAfbQ = vctx.sql.tables.accessFunctionBindings;
      const afbRowQ = await vctx.sql.db
        .select({ accessFnCid: tAfbQ.accessFnCid })
        .from(tAfbQ)
        .where(
          and(eq(tAfbQ.ownerHandle, req.ownerHandle), eq(tAfbQ.appSlug, req.appSlug), inArray(tAfbQ.dbName, [req.dbName, "*"]))
        )
        .orderBy(sql`CASE WHEN ${tAfbQ.dbName} = ${req.dbName} THEN 0 ELSE 1 END`)
        .limit(1)
        .then((r) => r[0]);

      let channelFilteredDocs = docs;
      if (afbRowQ?.accessFnCid) {
        const tOutputsQ = vctx.sql.tables.accessFnOutputs;
        const allOutputs = await vctx.sql.db
          .select({ docId: tOutputsQ.docId, output: tOutputsQ.output })
          .from(tOutputsQ)
          .where(
            and(
              eq(tOutputsQ.ownerHandle, req.ownerHandle),
              eq(tOutputsQ.appSlug, req.appSlug),
              eq(tOutputsQ.dbName, req.dbName),
              eq(tOutputsQ.fnCid, afbRowQ.accessFnCid)
            )
          );

        const grantOutputs = allOutputs.filter((r) => {
          const parsed = JSON.parse(r.output) as AccessDescriptor;
          return (
            (parsed.members !== undefined && Object.keys(parsed.members).length > 0) ||
            (parsed.grant?.users !== undefined && Object.keys(parsed.grant.users).length > 0) ||
            (parsed.grant?.roles !== undefined && Object.keys(parsed.grant.roles).length > 0) ||
            (parsed.grant?.public !== undefined && parsed.grant.public.length > 0)
          );
        });

        const reduce = new GrantReduce();
        for (const row of grantOutputs) {
          reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
        }

        // Reader's ACTIVE handle (defaultHandle setting, else any bound handle) —
        // shared with the write path and the viewer payload so a multi-handle
        // reader's channel/grant access is computed for the handle they're
        // actually acting as, not an arbitrary bound one (#2275).
        const userHandle = req._auth ? ((await resolveActiveHandle(vctx, req._auth.verifiedAuth.claims.userId)) ?? null) : null;

        const effectiveChannels = userHandle !== null ? reduce.resolveEffectiveChannels(userHandle) : new Set<string>();
        channelFilteredDocs = filterDocsByChannel(
          docs,
          allOutputs,
          userHandle,
          effectiveChannels,
          reduce.publicChannels,
          access === "override"
        );
      }

      const filteredDocs = applyQueryFilter(channelFilteredDocs, req.filter);
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-query-docs",
        status: "ok",
        docs: filteredDocs,
      } satisfies ResQueryDocs);
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

      // Access check: ACL-aware (read defaults to canRead || isPublicReadable).
      // TODO(#2290): remove this isDirectChannel special case once DM access is
      // modeled as an access.js fn. The branch deliberately leaves access = "none"
      // for DM dbs so the owner override never reaches another user's DMs.
      let access: DocAccessLevel = "none";
      if (isDirectChannel(req.ownerHandle)) {
        const userId = req._auth?.verifiedAuth.claims.userId;
        const rAccess = userId ? await checkDirectChannelAccess(vctx, req.ownerHandle, userId) : Result.Ok(false);
        if (rAccess.isErr() || !rAccess.Ok()) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
        // access remains "none" for DM dbs — override must never reach DMs
      } else {
        ({ access } = req._auth
          ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx))
          : { access: "none" as DocAccessLevel });
        const rAcl = await resolveDbAcl(vctx, req.ownerHandle, req.appSlug, req.dbName);
        if (rAcl.isErr() || !(await readAllowed(vctx, rAcl.Ok(), access, req.appSlug, req.ownerHandle))) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
      }

      // Store subscription on the connection object (fireproof pattern).
      // Access raw WSSendProvider via Evento's .provider wrapper.
      // Key includes dbName so the per-db read ACL is preserved across the
      // change-event channel — see putDoc/deleteDoc and ChatSessions fan-out.
      const wsSend = clientWsSend(ctx);
      const subscriptionKey = `${req.ownerHandle}/${req.appSlug}/${req.dbName}`;

      // Channel-aware subscriptions: when an access fn binding exists, subscribe
      // to the user's effective channels + public channels instead of the raw dbName.
      // putDocEvento sends per-channel notifications when channels are present, so
      // only channel-subscribed connections receive the doc-changed event.
      const tAfbS = vctx.sql.tables.accessFunctionBindings;
      const afbRowS = await vctx.sql.db
        .select({ accessFnCid: tAfbS.accessFnCid })
        .from(tAfbS)
        .where(
          and(eq(tAfbS.ownerHandle, req.ownerHandle), eq(tAfbS.appSlug, req.appSlug), inArray(tAfbS.dbName, [req.dbName, "*"]))
        )
        .orderBy(sql`CASE WHEN ${tAfbS.dbName} = ${req.dbName} THEN 0 ELSE 1 END`)
        .limit(1)
        .then((r) => r[0]);

      const channelKeys: string[] = [];
      if (afbRowS?.accessFnCid) {
        const tOutputsS = vctx.sql.tables.accessFnOutputs;

        if (access === "override") {
          // Owner override: subscribe to ALL channels that appear in any access-fn
          // output for this db. This ensures the owner receives live doc-changed
          // events for docs in channels they aren't personally a member of.
          // Note: channels added after this subscribe call won't be covered until
          // the next subscribeDocs — a known limitation.
          const allOutputs = await vctx.sql.db
            .select({ output: tOutputsS.output })
            .from(tOutputsS)
            .where(
              and(
                eq(tOutputsS.ownerHandle, req.ownerHandle),
                eq(tOutputsS.appSlug, req.appSlug),
                eq(tOutputsS.dbName, req.dbName),
                eq(tOutputsS.fnCid, afbRowS.accessFnCid)
              )
            );

          const allChannels = new Set<string>();
          for (const row of allOutputs) {
            const parsed = JSON.parse(row.output) as { channels?: string[] };
            if (Array.isArray(parsed.channels)) {
              for (const ch of parsed.channels) {
                allChannels.add(ch);
              }
            }
          }
          for (const ch of normalizeChannels([...allChannels])) {
            channelKeys.push(`${subscriptionKey}/${ch}`);
          }
        } else {
          const grantOutputs = await vctx.sql.db
            .select({ docId: tOutputsS.docId, output: tOutputsS.output })
            .from(tOutputsS)
            .where(
              and(
                eq(tOutputsS.ownerHandle, req.ownerHandle),
                eq(tOutputsS.appSlug, req.appSlug),
                eq(tOutputsS.dbName, req.dbName),
                eq(tOutputsS.fnCid, afbRowS.accessFnCid),
                eq(tOutputsS.hasGrants, 1)
              )
            );

          const reduce = new GrantReduce();
          for (const row of grantOutputs) {
            reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
          }

          // Reader's ACTIVE handle (see note above) so subscription channel keys
          // match the handle this reader is acting as (#2275).
          const userHandle = req._auth ? ((await resolveActiveHandle(vctx, req._auth.verifiedAuth.claims.userId)) ?? null) : null;

          const effectiveChannels = userHandle !== null ? reduce.resolveEffectiveChannels(userHandle) : new Set<string>();
          const rawGrantChannels = [...effectiveChannels, ...reduce.publicChannels];
          for (const ch of normalizeChannels(rawGrantChannels)) {
            channelKeys.push(`${subscriptionKey}/${ch}`);
          }
        }
      }

      if (channelKeys.length > 0) {
        for (const key of channelKeys) {
          wsSend.subscribedDocKeys.add(key);
        }
        // Narrow fan-out: drop the now-redundant bare db key. A prior subscribe
        // that ran before any channel materialized registered owner/app/<dbName>
        // (the #2337 fallback). subscribedDocKeys is additive, so without this the
        // connection keeps matching the broad bare-db wake forever and never
        // narrows to channel scope (#2340). Channel keys nest under the db
        // (owner/app/<dbName>/<channel>), so this can never delete a channel key —
        // including one owned by another db's subscription on the same connection.
        wsSend.subscribedDocKeys.delete(subscriptionKey);
      } else {
        wsSend.subscribedDocKeys.add(subscriptionKey);
      }

      // Register this connection's subscription keys for per-vibe local fan-out
      if (vctx.registerDocSubscription) {
        if (channelKeys.length > 0) {
          for (const key of channelKeys) {
            vctx.registerDocSubscription(key).catch((e: unknown) => console.error("DocNotify error:", e));
          }
          // Mirror the narrowing in the external registry so cross-shard fan-out
          // also stops matching the dropped bare db key (#2340).
          vctx.deregisterDocSubscription?.(subscriptionKey).catch((e: unknown) => console.error("DocNotify error:", e));
        } else {
          vctx.registerDocSubscription(subscriptionKey).catch((e: unknown) => console.error("DocNotify error:", e));
        }
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-subscribe-docs",
        status: "ok",
      } satisfies ResSubscribeDocs);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── subscribeViewerGrants ──────────────────────────────────────────

export const subscribeViewerGrantsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqSubscribeViewerGrants>,
  ResSubscribeViewerGrants | VibesDiyError
> = {
  hash: "subscribe-viewer-grants",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqSubscribeViewerGrants(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqSubscribeViewerGrants>>,
        ResSubscribeViewerGrants | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const { access, isOwner } = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx));
      const isPublic = await isPublicReadable(vctx, req.appSlug, req.ownerHandle);
      if (!isOwner && !canRead(access) && !isPublic) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access denied" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const wsSend = clientWsSend(ctx);
      const subscriptionKey = `${req.ownerHandle}/${req.appSlug}`;
      wsSend.subscribedViewerGrantKeys.add(subscriptionKey);

      if (vctx.registerViewerGrantsSubscription) {
        vctx.registerViewerGrantsSubscription(subscriptionKey).catch((e: unknown) => console.error("DocNotify error:", e));
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-subscribe-viewer-grants",
        status: "ok",
      } satisfies ResSubscribeViewerGrants);
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

      const { isOwner } = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx));
      if (!isOwner) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const t = vctx.sql.tables.appDocuments;
      const rows = await vctx.sql.db
        .selectDistinct({ dbName: t.dbName })
        .from(t)
        .where(and(eq(t.ownerHandle, req.ownerHandle), eq(t.appSlug, req.appSlug)));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-db-names",
        status: "ok",
        dbNames: rows.map((r) => r.dbName),
      } satisfies ResListDbNames);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
