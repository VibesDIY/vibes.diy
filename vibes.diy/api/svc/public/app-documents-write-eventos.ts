import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  reqPutDoc,
  ReqPutDoc,
  ResPutDoc,
  reqDeleteDoc,
  ReqDeleteDoc,
  ResDeleteDoc,
  ReqWithVerifiedAuth,
  ReqWithOptionalAuth,
  VibesDiyError,
  ResError,
  W3CWebSocketEvent,
  EvtCommentPosted,
  COMMENTS_DB_NAME,
  EvtDmReceived,
  EvtViewerGrantsChanged,
  isDirectChannel,
  directChannelParticipants,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth, optAuth } from "../check-auth.js";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { max } from "drizzle-orm/sql";
import { type } from "arktype";
import { checkDocAccess } from "./access-helpers.js";
import {
  enforceAllowAnonymous,
  ForbiddenError,
  extractExportSource,
  isReadableResult,
  type AccessDescriptor,
} from "./access-function.js";
import { aclAllows, resolveDbAcl, checkDirectChannelAccess } from "./db-acl-resolver.js";
import { GrantReduce, extractContribution } from "./grant-reduce.js";
import { isFileMeta } from "./files-url-mint.js";
import { clientWsSend, connectionAdminMode } from "./app-documents-shared.js";
import { normalizeChannels } from "./normalize-channels.js";
import { resolveActiveHandle } from "./resolve-active-handle.js";

function grantsUsers(reduce: GrantReduce): Set<string> {
  const users = new Set<string>();
  for (const userSlug of reduce.userGrants.keys()) {
    users.add(userSlug);
  }
  for (const members of reduce.effectiveMembers.values()) {
    for (const userSlug of members) {
      users.add(userSlug);
    }
  }
  return users;
}

function rolesForUser(reduce: GrantReduce, userSlug: string): string[] {
  const roles: string[] = [];
  for (const [roleName, members] of reduce.effectiveMembers) {
    if (members.has(userSlug)) {
      roles.push(roleName);
    }
  }
  return roles.sort();
}

function channelsForUser(reduce: GrantReduce, userSlug: string): string[] {
  return Array.from(reduce.resolveEffectiveChannels(userSlug)).sort();
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function hasEffectiveViewerGrantDelta(before: GrantReduce, after: GrantReduce): boolean {
  const beforePublic = Array.from(before.publicChannels).sort();
  const afterPublic = Array.from(after.publicChannels).sort();
  if (!arraysEqual(beforePublic, afterPublic)) {
    return true;
  }
  const users = new Set<string>([...grantsUsers(before), ...grantsUsers(after)]);
  for (const userSlug of users) {
    const beforeChannels = channelsForUser(before, userSlug);
    const afterChannels = channelsForUser(after, userSlug);
    if (!arraysEqual(beforeChannels, afterChannels)) {
      return true;
    }
    const beforeRoles = rolesForUser(before, userSlug);
    const afterRoles = rolesForUser(after, userSlug);
    if (!arraysEqual(beforeRoles, afterRoles)) {
      return true;
    }
  }
  return false;
}

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
      let isOwner = false;

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
        const docAccessResult = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx));
        const access = docAccessResult.access;
        isOwner = docAccessResult.isOwner;
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
      let grantsReduceBefore: GrantReduce | undefined;
      const tAfb = vctx.sql.tables.accessFunctionBindings;
      const afbRow = await vctx.sql.db
        .select({ accessFnCid: tAfb.accessFnCid, accessFnAssetUri: tAfb.accessFnAssetUri, dbName: tAfb.dbName })
        .from(tAfb)
        .where(and(eq(tAfb.ownerHandle, req.ownerHandle), eq(tAfb.appSlug, req.appSlug), inArray(tAfb.dbName, [req.dbName, "*"])))
        .orderBy(sql`CASE WHEN ${tAfb.dbName} = ${req.dbName} THEN 0 ELSE 1 END`)
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

      const docId = req.docId ?? vctx.sthis.timeOrderedNextId().str;

      if (afbRow?.accessFnCid && vctx.invokeAccessFn) {
        const fnCid = afbRow.accessFnCid;
        // Resolve writer's ACTIVE handle from userId — req.ownerHandle is the DB
        // owner, not the writer. resolveActiveHandle (defaultHandle setting, else
        // any bound handle) is the same resolver who-am-i uses for the viewer
        // payload, so a multi-handle writer's published authorHandle matches the
        // handle the access fn validates against — no spurious "not author"
        // (#2275). Anonymous writers have no userId; userContext stays null so the
        // access fn must opt in via allowAnonymous.
        const writerHandle = userId ? await resolveActiveHandle(vctx, userId) : undefined;
        const userContext = writerHandle ? { userHandle: writerHandle, isOwner } : null;

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
            const rawSource = new TextDecoder().decode(merged);
            accessFnSource = extractExportSource(rawSource, afbRow.dbName) ?? rawSource;
          }
        }

        // Build reduce from stored outputs for grant state
        const tOutputs = vctx.sql.tables.accessFnOutputs;
        const storedOutputs = await vctx.sql.db
          .select({ docId: tOutputs.docId, output: tOutputs.output })
          .from(tOutputs)
          .where(
            and(
              eq(tOutputs.ownerHandle, req.ownerHandle),
              eq(tOutputs.appSlug, req.appSlug),
              eq(tOutputs.dbName, req.dbName),
              eq(tOutputs.fnCid, fnCid),
              eq(tOutputs.hasGrants, 1)
            )
          );

        const reduce = new GrantReduce();
        for (const row of storedOutputs) {
          reduce.addDoc(row.docId, extractContribution(JSON.parse(row.output) as AccessDescriptor));
        }
        grantsReduceBefore = reduce;

        const grantState = {
          members: Object.fromEntries(Array.from(reduce.effectiveMembers).map(([k, v]) => [k, Array.from(v)])),
          roleGrants: Object.fromEntries(Array.from(reduce.roleGrants).map(([k, v]) => [k, Array.from(v)])),
          userGrants: Object.fromEntries(Array.from(reduce.userGrants).map(([k, v]) => [k, Array.from(v)])),
        };

        const adminActive = isOwner && connectionAdminMode(ctx);
        const invokeResult = await vctx.invokeAccessFn({
          cid: fnCid,
          doc: { ...req.doc, _id: docId },
          oldDoc,
          user: userContext,
          source: accessFnSource,
          grantState,
          adminMode: adminActive,
        });

        if ("forbidden" in invokeResult) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            // `access-denied` lets the client surface this reason verbatim in the
            // write-fail toast (vs. the generic "Failed to save" copy). See #2330.
            error: { message: invokeResult.forbidden, code: "access-denied" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }

        try {
          enforceAllowAnonymous(invokeResult, userContext);
        } catch (err: unknown) {
          const reason = err instanceof ForbiddenError ? err.forbidden : String(err);
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: reason, code: "access-denied" },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }

        // Reject writes that place the doc in zero channels: the read gate
        // refuses any channel-less doc (no owner bypass), so persisting it
        // would create a doc unreadable by everyone, silently. Point the
        // builder at the existing channel+grant pattern. Doc-local check —
        // we do not chase the cross-doc grant graph here.
        if (!isReadableResult(invokeResult)) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: {
              code: "unreadable",
              message:
                "Unreadable write: access.js placed this doc in no channel, so no one can read it — not even its author. " +
                "Return a channel + grant. Private to author: " +
                "return { channels: [doc._id], grant: { users: { [user.userHandle]: [doc._id] } } }. " +
                "Public: return { channels: [doc._id], grant: { public: [doc._id] } }.",
            },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }

        accessResult = invokeResult;
      }

      const now = new Date().toISOString();
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

      // Notify subscribers of the doc change via per-vibe local fan-out.
      // When the access fn returns channels, notify per-channel only (not the
      // main dbName) so only channel-subscribed connections receive the event.
      if (vctx.notifyDocChanged) {
        const channels = normalizeChannels(accessResult?.channels ?? []);
        if (channels.length) {
          for (const channel of channels) {
            vctx
              .notifyDocChanged(
                { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId, channel },
                clientWsSend(ctx).connId
              )
              .catch((e: unknown) => console.error("DocNotify channel error:", e));
          }
        } else {
          vctx
            .notifyDocChanged({ ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId }, clientWsSend(ctx).connId)
            .catch((e: unknown) => console.error("DocNotify error:", e));
        }
      }

      // Store access fn output for future reduce queries
      if (accessResult && !("forbidden" in accessResult) && afbRow?.accessFnCid) {
        const tOutputs = vctx.sql.tables.accessFnOutputs;
        const outputHasGrants =
          (accessResult.members && Object.keys(accessResult.members).length > 0) ||
          (accessResult.grant?.users && Object.keys(accessResult.grant.users).length > 0) ||
          (accessResult.grant?.roles && Object.keys(accessResult.grant.roles).length > 0) ||
          (accessResult.grant?.public && accessResult.grant.public.length > 0)
            ? 1
            : 0;

        let effectiveViewerGrantsChanged = false;
        if (grantsReduceBefore) {
          const grantsReduceAfter = new GrantReduce();
          for (const [storedDocId, contribution] of grantsReduceBefore.docContributions) {
            grantsReduceAfter.addDoc(storedDocId, contribution);
          }
          if (outputHasGrants === 1) {
            grantsReduceAfter.addDoc(docId, extractContribution(accessResult));
          } else {
            grantsReduceAfter.removeDoc(docId);
          }
          effectiveViewerGrantsChanged = hasEffectiveViewerGrantDelta(grantsReduceBefore, grantsReduceAfter);
        }

        const rUpsert = await exception2Result(() =>
          vctx.sql.db
            .insert(tOutputs)
            .values({
              ownerHandle: req.ownerHandle,
              appSlug: req.appSlug,
              dbName: req.dbName,
              docId,
              fnCid: afbRow.accessFnCid,
              output: JSON.stringify(accessResult),
              hasGrants: outputHasGrants,
            })
            .onConflictDoUpdate({
              target: [tOutputs.ownerHandle, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
              set: {
                fnCid: afbRow.accessFnCid,
                output: JSON.stringify(accessResult),
                hasGrants: outputHasGrants,
              },
            })
        );
        if (rUpsert.isErr()) {
          console.error("AccessFnOutputs upsert failed:", rUpsert.Err());
          if (outputHasGrants === 1) {
            await ctx.send.send(ctx, {
              type: "vibes.diy.res-error",
              error: { message: "grant storage failed — retry the write" },
            } satisfies ResError);
            return Result.Ok(EventoResult.Continue);
          }
        } else if (effectiveViewerGrantsChanged && vctx.notifyViewerGrantsChanged) {
          vctx
            .notifyViewerGrantsChanged(
              {
                type: "vibes.diy.evt-viewer-grants-changed",
                ownerHandle: req.ownerHandle,
                appSlug: req.appSlug,
              } satisfies EvtViewerGrantsChanged,
              clientWsSend(ctx).connId
            )
            .catch((e: unknown) => console.error("Viewer grants notify error:", e));
        }
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
        const { access } = await checkDocAccess(vctx, userId, req.appSlug, req.ownerHandle, connectionAdminMode(ctx));
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

      // Notify subscribers of the doc change via per-vibe local fan-out. On access-fn vibes,
      // fan out per stored channel so channel-subscribed connections receive the
      // delete. Best-effort: if there's no binding or stored output row, fall back
      // to a single real-dbName notify (correct for no-access-fn vibes). Never block
      // the delete on this lookup.
      if (vctx.notifyDocChanged) {
        const senderConnId = clientWsSend(ctx).connId;
        let channels: string[] = [];
        try {
          const tAfb = vctx.sql.tables.accessFunctionBindings;
          const afbRow = await vctx.sql.db
            .select({ accessFnCid: tAfb.accessFnCid })
            .from(tAfb)
            .where(and(eq(tAfb.ownerHandle, req.ownerHandle), eq(tAfb.appSlug, req.appSlug), inArray(tAfb.dbName, [dbName, "*"])))
            .orderBy(sql`CASE WHEN ${tAfb.dbName} = ${dbName} THEN 0 ELSE 1 END`)
            .limit(1)
            .then((r) => r[0]);
          if (afbRow?.accessFnCid) {
            const tOut = vctx.sql.tables.accessFnOutputs;
            const outRow = await vctx.sql.db
              .select({ output: tOut.output })
              .from(tOut)
              .where(
                and(
                  eq(tOut.ownerHandle, req.ownerHandle),
                  eq(tOut.appSlug, req.appSlug),
                  eq(tOut.dbName, dbName),
                  eq(tOut.docId, req.docId)
                )
              )
              .limit(1)
              .then((r) => r[0]);
            if (outRow?.output) {
              const parsed = JSON.parse(outRow.output) as { channels?: string[] };
              channels = normalizeChannels(parsed.channels ?? []);
            }
          }
        } catch (e: unknown) {
          console.error("DocNotify delete channel lookup error:", e);
        }

        if (channels.length) {
          for (const channel of channels) {
            vctx
              .notifyDocChanged(
                { ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId: req.docId, channel },
                senderConnId
              )
              .catch((e: unknown) => console.error("DocNotify channel error:", e));
          }
        } else {
          vctx
            .notifyDocChanged({ ownerHandle: req.ownerHandle, appSlug: req.appSlug, dbName, docId: req.docId }, senderConnId)
            .catch((e: unknown) => console.error("DocNotify error:", e));
        }
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
