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
  reqListDmThreads,
  ReqListDmThreads,
  ResListDmThreads,
  DmThreadItem,
  reqMarkDmRead,
  ReqMarkDmRead,
  ResMarkDmRead,
  ReqWithVerifiedAuth,
  ReqWithOptionalAuth,
  VibesDiyError,
  ResError,
  W3CWebSocketEvent,
  DbAcl,
  EvtCommentPosted,
  COMMENTS_DB_NAME,
  EvtDmReceived,
  type QueryFilter,
  isDirectChannel,
  directChannelParticipants,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth, optAuth } from "../check-auth.js";
import { WSSendProvider } from "../svc-ws-send-provider.js";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { max } from "drizzle-orm/sql";
import { type } from "arktype";
import { checkDocAccess, canRead, isPublicReadable, DocAccessLevel } from "./access-helpers.js";
import { enforceAllowAnonymous, ForbiddenError } from "./access-function.js";
import type { AccessDescriptor } from "../../types/access-function.js";
import { aclAllows, resolveDbAcl, checkDirectChannelAccess } from "./db-acl-resolver.js";
import { GrantReduce, extractContribution } from "./grant-reduce.js";
import { mintFilesUrls, isFileMeta } from "./files-url-mint.js";

// Read-side gate: if the ACL pins `read`, honor it exactly; otherwise fall
// back to today's behavior (any reader role, or public-readable visitor).
async function readAllowed(
  vctx: VibesApiSQLCtx,
  acl: DbAcl | undefined,
  access: DocAccessLevel,
  appSlug: string,
  ownerHandle: string
): Promise<boolean> {
  if (acl?.read !== undefined) return aclAllows(acl, "read", access);
  if (canRead(access)) return true;
  return isPublicReadable(vctx, appSlug, ownerHandle);
}

// Access the raw WSSendProvider from Evento's wrapped ctx.send.
// Evento wraps the send provider — the raw instance is at .provider.
// Pattern from fireproof: qs-room-evento.ts clientWs()
function clientWsSend(ctx: { send: unknown }): WSSendProvider {
  return (ctx.send as { provider: WSSendProvider }).provider;
}

// Verify that every `_files.<key>.uploadId` referenced in the doc was minted
// for THIS (ownerHandle, appSlug) pair. Defends against:
//   - typos / stale uploadIds → reject so the doc never references a
//     CID the read handler can't resolve.
//   - foreign-uploadId paste attacks (user A's uploadId pasted into user
//     B's doc) → reject so cross-user reads are impossible at write time,
//     not just at read time. The read handler also checks ownerHandle/appSlug
//     match (defense in depth at [files-asset.ts:178](./files-asset.ts#L178)).
//
// Single batched SELECT via `inArray` — N round-trips would scale badly
// for docs with many files. `_files.<key>` entries that aren't in the
// `{uploadId, type, size}` shape (per `isFileMeta`) are passed through;
// validation only runs on the recognized shape.
async function validateFilesUploads(
  vctx: VibesApiSQLCtx,
  doc: unknown,
  ownerHandle: string,
  appSlug: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const files = (doc as { _files?: Record<string, unknown> } | undefined)?._files;
  if (!files || typeof files !== "object") return { ok: true };
  const uploadIds: string[] = [];
  for (const entry of Object.values(files)) {
    if (isFileMeta(entry)) uploadIds.push(entry.uploadId);
  }
  if (uploadIds.length === 0) return { ok: true };

  const t = vctx.sql.tables.assetUploads;
  const rows = await vctx.sql.db
    .select({ uploadId: t.uploadId, ownerHandle: t.ownerHandle, appSlug: t.appSlug })
    .from(t)
    .where(inArray(t.uploadId, uploadIds));

  const found = new Map(rows.map((r) => [r.uploadId, r]));
  for (const id of uploadIds) {
    const row = found.get(id);
    if (!row) return { ok: false, reason: `unknown uploadId: ${id}` };
    if (row.ownerHandle !== ownerHandle || row.appSlug !== appSlug) {
      return { ok: false, reason: `uploadId ${id} not minted for this app` };
    }
  }
  return { ok: true };
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
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqPutDoc>>, ResPutDoc | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth?.verifiedAuth.claims.userId ?? null;

      if (isDirectChannel(req.ownerHandle)) {
        // DM writes always require authentication
        if (!userId) {
          await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
        const rAccess = await checkDirectChannelAccess(vctx, req.ownerHandle, userId);
        if (rAccess.isErr() || !rAccess.Ok()) {
          await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
      } else if (userId) {
        // Authenticated user: standard ACL gate
        const access = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle);
        const rAcl = await resolveDbAcl(vctx, req.ownerHandle, req.appSlug, req.dbName);
        // Fail closed: a settings-read error must not silently fall back to the
        // open default and re-open writes on a tightened ACL.
        if (rAcl.isErr()) {
          await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
        const acl = rAcl.Ok();
        if (!aclAllows(acl, "write", access)) {
          await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
      }
      // Anonymous non-DM: falls through to access fn gate below

      // Phase 3: validate every `_files.<key>.uploadId` references an
      // AssetUploads row minted for this (ownerHandle, appSlug). See
      // validateFilesUploads above.
      const filesCheck = await validateFilesUploads(vctx, req.doc, req.ownerHandle, req.appSlug);
      if (!filesCheck.ok) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: `Invalid file reference: ${filesCheck.reason}` },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      // Access function gate: look up CID for this (ownerHandle, appSlug, dbName) or app-wide ('*')
      let accessResult: AccessDescriptor | undefined;
      const tAfb = vctx.sql.tables.accessFunctionBindings;
      const afbRow = await vctx.sql.db
        .select({ accessFnCid: tAfb.accessFnCid, accessFnAssetUri: tAfb.accessFnAssetUri })
        .from(tAfb)
        .where(and(eq(tAfb.userSlug, req.ownerHandle), eq(tAfb.appSlug, req.appSlug), eq(tAfb.dbName, req.dbName)))
        .limit(1)
        .then((r) => r[0]);

      // Anonymous write with no access function → deny
      if (!userId && !afbRow?.accessFnCid) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access denied" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      if (afbRow?.accessFnCid && vctx.invokeAccessFn) {
        // Resolve writer's handle from userId — req.ownerHandle is the DB owner, not the writer.
        // Anonymous writers have no userId; userContext stays null so the access fn
        // must opt in via allowAnonymous.
        const t_usb = vctx.sql.tables.handleBinding;
        const writerRow = userId
          ? await vctx.sql.db
              .select({ handle: t_usb.handle })
              .from(t_usb)
              .where(eq(t_usb.userId, userId))
              .limit(1)
              .then((r) => r[0])
          : undefined;
        const userContext = writerRow?.handle ? { userHandle: writerRow.handle } : null;

        // Load existing doc so access fn can enforce update-ownership checks
        let oldDoc: unknown | null = null;
        if (req.docId) {
          const tDocs = vctx.sql.tables.appDocuments;
          const existing = await vctx.sql.db
            .select({ data: tDocs.data })
            .from(tDocs)
            .where(
              and(
                eq(tDocs.ownerHandle, req.ownerHandle),
                eq(tDocs.appSlug, req.appSlug),
                eq(tDocs.dbName, req.dbName),
                eq(tDocs.docId, req.docId)
              )
            )
            .orderBy(desc(tDocs.seq))
            .limit(1)
            .then((r) => r[0]);
          oldDoc = existing?.data ?? null;
        }

        // Fetch source using the stored assetURI (handles SQL and R2 transparently).
        let accessFnSource: string | undefined;
        if (afbRow.accessFnAssetUri) {
          const rFetch = await vctx.storage.fetch(afbRow.accessFnAssetUri);
          if (rFetch.type === "fetch.ok") {
            // Collect stream to Uint8Array, decode to UTF-8
            const reader = rFetch.data.getReader();
            const chunks: Uint8Array[] = [];
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) chunks.push(value);
            }
            const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
            const merged = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              merged.set(chunk, offset);
              offset += chunk.length;
            }
            accessFnSource = new TextDecoder().decode(merged);
          }
        }

        // Build reduce from stored outputs for grant state
        const tOutputs = vctx.sql.tables.accessFnOutputs;
        const storedOutputs = await vctx.sql.db
          .select({ docId: tOutputs.docId, output: tOutputs.output })
          .from(tOutputs)
          .where(
            and(
              eq(tOutputs.userSlug, req.ownerHandle),
              eq(tOutputs.appSlug, req.appSlug),
              eq(tOutputs.dbName, req.dbName),
              eq(tOutputs.fnCid, afbRow.accessFnCid),
              eq(tOutputs.hasGrants, 1)
            )
          );

        const reduce = new GrantReduce();
        for (const row of storedOutputs) {
          reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
        }

        const grantState = {
          members: Object.fromEntries(Array.from(reduce.effectiveMembers).map(([k, v]) => [k, Array.from(v)])),
          roleGrants: Object.fromEntries(Array.from(reduce.roleGrants).map(([k, v]) => [k, Array.from(v)])),
          userGrants: Object.fromEntries(Array.from(reduce.userGrants).map(([k, v]) => [k, Array.from(v)])),
        };

        const invokeResult = await vctx.invokeAccessFn({
          cid: afbRow.accessFnCid,
          doc: req.doc,
          oldDoc,
          user: userContext,
          source: accessFnSource,
          grantState,
        });

        if ("forbidden" in invokeResult) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: invokeResult.forbidden },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }

        try {
          enforceAllowAnonymous(invokeResult, userContext);
        } catch (err: unknown) {
          const reason = err instanceof ForbiddenError ? err.forbidden : String(err);
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: reason },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }

        accessResult = invokeResult;
      }

      const now = new Date().toISOString();
      const docId = req.docId ?? vctx.sthis.timeOrderedNextId().str;
      const dbName = req.dbName;
      const t = vctx.sql.tables.appDocuments;

      // Get current max seq for this doc
      const maxSeqResult = await vctx.sql.db
        .select({ maxSeq: max(t.seq) })
        .from(t)
        .where(and(eq(t.ownerHandle, req.ownerHandle), eq(t.appSlug, req.appSlug), eq(t.dbName, dbName), eq(t.docId, docId)))
        .then((r) => r[0]);

      const nextSeq = (maxSeqResult?.maxSeq ?? 0) + 1;

      await vctx.sql.db.insert(t).values({
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        dbName,
        docId,
        seq: nextSeq,
        userId: userId ?? "unknown",
        data: req.doc,
        deleted: 0,
        created: now,
      });

      // Upsert DirectChannelIndex so both participants appear in listDmThreads
      if (isDirectChannel(req.ownerHandle)) {
        const participants = directChannelParticipants(req.ownerHandle);
        if (participants) {
          const t_idx = vctx.sql.tables.directChannelIndex;
          await vctx.sql.db
            .insert(t_idx)
            .values([
              { handle: participants[0], channelHandle: req.ownerHandle },
              { handle: participants[1], channelHandle: req.ownerHandle },
            ])
            .onConflictDoNothing();

          // Look up which participant slug belongs to the sender
          const t_usb = vctx.sql.tables.handleBinding;
          const senderRow = await vctx.sql.db
            .select({ handle: t_usb.handle })
            .from(t_usb)
            .where(and(eq(t_usb.userId, userId ?? ""), inArray(t_usb.handle, participants)))
            .then((r) => r[0]);
          const senderUserSlug = senderRow?.handle ?? "";
          const recipientUserSlug = participants.find((h) => h !== senderUserSlug) ?? participants[1];

          await vctx.postQueue({
            payload: {
              type: "vibes.diy.evt-dm-received",
              senderUserId: userId ?? "",
              senderUserSlug,
              recipientUserSlug,
              channelUserSlug: req.ownerHandle,
              docId,
              created: now,
              bodySnippet:
                typeof (req.doc as { body?: unknown }).body === "string"
                  ? (req.doc as { body: string }).body.slice(0, 100)
                  : undefined,
            },
            tid: "queue-event",
            src: "putDoc",
            dst: "vibes-service",
            ttl: 1,
          } satisfies MsgBase<EvtDmReceived>);

          // Auto-mark sender's own message as read so their unreadCount stays 0
          if (senderUserSlug) {
            const t_reads = vctx.sql.tables.directChannelReads;
            await vctx.sql.db
              .insert(t_reads)
              .values({ channelHandle: req.ownerHandle, handle: senderUserSlug, lastSeenSeq: nextSeq })
              .onConflictDoUpdate({
                target: [t_reads.channelHandle, t_reads.handle],
                set: { lastSeenSeq: sql`MAX(${t_reads.lastSeenSeq}, ${nextSeq})` },
              });
          }
        }
      }

      if (dbName === COMMENTS_DB_NAME && nextSeq === 1) {
        await vctx.postQueue({
          payload: {
            type: "vibes.diy.evt-comment-posted",
            userId: userId ?? "unknown",
            ownerHandle: req.ownerHandle,
            appSlug: req.appSlug,
            docId,
            created: now,
            email: req._auth?.verifiedAuth.claims.params.email ?? "unknown",
          },
          tid: "queue-event",
          src: "putDoc",
          dst: "vibes-service",
          ttl: 1,
        } satisfies MsgBase<EvtCommentPosted>);
      }

      // Notify DocNotify coordinator for cross-shard fan-out
      if (vctx.notifyDocChanged) {
        vctx
          .notifyDocChanged({ ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId }, clientWsSend(ctx).connId)
          .catch((e: unknown) => console.error("DocNotify error:", e));
      }

      // Channel routing: if access function returned channels, notify subscribers for each
      if (accessResult?.channels?.length && vctx.notifyDocChanged) {
        for (const channel of accessResult.channels) {
          vctx
            .notifyDocChanged(
              { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName: channel, docId },
              clientWsSend(ctx).connId
            )
            .catch((e: unknown) => console.error("DocNotify channel error:", e));
        }
      }

      // Store access fn output for future reduce queries
      if (accessResult && !("forbidden" in accessResult)) {
        const tOutputs = vctx.sql.tables.accessFnOutputs;
        const outputHasGrants =
          (accessResult.members && Object.keys(accessResult.members).length > 0) ||
          (accessResult.grant?.users && Object.keys(accessResult.grant.users).length > 0) ||
          (accessResult.grant?.roles && Object.keys(accessResult.grant.roles).length > 0) ||
          (accessResult.grant?.public && accessResult.grant.public.length > 0)
            ? 1
            : 0;

        // afbRow is guaranteed non-null here because accessResult is only set
        // inside the afbRow?.accessFnCid branch above.
        await vctx.sql.db
          .insert(tOutputs)
          .values({
            userSlug: req.ownerHandle,
            appSlug: req.appSlug,
            dbName: req.dbName,
            docId,
            fnCid: afbRow!.accessFnCid,
            output: JSON.stringify(accessResult),
            hasGrants: outputHasGrants,
          })
          .onConflictDoUpdate({
            target: [tOutputs.userSlug, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
            set: {
              fnCid: afbRow!.accessFnCid,
              output: JSON.stringify(accessResult),
              hasGrants: outputHasGrants,
            },
          });
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

      // Access check: ACL-aware (read defaults to canRead || isPublicReadable).
      const access: DocAccessLevel = req._auth
        ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle)
        : "none";
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

function isInInclusiveRange(value: unknown, lo: unknown, hi: unknown): boolean {
  if (typeof value === "string" && typeof lo === "string" && typeof hi === "string") {
    return value >= lo && value <= hi;
  }
  if (typeof value === "number" && typeof lo === "number" && typeof hi === "number") {
    return value >= lo && value <= hi;
  }
  if (typeof value === "bigint" && typeof lo === "bigint" && typeof hi === "bigint") {
    return value >= lo && value <= hi;
  }
  if (typeof value === "boolean" && typeof lo === "boolean" && typeof hi === "boolean") {
    return Number(value) >= Number(lo) && Number(value) <= Number(hi);
  }
  return false;
}

export function applyQueryFilter(
  docs: ({ _id: string } & Record<string, unknown>)[],
  filter: QueryFilter | undefined
): ({ _id: string } & Record<string, unknown>)[] {
  if (!filter) return docs;
  const { field, key, keys, range } = filter;
  if (key !== undefined) {
    return docs.filter((doc) => doc[field] === key);
  }
  if (keys !== undefined) {
    const keySet = new Set(keys);
    return docs.filter((doc) => keySet.has(doc[field]));
  }
  if (range !== undefined) {
    const [lo, hi] = range;
    return docs.filter((doc) => isInInclusiveRange(doc[field], lo, hi));
  }
  return docs;
}

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
        const access: DocAccessLevel = req._auth
          ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle)
          : "none";
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

      const filteredDocs = applyQueryFilter(docs, req.filter);
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-query-docs",
        status: "ok",
        docs: filteredDocs,
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

      if (isDirectChannel(req.ownerHandle)) {
        const rAccess = await checkDirectChannelAccess(vctx, req.ownerHandle, userId);
        if (rAccess.isErr() || !rAccess.Ok()) {
          await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
      } else {
        const access = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle);
        const rAcl = await resolveDbAcl(vctx, req.ownerHandle, req.appSlug, req.dbName);
        if (rAcl.isErr() || !aclAllows(rAcl.Ok(), "delete", access)) {
          await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
      }

      const now = new Date().toISOString();
      const t = vctx.sql.tables.appDocuments;

      const dbName = req.dbName;

      // Insert tombstone
      const maxSeqResult = await vctx.sql.db
        .select({ maxSeq: max(t.seq) })
        .from(t)
        .where(and(eq(t.ownerHandle, req.ownerHandle), eq(t.appSlug, req.appSlug), eq(t.dbName, dbName), eq(t.docId, req.docId)))
        .then((r) => r[0]);

      const nextSeq = (maxSeqResult?.maxSeq ?? 0) + 1;

      await vctx.sql.db.insert(t).values({
        ownerHandle: req.ownerHandle,
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
          .notifyDocChanged(
            { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId: req.docId },
            clientWsSend(ctx).connId
          )
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

      // Access check: ACL-aware (read defaults to canRead || isPublicReadable).
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
        const access: DocAccessLevel = req._auth
          ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.ownerHandle)
          : "none";
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
      wsSend.subscribedDocKeys.add(subscriptionKey);

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

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle);
      if (access !== "owner") {
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

// ── listDmThreads ────────────────────────────────────────────────────

export const listDmThreadsEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqListDmThreads>, ResListDmThreads | VibesDiyError> = {
  hash: "list-dm-threads",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListDmThreads(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqListDmThreads>>, ResListDmThreads | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      // Get all ownerHandles for this user
      const t_usb = vctx.sql.tables.handleBinding;
      const mySlugRows = await vctx.sql.db.select({ handle: t_usb.handle }).from(t_usb).where(eq(t_usb.userId, userId));
      const myUserSlugs = mySlugRows.map((r) => r.handle);

      if (myUserSlugs.length === 0) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-list-dm-threads", status: "ok", items: [] } satisfies ResListDmThreads);
        return Result.Ok(EventoResult.Continue);
      }

      // Get all channels where any of my slugs participates
      const t_idx = vctx.sql.tables.directChannelIndex;
      const channelRows = await vctx.sql.db
        .select({ channelUserSlug: t_idx.channelHandle, ownerHandle: t_idx.handle })
        .from(t_idx)
        .where(inArray(t_idx.handle, myUserSlugs));

      const t_docs = vctx.sql.tables.appDocuments;
      const t_reads = vctx.sql.tables.directChannelReads;
      const limit = req.pager?.limit ?? 50;

      const channelSlugs = channelRows.map((r) => r.channelUserSlug);

      // Batch query 1: latest doc per channel using subquery (avoids N+1)
      const subq = vctx.sql.db
        .select({ ownerHandle: t_docs.ownerHandle, maxSeq: max(t_docs.seq).as("maxSeq") })
        .from(t_docs)
        .where(
          and(
            inArray(t_docs.ownerHandle, channelSlugs),
            eq(t_docs.appSlug, "dm"),
            eq(t_docs.dbName, "messages"),
            eq(t_docs.deleted, 0)
          )
        )
        .groupBy(t_docs.ownerHandle)
        .as("latest");

      const latestDocs = await vctx.sql.db
        .select()
        .from(t_docs)
        .innerJoin(subq, and(eq(t_docs.ownerHandle, subq.ownerHandle), eq(t_docs.seq, subq.maxSeq)));

      const latestDocByChannel = new Map(latestDocs.map((row) => [row.AppDocuments.ownerHandle, row.AppDocuments]));

      // Batch query 2: read rows for all channels at once
      const readRows = await vctx.sql.db
        .select({ channelUserSlug: t_reads.channelHandle, lastSeenSeq: t_reads.lastSeenSeq })
        .from(t_reads)
        .where(and(inArray(t_reads.channelHandle, channelSlugs), inArray(t_reads.handle, myUserSlugs)));
      const lastSeenByChannel = new Map(readRows.map((r) => [r.channelUserSlug, r.lastSeenSeq]));

      const items: DmThreadItem[] = channelRows.map(({ channelUserSlug, ownerHandle: mySlug }) => {
        const otherUserSlug = (directChannelParticipants(channelUserSlug) ?? []).find((h) => h !== mySlug) ?? "";
        const latestDoc = latestDocByChannel.get(channelUserSlug);
        const latestSeq = latestDoc?.seq ?? 0;
        const lastSeen = lastSeenByChannel.get(channelUserSlug) ?? 0;
        const unreadCount = Math.max(0, latestSeq - lastSeen);
        return {
          channelUserSlug,
          otherUserSlug,
          latestSeq,
          unreadCount,
          latestMessage: latestDoc
            ? {
                body: String((latestDoc.data as { body?: unknown }).body ?? ""),
                createdAt: latestDoc.created,
                authorUserSlug: String((latestDoc.data as { authorUserSlug?: unknown }).authorUserSlug ?? ""),
              }
            : undefined,
        };
      });

      const sorted = items
        .sort((a, b) => ((b.latestMessage?.createdAt ?? "") > (a.latestMessage?.createdAt ?? "") ? 1 : -1))
        .slice(0, limit);

      await ctx.send.send(ctx, { type: "vibes.diy.res-list-dm-threads", status: "ok", items: sorted } satisfies ResListDmThreads);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── markDmRead ───────────────────────────────────────────────────────

export const markDmReadEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqMarkDmRead>, ResMarkDmRead | VibesDiyError> = {
  hash: "mark-dm-read",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqMarkDmRead(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqMarkDmRead>>, ResMarkDmRead | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      // Verify participant
      const rAccess = await checkDirectChannelAccess(vctx, req.channelUserSlug, userId);
      if (rAccess.isErr() || !rAccess.Ok()) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      // Resolve which of my slugs is in this channel
      const participants = directChannelParticipants(req.channelUserSlug) ?? ["", ""];
      const t_usb = vctx.sql.tables.handleBinding;
      const slugRow = await vctx.sql.db
        .select({ handle: t_usb.handle })
        .from(t_usb)
        .where(and(eq(t_usb.userId, userId), inArray(t_usb.handle, participants)))
        .then((r) => r[0]);
      if (!slugRow) {
        await ctx.send.send(ctx, { type: "vibes.diy.res-error", error: { message: "Access denied" } } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }
      const myUserSlug = slugRow.handle;

      const t_reads = vctx.sql.tables.directChannelReads;
      await vctx.sql.db
        .insert(t_reads)
        .values({ channelHandle: req.channelUserSlug, handle: myUserSlug, lastSeenSeq: req.lastSeenSeq })
        .onConflictDoUpdate({
          target: [t_reads.channelHandle, t_reads.handle],
          // MAX so a delayed call never regresses the watermark
          set: { lastSeenSeq: sql`MAX(${t_reads.lastSeenSeq}, ${req.lastSeenSeq})` },
        });

      await ctx.send.send(ctx, { type: "vibes.diy.res-mark-dm-read", status: "ok" } satisfies ResMarkDmRead);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
