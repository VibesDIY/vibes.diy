import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  EvtNewFsId,
  MsgBase,
  reqPublishApp,
  ReqPublishApp,
  ResPublishApp,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, eq } from "drizzle-orm/sql/expressions";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { calcEntryPointUrl } from "../entry-point-utils.js";
import { selectLatestDraftOrPublished } from "./select-app.js";
import { mintProductionRelease } from "./app-seq-allocation.js";
import { publishAccessBindings } from "../intern/process-access-bindings.js";
import type { FileSystemItem } from "@vibes.diy/api-types";

// Publish an app's draft to production (#2772 D2). Owner-only. The chosen content
// is re-released as a NEW top-of-stack production row (`releaseSeq = MAX+1`) — old
// production stays as history (no demote), so this is uniform for both the latest
// dev (the switch's common case) and an explicit older `fsId` (CLI/`versions`).
export async function publishApp(vctx: VibesApiSQLCtx, req: ReqPublishApp, userId: string): Promise<Result<ResPublishApp>> {
  // 1. Resolve the content to publish. An explicit `fsId` is the "publish a
  //    specific version" path; otherwise publish the owner's latest row across
  //    modes (the latest dev draft, selected atomically — D1's resolver).
  let target: typeof vctx.sql.tables.apps.$inferSelect | undefined;
  if (req.fsId) {
    target = await vctx.sql.db
      .select()
      .from(vctx.sql.tables.apps)
      .where(
        and(
          eq(vctx.sql.tables.apps.fsId, req.fsId),
          eq(vctx.sql.tables.apps.appSlug, req.appSlug),
          eq(vctx.sql.tables.apps.ownerHandle, req.ownerHandle)
        )
      )
      .limit(1)
      .then((r) => r[0]);
  } else {
    target = await selectLatestDraftOrPublished(vctx, { ownerHandle: req.ownerHandle, appSlug: req.appSlug });
  }
  if (!target) {
    return Result.Err("app-not-found");
  }

  // 2. Owner-only: the caller must own the row being published. (Ownership is
  //    immutable per app, so this read can be outside the mint lock; the mint
  //    re-resolves the actual target atomically — see mintProductionRelease.)
  if (target.userId !== userId) {
    return Result.Err("not-owner");
  }

  // 3. Mint a new top-of-stack production release (or a no-op when the target is
  //    already the highest production — "up to date"). The target is re-resolved
  //    INSIDE the lock: for the no-`fsId` case the latest row is selected atomically
  //    so a concurrent codegen write can't slip a different draft in (Codex review).
  const rMint = await exception2Result(() =>
    mintProductionRelease({
      db: vctx.sql.db,
      flavour: vctx.sql.flavour,
      appSlug: req.appSlug,
      userId,
      ownerHandle: req.ownerHandle,
      created: new Date().toISOString(),
      ...(req.fsId ? { fsId: req.fsId } : {}),
    })
  );
  if (rMint.isErr()) {
    return Result.Err(`publish-app: failed to mint production release: ${rMint.Err().message}`);
  }
  const mint = rMint.Ok();

  // 3b. Re-bind the live access function to the published version's access.js
  //     (#2902). Publishing is the consent step: dev drafts left the binding
  //     untouched, so the binding here may still reflect a prior published
  //     version (or nothing). Resolve the published fsId's stored filesystem and
  //     re-bind from it. Parity with ensureAppSlugItem: a binding failure is
  //     logged, not fatal — a stale binding keeps the OLD published policy
  //     (fail-closed), never a draft's.
  const publishedRow =
    target.fsId === mint.fsId
      ? target
      : await vctx.sql.db
          .select({ fileSystem: vctx.sql.tables.apps.fileSystem })
          .from(vctx.sql.tables.apps)
          .where(
            and(
              eq(vctx.sql.tables.apps.ownerHandle, req.ownerHandle),
              eq(vctx.sql.tables.apps.appSlug, req.appSlug),
              eq(vctx.sql.tables.apps.fsId, mint.fsId)
            )
          )
          .limit(1)
          .then((r) => r[0]);
  if (publishedRow) {
    const rBind = await publishAccessBindings(vctx, {
      ownerHandle: req.ownerHandle,
      appSlug: req.appSlug,
      fileSystem: publishedRow.fileSystem as FileSystemItem[],
    });
    if (rBind.isErr()) {
      console.warn(`publishApp: access binding re-bind failed for ${req.ownerHandle}/${req.appSlug}:`, rBind.Err());
    }
  } else {
    console.warn(`publishApp: could not resolve published filesystem for ${req.ownerHandle}/${req.appSlug} fsId=${mint.fsId}`);
  }

  // 4. Emit evt-new-fs-id with parity to other production updates (Discord,
  //    caches, recency) — only when the served latest actually changed.
  if (mint.released) {
    const entryPointUrl = calcEntryPointUrl({
      ...vctx.params.vibes.svc,
      bindings: { ownerHandle: req.ownerHandle, appSlug: req.appSlug, fsId: mint.fsId },
    });
    await vctx.postQueue({
      payload: {
        type: "vibes.diy.evt-new-fs-id",
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        fsId: mint.fsId,
        vibeUrl: entryPointUrl,
        sessionToken: "offline",
        mode: "production",
      },
      tid: "queue-event",
      src: "publishApp",
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtNewFsId>);
  }

  return Result.Ok({
    type: "vibes.diy.res-publish-app",
    appSlug: req.appSlug,
    ownerHandle: req.ownerHandle,
    fsId: mint.fsId,
    releaseSeq: mint.releaseSeq,
    mode: "production",
    published: mint.released,
  } satisfies ResPublishApp);
}

export const publishAppEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqPublishApp>, ResPublishApp | VibesDiyError> = {
  hash: "publish-app",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqPublishApp(msg.payload);
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqPublishApp>>, ResPublishApp | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rRes = await publishApp(vctx, req as unknown as ReqPublishApp, req._auth.verifiedAuth.claims.userId);
      if (rRes.isErr()) {
        return Result.Err(rRes);
      }
      await ctx.send.send(ctx, rRes.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
