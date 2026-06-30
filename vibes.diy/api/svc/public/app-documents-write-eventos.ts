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
import { GrantReduce, extractContribution, newSeededReduce } from "./grant-reduce.js";
import { isFileMeta } from "./files-url-mint.js";
import { clientWsSend, connectionAdminMode } from "./app-documents-shared.js";
import { normalizeChannels } from "./normalize-channels.js";
import { emitBackendOnChange } from "../intern/emit-backend-onchange.js";
import { allocateAndInsertRevision, SeqConflictError } from "./seq-allocation.js";
import { docContentEqual } from "./doc-content-equal.js";
import type { VibesSqlite } from "@vibes.diy/api-sql";
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

      // Load the current head revision once when this is an update to a known
      // docId. Reused below as the access fn's `oldDoc` AND for the
      // content-identical no-op (#2644). A brand-new doc (client sent no docId)
      // can never be a no-op and has no prior revision, so skip the read.
      let headRow: { data: unknown; deleted: number } | undefined;
      if (req.docId) {
        const tDocs = vctx.sql.tables.appDocuments;
        headRow = await vctx.sql.db
          .select({ data: tDocs.data, deleted: tDocs.deleted })
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
      }

      // Fail closed: a doc bound to an access function must NOT be written if no
      // invoker is available — otherwise a missing/misconfigured invoker would
      // silently bypass access enforcement (the `&& vctx.invokeAccessFn` guard
      // below would just skip the whole check). Every production context that can
      // run this handler supplies a local invoker; this is defense in depth so a
      // future regression fails safe rather than open. (#2265 A2b)
      if (afbRow?.accessFnCid && !vctx.invokeAccessFn) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access function unavailable" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

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

        // Existing doc so the access fn can enforce update-ownership checks.
        // Loaded once above as headRow (reused by the no-op check below).
        const oldDoc: unknown | null = headRow?.data ?? null;

        // Resolve the access.js source. The source is content-addressed and
        // immutable per CID, so cache the raw bytes on the DO keyed by CID — a
        // hit can never go stale. Only the first write for a given CID pays the
        // storage (R2) round-trip (handles SQL and R2 transparently); subsequent
        // writes reuse it, removing the per-write access tax. Mirrors the per-DO
        // QuickJS module cache (localInvokeAccessFn). See #2512.
        let accessFnSource: string | undefined;
        let rawSource = vctx.accessFnSourceCache?.get(fnCid);
        if (rawSource === undefined && afbRow.accessFnAssetUri) {
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
            rawSource = new TextDecoder().decode(merged);
            vctx.accessFnSourceCache?.set(fnCid, rawSource);
          }
        }
        // extractExportSource is dbName-dependent (cheap, in-memory string work),
        // so it runs per write against the cached raw source rather than caching
        // the extracted result — the CID-keyed cache only elides the R2 fetch.
        if (rawSource !== undefined) {
          accessFnSource = extractExportSource(rawSource, afbRow.dbName) ?? rawSource;
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

        const reduce = newSeededReduce(req.ownerHandle);
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

      // Content-identical no-op (#2644). Once the write has passed the access
      // gate, if it re-asserts the EXACT content of the live head revision,
      // absorb it: no new revision, no clock entry, no AccessFnOutputs rewrite,
      // and no doc-changed / grants-changed fan-out — return the existing doc id
      // as success. This makes the "re-assert my access setup on every page
      // load" pattern (#2631 self-grants / owner-roster grants) free when
      // nothing changed, so codegen can emit the idempotent form without a
      // read-guard that races sync (#2026). Preconditions: a stable docId (a
      // random-id put has no head and never matches) and a non-tombstone head (a
      // put over a deleted doc is a resurrection, which must mint a real
      // revision). The gate still ran, so access is enforced identically to a
      // real write. Note: the stored access-fn output is left untouched on a
      // no-op. An access.js REDEPLOY still refreshes outputs for unchanged docs —
      // processAccessBindings' backfill re-invokes the fn per doc on a CID change
      // — so that path is unaffected. The only drift is a context-dependent
      // output (logic keyed on user / grantState / oldDoc rather than doc
      // content), which won't be recomputed on a content-identical put.
      //
      // `headRow` is a PRE-LOCK read used only to decide whether a no-op is even
      // plausible; the binding decision happens under the per-doc lock via the
      // `skipIf` predicate below, which re-reads the SERIALIZED current head. So
      // if a concurrent writer commits a different revision between this read and
      // the lock, the in-lock content no longer matches and this write proceeds
      // normally instead of dropping it (Codex P1).
      const mightNoop = !!headRow && headRow.deleted !== 1 && docContentEqual(headRow.data, req.doc);

      const now = new Date().toISOString();
      const dbName = req.dbName;
      const t = vctx.sql.tables.appDocuments;

      // Store-access-fn-output sidecar: keyed only by (owner, app, db, docId)
      // with no seq, so it must run inside the same critical section as the seq
      // insert (under the pg advisory lock) or concurrent same-doc writes can
      // leave grants reflecting the losing revision (#2506, Codex P1).
      const storeAccessOutput =
        accessResult && !("forbidden" in accessResult) && afbRow?.accessFnCid
          ? {
              tOutputs: vctx.sql.tables.accessFnOutputs,
              fnCid: afbRow.accessFnCid,
              descriptor: accessResult,
              outputHasGrants:
                (accessResult.members && Object.keys(accessResult.members).length > 0) ||
                (accessResult.grant?.users && Object.keys(accessResult.grant.users).length > 0) ||
                (accessResult.grant?.roles && Object.keys(accessResult.grant.roles).length > 0) ||
                (accessResult.grant?.public && accessResult.grant.public.length > 0)
                  ? 1
                  : 0,
            }
          : undefined;

      let grantUpsertErr: Error | undefined;
      const sidecar = storeAccessOutput
        ? async (_seq: number, exec: VibesSqlite) => {
            const rUpsert = await exception2Result(() =>
              exec
                .insert(storeAccessOutput.tOutputs)
                .values({
                  ownerHandle: req.ownerHandle,
                  appSlug: req.appSlug,
                  dbName: req.dbName,
                  docId,
                  fnCid: storeAccessOutput.fnCid,
                  output: JSON.stringify(storeAccessOutput.descriptor),
                  hasGrants: storeAccessOutput.outputHasGrants,
                })
                .onConflictDoUpdate({
                  target: [
                    storeAccessOutput.tOutputs.ownerHandle,
                    storeAccessOutput.tOutputs.appSlug,
                    storeAccessOutput.tOutputs.dbName,
                    storeAccessOutput.tOutputs.docId,
                  ],
                  set: {
                    fnCid: storeAccessOutput.fnCid,
                    output: JSON.stringify(storeAccessOutput.descriptor),
                    hasGrants: storeAccessOutput.outputHasGrants,
                  },
                })
            );
            if (rUpsert.isErr()) grantUpsertErr = rUpsert.Err();
          }
        : undefined;

      // Only pay for the in-lock recheck when a no-op is actually plausible
      // (pre-lock content already matched). For the common case — a real change —
      // skipIf is undefined and the fast insert path is untouched. The predicate
      // re-reads the serialized head under the lock and absorbs the write only if
      // it STILL matches there (a tombstone or a moved head both fall through).
      const skipIf = mightNoop
        ? async (exec: VibesSqlite) => {
            const cur = await exec
              .select({ data: t.data, deleted: t.deleted })
              .from(t)
              .where(and(eq(t.ownerHandle, req.ownerHandle), eq(t.appSlug, req.appSlug), eq(t.dbName, dbName), eq(t.docId, docId)))
              .orderBy(desc(t.seq))
              .limit(1)
              .then((r) => r[0]);
            return !!cur && cur.deleted !== 1 && docContentEqual(cur.data, req.doc);
          }
        : undefined;

      // Allocate seq + insert atomically. On a (near-impossible) exhausted-retry
      // conflict, surface a typed error instead of a raw SQL string.
      let alloc: { seq: number; inserted: boolean };
      try {
        alloc = await allocateAndInsertRevision({
          db: vctx.sql.db,
          flavour: vctx.sql.flavour,
          table: t,
          row: {
            ownerHandle: req.ownerHandle,
            appSlug: req.appSlug,
            dbName,
            docId,
            userId: userId ?? "unknown",
            data: req.doc,
            deleted: 0,
            created: now,
          },
          skipIf,
          sidecar,
        });
      } catch (err) {
        if (err instanceof SeqConflictError) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { code: "conflict", message: `write conflict: head is at seq ${err.currentHeadSeq}, retry the write` },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
        throw err;
      }

      // Content-identical no-op absorbed under the lock (#2644): no revision was
      // written, so skip every downstream side effect (DM index, comment event,
      // doc-changed / grants-changed fan-out) and return the existing doc id.
      if (!alloc.inserted) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-put-doc",
          status: "ok",
          id: docId,
        } satisfies ResPutDoc);
        return Result.Ok(EventoResult.Continue);
      }
      const nextSeq = alloc.seq;

      // Per-app backend.js onChange (#2856 B5). Fire-and-forget after the commit;
      // dark unless BACKEND_JS=loader, so this is a no-op on the write path today.
      await emitBackendOnChange(vctx, {
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        dbName,
        docId,
        seq: nextSeq,
        deleted: false,
        doc: req.doc,
        originDepth: (req as { backendOrigin?: { depth?: number } }).backendOrigin?.depth ?? 0,
        writerUserId: userId,
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

      // Grant-state bookkeeping for the access-fn output written by the sidecar
      // above (inside the seq critical section). The notify fan-out stays here,
      // outside the lock/txn.
      if (storeAccessOutput) {
        let effectiveViewerGrantsChanged = false;
        if (grantsReduceBefore) {
          // Seed grantsReduceAfter the SAME way as grantsReduceBefore (which was
          // built via newSeededReduce). The owner seed lives outside
          // docContributions, so replaying only the contributions below would
          // drop it — leaving before seeded and after not would make the owner's
          // reserved role look like it vanished and spuriously trip the delta.
          const grantsReduceAfter = newSeededReduce(req.ownerHandle);
          for (const [storedDocId, contribution] of grantsReduceBefore.docContributions) {
            grantsReduceAfter.addDoc(storedDocId, contribution);
          }
          if (storeAccessOutput.outputHasGrants === 1) {
            grantsReduceAfter.addDoc(docId, extractContribution(storeAccessOutput.descriptor));
          } else {
            grantsReduceAfter.removeDoc(docId);
          }
          effectiveViewerGrantsChanged = hasEffectiveViewerGrantDelta(grantsReduceBefore, grantsReduceAfter);
        }

        if (grantUpsertErr) {
          console.error("AccessFnOutputs upsert failed:", grantUpsertErr);
          if (storeAccessOutput.outputHasGrants === 1) {
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

      // Resolve the EFFECTIVE access-fn binding for this db (named dbName beats
      // the wildcard '*'). Stored AccessFnOutputs rows are NOT cleaned up when a
      // binding goes away — processAccessBindings drops AccessFunctionBindings
      // when /access.js is deleted but leaves the output rows behind. So a doc's
      // stored output can be stale (no live binding, or a superseded fnCid). We
      // gate the notify decisions below on a live binding whose fnCid matches the
      // stored row, mirroring resolveGrants in who-am-i; otherwise the delete is
      // treated as non-channelized and falls back to the bare dbName notify that
      // current subscribers use (Charlie). The row itself is still dropped
      // unconditionally — that is the actual revocation (#2531).
      const tAfb = vctx.sql.tables.accessFunctionBindings;
      const afbRow = await vctx.sql.db
        .select({ accessFnCid: tAfb.accessFnCid })
        .from(tAfb)
        .where(and(eq(tAfb.ownerHandle, req.ownerHandle), eq(tAfb.appSlug, req.appSlug), inArray(tAfb.dbName, [dbName, "*"])))
        .orderBy(sql`CASE WHEN ${tAfb.dbName} = ${dbName} THEN 0 ELSE 1 END`)
        .limit(1)
        .then((r) => r[0]);
      const effectiveFnCid = afbRow?.accessFnCid;

      const tOutputs = vctx.sql.tables.accessFnOutputs;
      let deletedDocHadGrants = false;
      let channels: string[] = [];

      // Sidecar: read THEN drop this doc's AccessFnOutputs row in the SAME
      // critical section as the tombstone insert (under the pg advisory lock /
      // sqlite write lock), mirroring the put path's sidecar. Reading here —
      // rather than before allocateAndInsertRevision — means a racing same-doc
      // put has already serialized on the lock, so `channels` and
      // `deletedDocHadGrants` reflect the output left by the revision this
      // delete is tombstoning, not a stale pre-lock snapshot (Codex P2).
      // Dropping the row is what actually revokes the grant: resolveGrants in
      // who-am-i reduces over stored outputs, so once it's gone the grant stops
      // applying.
      const deleteOutputSidecar = async (_seq: number, exec: VibesSqlite) => {
        const outRow = await exec
          .select({ output: tOutputs.output, hasGrants: tOutputs.hasGrants, fnCid: tOutputs.fnCid })
          .from(tOutputs)
          .where(
            and(
              eq(tOutputs.ownerHandle, req.ownerHandle),
              eq(tOutputs.appSlug, req.appSlug),
              eq(tOutputs.dbName, dbName),
              eq(tOutputs.docId, req.docId)
            )
          )
          .limit(1)
          .then((r) => r[0]);
        // Only trust the stored output for notify decisions when it belongs to
        // the live binding; a stale row (binding removed, or superseded fnCid)
        // must not channelize the delete or fire a spurious grants-changed.
        const outputIsLive = effectiveFnCid !== undefined && outRow?.fnCid === effectiveFnCid;
        if (outputIsLive) {
          deletedDocHadGrants = outRow.hasGrants === 1;
          if (outRow.output) {
            try {
              const parsed = JSON.parse(outRow.output) as { channels?: string[] };
              channels = normalizeChannels(parsed.channels ?? []);
            } catch (e: unknown) {
              console.error("DocNotify delete channel parse error:", e);
            }
          }
        }
        await exec
          .delete(tOutputs)
          .where(
            and(
              eq(tOutputs.ownerHandle, req.ownerHandle),
              eq(tOutputs.appSlug, req.appSlug),
              eq(tOutputs.dbName, dbName),
              eq(tOutputs.docId, req.docId)
            )
          );
      };

      // Insert tombstone. Shares the same per-doc lock key as putDoc (derived
      // from owner/app/db/docId) so a delete cannot interleave a put (#2506).
      let delAlloc: { seq: number; inserted: boolean };
      try {
        delAlloc = await allocateAndInsertRevision({
          db: vctx.sql.db,
          flavour: vctx.sql.flavour,
          table: t,
          row: {
            ownerHandle: req.ownerHandle,
            appSlug: req.appSlug,
            dbName,
            docId: req.docId,
            userId: req._auth.verifiedAuth.claims.userId,
            data: {},
            deleted: 1,
            created: now,
          },
          sidecar: deleteOutputSidecar,
        });
      } catch (err) {
        if (err instanceof SeqConflictError) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { code: "conflict", message: `write conflict: head is at seq ${err.currentHeadSeq}, retry the delete` },
          } satisfies ResError);
          return Result.Ok(EventoResult.Continue);
        }
        throw err;
      }

      // Per-app backend.js onChange (#2856 B5) for the delete path — a tombstone
      // commit fires onChange too (deleted:true, prior doc as oldDoc). Dark unless
      // BACKEND_JS=loader; fire-and-forget. Skip if no revision was written.
      if (delAlloc.inserted) {
        await emitBackendOnChange(vctx, {
          ownerHandle: req.ownerHandle,
          appSlug: req.appSlug,
          dbName,
          docId: req.docId,
          seq: delAlloc.seq,
          deleted: true,
          doc: {},
          originDepth: (req as { backendOrigin?: { depth?: number } }).backendOrigin?.depth ?? 0,
          writerUserId: req._auth.verifiedAuth.claims.userId,
        });
      }

      // Notify subscribers of the doc change via per-vibe local fan-out. On access-fn vibes,
      // fan out per stored channel so channel-subscribed connections receive the
      // delete. `channels` was read from the doc's stored output BEFORE the
      // tombstone insert (the sidecar has since dropped that row). Fall back to a
      // single real-dbName notify when there was no stored output (no-access-fn
      // vibes, or a doc that never carried channels).
      if (vctx.notifyDocChanged) {
        const senderConnId = clientWsSend(ctx).connId;
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

      // If the deleted doc was carrying grants, removing it changes effective
      // grants — push EvtViewerGrantsChanged so connected viewers re-resolve
      // who-am-i and drop the now-revoked role/channel (#2531). Mirrors the put
      // path's notify. Best-effort: never block the delete on the fan-out.
      if (deletedDocHadGrants && vctx.notifyViewerGrantsChanged) {
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

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-delete-doc",
        status: "ok",
        id: req.docId,
      } satisfies ResDeleteDoc);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
