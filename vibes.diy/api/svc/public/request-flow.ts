import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  ReqListRequestGrants,
  ResListRequestGrants,
  ReqRequestAccess,
  ResRequestAccess,
  ReqApproveRequest,
  ResApproveRequest,
  ReqRequestSetRole,
  ResRequestSetRole,
  ReqRevokeRequest,
  ResRevokeRequest,
  ReqHasAccessRequest,
  ResHasAccessRequest,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  isReqListRequestGrants,
  isReqRequestAccess,
  isReqApproveRequest,
  isReqRequestSetRole,
  isReqRevokeRequest,
  isReqHasAccessRequest,
  isEnableRequest,
  ActiveEntry,
  ResRequestAccessError,
  ResRequestAccessApproved,
  ResRequestAccessPending,
  ResApproveRequestError,
  ResRequestSetRoleError,
  ResFlowOwnerError,
  ForeignInfo,
  isResHasAccessRequestPending,
  isResHasAccessRequestApproved,
  isResHasAccessRequestRevoked,
  ClerkClaim,
  EvtRequestGrant,
  Role,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, lt, desc } from "drizzle-orm/sql/expressions";
import { type SQL } from "drizzle-orm/sql";
import { type } from "arktype";

async function sendUpdateEvent(vctx: VibesApiSQLCtx, value: Omit<EvtRequestGrant, "type">) {
  await vctx.postQueue({
    payload: { ...value, type: "vibes.diy.evt-request-grant" },
    tid: "queue-event",
    src: "request-flow",
    dst: "vibes-service",
    ttl: 1,
  } satisfies MsgBase<EvtRequestGrant>);
}

export async function approveAllPendingRequests(
  vctx: VibesApiSQLCtx,
  ref: { userId: string; appSlug: string; userSlug: string },
  role: Role
): Promise<Result<number>> {
  const now = new Date().toISOString();

  const rUpd = await exception2Result(() =>
    vctx.sql.db
      .update(vctx.sql.tables.requestGrants)
      .set({ state: "approved", role, updated: now })
      .where(
        and(
          eq(vctx.sql.tables.requestGrants.userId, ref.userId),
          eq(vctx.sql.tables.requestGrants.appSlug, ref.appSlug),
          eq(vctx.sql.tables.requestGrants.userSlug, ref.userSlug),
          eq(vctx.sql.tables.requestGrants.state, "pending")
        )
      )
      .returning({
        foreignUserId: vctx.sql.tables.requestGrants.foreignUserId,
        foreignInfo: vctx.sql.tables.requestGrants.foreignInfo,
        created: vctx.sql.tables.requestGrants.created,
      })
  );
  if (rUpd.isErr()) return Result.Err(rUpd);
  const updated = rUpd.Ok();

  for (const row of updated) {
    await sendUpdateEvent(vctx, {
      op: "upsert",
      userId: ref.userId,
      grant: {
        type: "vibes.diy.res-request-access",
        appSlug: ref.appSlug,
        userSlug: ref.userSlug,
        foreignUserId: row.foreignUserId,
        foreignInfo: row.foreignInfo as ForeignInfo,
        role,
        state: "approved",
        updated: now,
        created: row.created,
      },
    });
  }

  return Result.Ok(updated.length);
}

export async function hasAccessRequest(
  vctx: VibesApiSQLCtx,
  req: { foreignUserId: string; appSlug: string; userSlug: string }
): Promise<Result<ResHasAccessRequest | ResFlowOwnerError>> {
  const ownerRows = await vctx.sql.db
    .select({ userId: vctx.sql.tables.userSlugBinding.userId })
    .from(vctx.sql.tables.userSlugBinding)
    .where(eq(vctx.sql.tables.userSlugBinding.userSlug, req.userSlug))
    .limit(1);

  if (ownerRows[0]?.userId === req.foreignUserId) {
    return Result.Ok({
      type: "vibes.diy.error",
      message: `owner cannot check own app access: ${req.userSlug}/${req.appSlug}`,
      code: "owner-error",
    } satisfies ResFlowOwnerError);
  }

  return exception2Result(() =>
    vctx.sql.db
      .select({
        state: vctx.sql.tables.requestGrants.state,
        role: vctx.sql.tables.requestGrants.role,
        appSlug: vctx.sql.tables.requestGrants.appSlug,
        userSlug: vctx.sql.tables.requestGrants.userSlug,
      })
      .from(vctx.sql.tables.requestGrants)
      .where(
        and(
          eq(vctx.sql.tables.requestGrants.foreignUserId, req.foreignUserId),
          eq(vctx.sql.tables.requestGrants.appSlug, req.appSlug),
          eq(vctx.sql.tables.requestGrants.userSlug, req.userSlug)
        )
      )
      .limit(1)
      .then((rows) => {
        const row = { type: "vibes.diy.res-has-access-request" as const, ...rows[0] };
        switch (true) {
          case isResHasAccessRequestPending(row):
          case isResHasAccessRequestApproved(row):
          case isResHasAccessRequestRevoked(row):
            // console.log(`hasAccessRequest: !not-found`, row);
            return row;
          default:
            // console.log(`hasAccessRequest: not-found`, row);
            return {
              type: "vibes.diy.res-has-access-request" as const,
              state: "not-found" as const,
              appSlug: req.appSlug,
              userSlug: req.userSlug,
            };
        }
      })
  );
}

export const hasAccessRequestEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqHasAccessRequest>,
  ResHasAccessRequest | VibesDiyError
> = {
  hash: "has-access-request",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqHasAccessRequest(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqHasAccessRequest }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqHasAccessRequest>>,
        ResHasAccessRequest | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const foreignUserId = req._auth.verifiedAuth.claims.userId;

      const rRow = await hasAccessRequest(vctx, { foreignUserId, appSlug: req.appSlug, userSlug: req.userSlug });
      if (rRow.isErr()) return Result.Err(rRow);
      await ctx.send.send(ctx, rRow.Ok());

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export async function requestAccess(
  vctx: VibesApiSQLCtx,
  req: { foreignUserId: string; appSlug: string; userSlug: string; claims: ClerkClaim }
): Promise<Result<ResRequestAccess | ResRequestAccessError | ResFlowOwnerError>> {
  const now = new Date().toISOString();

  const rSettings = await exception2Result(() =>
    vctx.sql.db
      .select({
        userId: vctx.sql.tables.userSlugBinding.userId,
        settings: vctx.sql.tables.appSettings.settings,
      })
      .from(vctx.sql.tables.userSlugBinding)
      .leftJoin(
        vctx.sql.tables.appSettings,
        and(
          eq(vctx.sql.tables.appSettings.userSlug, vctx.sql.tables.userSlugBinding.userSlug),
          eq(vctx.sql.tables.appSettings.appSlug, req.appSlug)
        )
      )
      .where(eq(vctx.sql.tables.userSlugBinding.userSlug, req.userSlug))
      .limit(1)
      .then((r) => r[0])
  );
  if (rSettings.isErr()) return Result.Err(rSettings);
  const record = rSettings.Ok();
  if (!record) {
    return Result.Ok({
      type: "vibes.diy.error",
      message: `app not found: ${req.userSlug}/${req.appSlug}`,
      code: "request-access-app-not-found",
    } satisfies ResRequestAccessError);
  }

  if (record.userId === req.foreignUserId) {
    return Result.Ok({
      type: "vibes.diy.error",
      message: `owner cannot request access to own app: ${req.userSlug}/${req.appSlug}`,
      code: "owner-error",
    } satisfies ResFlowOwnerError);
  }

  const settings = (record.settings ?? []) as ActiveEntry[];
  const enableRequest = settings.find(isEnableRequest);
  if (!enableRequest?.enable) {
    return Result.Ok({
      type: "vibes.diy.error",
      message: `access requests not enabled for ${req.userSlug}/${req.appSlug}`,
      code: "request-access-not-enabled",
    } satisfies ResRequestAccessError);
  }

  const autoAcceptRole = enableRequest.autoAcceptRole;
  const state = autoAcceptRole ? "approved" : "pending";
  const role = autoAcceptRole ?? undefined;
  const foreignInfo: ForeignInfo = { claims: req.claims };

  const rIns = await exception2Result(() =>
    vctx.sql.db
      .insert(vctx.sql.tables.requestGrants)
      .values({
        userId: record.userId,
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        state,
        role: role ?? null,
        foreignUserId: req.foreignUserId,
        foreignInfo,
        tick: "0",
        updated: now,
        created: now,
      })
      .onConflictDoUpdate({
        target: [
          vctx.sql.tables.requestGrants.userId,
          vctx.sql.tables.requestGrants.appSlug,
          vctx.sql.tables.requestGrants.userSlug,
          vctx.sql.tables.requestGrants.foreignUserId,
        ],
        set: { foreignInfo, updated: now },
      })
  );
  if (rIns.isErr()) return Result.Err(rIns);

  const base = {
    type: "vibes.diy.res-request-access" as const,
    appSlug: req.appSlug,
    userSlug: req.userSlug,
    foreignUserId: req.foreignUserId,
    foreignInfo,
    updated: now,
    created: now,
  };

  if (autoAcceptRole) {
    const r = { ...base, state: "approved" as const, role: autoAcceptRole } satisfies ResRequestAccessApproved;

    await sendUpdateEvent(vctx, { op: "upsert", userId: record.userId, grant: r });

    return Result.Ok(r);
  }
  const r = { ...base, state: "pending" as const } satisfies ResRequestAccessPending;
  await sendUpdateEvent(vctx, { op: "upsert", userId: record.userId, grant: r });
  return Result.Ok(r);
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const requestAccessEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqRequestAccess>, ResRequestAccess | VibesDiyError> = {
  hash: "request-access",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqRequestAccess(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqRequestAccess }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqRequestAccess>>, ResRequestAccess | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const foreignUserId = req._auth.verifiedAuth.claims.userId;
      const claims = req._auth.verifiedAuth.claims;

      const rResult = await requestAccess(vctx, { foreignUserId, appSlug: req.appSlug, userSlug: req.userSlug, claims });
      if (rResult.isErr()) return Result.Err(rResult);
      await ctx.send.send(ctx, rResult.Ok());

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const listRequestGrantsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListRequestGrants>,
  ResListRequestGrants | VibesDiyError
> = {
  hash: "list-request-grants",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqListRequestGrants(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqListRequestGrants }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqListRequestGrants>>,
        ResListRequestGrants | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const limit = Math.min(req.pager.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

      const conditions: SQL[] = [
        eq(vctx.sql.tables.requestGrants.userId, userId),
        eq(vctx.sql.tables.requestGrants.appSlug, req.appSlug),
        eq(vctx.sql.tables.requestGrants.userSlug, req.userSlug),
      ];
      if (req.pager.cursor) {
        conditions.push(lt(vctx.sql.tables.requestGrants.created, req.pager.cursor));
      }
      // console.log(`listRequestGrantsEvento: conditions`, conditions, `limit`, limit);
      const rows = await vctx.sql.db
        .select({
          foreignUserId: vctx.sql.tables.requestGrants.foreignUserId,
          state: vctx.sql.tables.requestGrants.state,
          role: vctx.sql.tables.requestGrants.role,
          foreignInfo: vctx.sql.tables.requestGrants.foreignInfo,
          tick: vctx.sql.tables.requestGrants.tick,
          updated: vctx.sql.tables.requestGrants.updated,
          created: vctx.sql.tables.requestGrants.created,
        })
        .from(vctx.sql.tables.requestGrants)
        .where(and(...conditions))
        .orderBy(desc(vctx.sql.tables.requestGrants.created))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      const possible = ResListRequestGrants({
        type: "vibes.diy.res-list-request-grants",
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        items: items as ResListRequestGrants["items"],
        ...(hasMore ? { nextCursor: items[items.length - 1].created } : {}),
      } satisfies ResListRequestGrants);
      if (possible instanceof type.errors) {
        console.error("ResListRequestGrants validation error:", possible.summary);
      } else {
        // console.log(`listRequestGrantsEvento: conditions`, conditions, `limit`, limit, `rows`, rows.length);
        await ctx.send.send(ctx, possible);
      }

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const approveRequestEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqApproveRequest>,
  ResApproveRequest | VibesDiyError
> = {
  hash: "approve-request",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqApproveRequest(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqApproveRequest }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqApproveRequest>>, ResApproveRequest | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const now = new Date().toISOString();

      const where = and(
        eq(vctx.sql.tables.requestGrants.userId, userId),
        eq(vctx.sql.tables.requestGrants.appSlug, req.appSlug),
        eq(vctx.sql.tables.requestGrants.userSlug, req.userSlug),
        eq(vctx.sql.tables.requestGrants.foreignUserId, req.foreignUserId)
      );

      const existing = await vctx.sql.db
        .select({
          foreignUserId: vctx.sql.tables.requestGrants.foreignUserId,
          foreignInfo: vctx.sql.tables.requestGrants.foreignInfo,
        })
        .from(vctx.sql.tables.requestGrants)
        .where(where)
        .limit(1);

      if (!existing[0]) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: `approve-request: not found ${req.userSlug}/${req.appSlug}/${req.foreignUserId}`,
          code: "approve-request-not-found",
        } satisfies ResApproveRequestError);
        return Result.Ok(EventoResult.Continue);
      }

      const rUpd = await exception2Result(() =>
        vctx.sql.db.update(vctx.sql.tables.requestGrants).set({ state: "approved", role: req.role, updated: now }).where(where)
      );
      if (rUpd.isErr()) return Result.Err(rUpd);

      const r = {
        type: "vibes.diy.res-approve-request",
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        foreignUserId: req.foreignUserId,
        role: req.role,
        state: "approved",
        updated: now,
      } satisfies ResApproveRequest;

      await sendUpdateEvent(vctx, {
        op: "upsert",
        userId,
        grant: {
          type: "vibes.diy.res-request-access",
          appSlug: req.appSlug,
          userSlug: req.userSlug,
          foreignUserId: req.foreignUserId,
          role: req.role,
          state: "approved",
          foreignInfo: existing[0].foreignInfo as ForeignInfo,
          updated: now,
          created: now,
        },
      });

      await ctx.send.send(ctx, r);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const requestSetRoleEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqRequestSetRole>,
  ResRequestSetRole | VibesDiyError
> = {
  hash: "request-set-role",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqRequestSetRole(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqRequestSetRole }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqRequestSetRole>>, ResRequestSetRole | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const now = new Date().toISOString();

      const where = and(
        eq(vctx.sql.tables.requestGrants.userId, userId),
        eq(vctx.sql.tables.requestGrants.appSlug, req.appSlug),
        eq(vctx.sql.tables.requestGrants.userSlug, req.userSlug),
        eq(vctx.sql.tables.requestGrants.foreignUserId, req.foreignUserId)
      );

      const existing = await vctx.sql.db
        .select({
          foreignUserId: vctx.sql.tables.requestGrants.foreignUserId,
          state: vctx.sql.tables.requestGrants.state,
          foreignInfo: vctx.sql.tables.requestGrants.foreignInfo,
        })
        .from(vctx.sql.tables.requestGrants)
        .where(where)
        .limit(1)
        .then((rows) => rows[0]);

      if (!existing) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: `request-set-role: not found ${req.userSlug}/${req.appSlug}/${req.foreignUserId}`,
          code: "request-set-role-not-found",
        } satisfies ResRequestSetRoleError);
        return Result.Ok(EventoResult.Continue);
      }

      const rUpd = await exception2Result(() =>
        vctx.sql.db.update(vctx.sql.tables.requestGrants).set({ role: req.role, updated: now }).where(where)
      );
      if (rUpd.isErr()) return Result.Err(rUpd);

      const r = {
        type: "vibes.diy.res-request-set-role",
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        foreignUserId: req.foreignUserId,
        role: req.role,
      } satisfies ResRequestSetRole;

      await sendUpdateEvent(vctx, {
        op: "upsert",
        userId,
        grant: {
          type: "vibes.diy.res-request-access",
          appSlug: req.appSlug,
          userSlug: req.userSlug,
          foreignUserId: req.foreignUserId,
          role: req.role,
          state: existing.state as ResRequestAccess["state"],
          foreignInfo: existing.foreignInfo as ForeignInfo,
          updated: now,
          created: now,
        },
        // foreignUserId: req.foreignUserId,
        // state: existing[0].state as EvtRequestGrant['grant']["state"],
        // role: req.role as EvtRequestGrant['grant]["role"],
        // foreignInfo: existing[0].foreignInfo as EvtRequestGrant["foreignInfo"],
      });

      await ctx.send.send(ctx, r);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const revokeRequestEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqRevokeRequest>, ResRevokeRequest | VibesDiyError> = {
  hash: "revoke-request",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqRevokeRequest(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqRevokeRequest }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqRevokeRequest>>, ResRevokeRequest | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const now = new Date().toISOString();
      const where = and(
        eq(vctx.sql.tables.requestGrants.userId, userId),
        eq(vctx.sql.tables.requestGrants.appSlug, req.appSlug),
        eq(vctx.sql.tables.requestGrants.userSlug, req.userSlug),
        eq(vctx.sql.tables.requestGrants.foreignUserId, req.foreignUserId)
      );

      const prev = await vctx.sql.db
        .select({
          created: vctx.sql.tables.requestGrants.created,
          state: vctx.sql.tables.requestGrants.state,
          role: vctx.sql.tables.requestGrants.role,
          foreignInfo: vctx.sql.tables.requestGrants.foreignInfo,
        })
        .from(vctx.sql.tables.requestGrants)
        .where(where)
        .limit(1)
        .then((rows) => rows[0]);

      const rOp = await exception2Result(() =>
        req.delete
          ? vctx.sql.db.delete(vctx.sql.tables.requestGrants).where(where)
          : vctx.sql.db.update(vctx.sql.tables.requestGrants).set({ state: "revoked", updated: now }).where(where)
      );
      if (rOp.isErr()) return Result.Err(rOp);

      const r = {
        type: "vibes.diy.res-revoke-request",
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        foreignUserId: req.foreignUserId,
        deleted: req.delete ?? false,
      } satisfies ResRevokeRequest;
      if (prev) {
        await sendUpdateEvent(vctx, {
          op: req.delete ? "delete" : "upsert",
          userId,
          grant: {
            type: "vibes.diy.res-request-access",
            appSlug: req.appSlug,
            userSlug: req.userSlug,
            foreignUserId: req.foreignUserId,
            role: Role.assert(prev.role),
            state: "revoked",
            foreignInfo: prev.foreignInfo as ForeignInfo,
            updated: now,
            created: prev.created,
          },
          // appSlug: req.appSlug,
          // userSlug: req.userSlug,
          // foreignUserId: req.foreignUserId,
          // state: (req.delete ? prev.state : "revoked") as EvtRequestGrant["state"],
          // role: prev.role as EvtRequestGrant["role"],
          // foreignInfo: prev.foreignInfo as EvtRequestGrant["foreignInfo"],
        });
      }

      await ctx.send.send(ctx, r);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
