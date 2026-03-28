import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  ReqCreateInvite,
  ResCreateInvite,
  ReqRevokeInvite,
  ResRevokeInvite,
  ReqRedeemInvite,
  ResRedeemInviteOK,
  ReqHasAccessInvite,
  ResHasAccessInvite,
  ReqInviteSetRole,
  ResInviteSetRole,
  ReqListInviteGrants,
  ResListInviteGrants,
  ForeignInfo,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  isReqCreateInvite,
  isReqRevokeInvite,
  isReqRedeemInvite,
  isReqHasAccessInvite,
  isReqInviteSetRole,
  isReqListInviteGrants,
  ResRedeemInviteError,
  isResHasAccessInviteAccepted,
  isResHasAccessInvitePending,
  isResHasAccessInviteRevoke,
  ClerkClaim,
  EvtInviteGrant,
  InviteGrantItem,
} from "@vibes.diy/api-types";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { eq, and, lt, desc, ne } from "drizzle-orm/sql/expressions";
import { type SQL } from "drizzle-orm/sql";
import { type } from "arktype";

const GOOGLE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

function canonicalEmail(email: string): string {
  const [lhs, domain] = email.trim().toLowerCase().split("@");
  const withoutAlias = lhs.replace(/\+.*$/, "");
  const local = GOOGLE_DOMAINS.has(domain) ? withoutAlias.replaceAll(".", "") : withoutAlias;
  return `${local}@${domain}`;
}

type InviteGrantRow = VibesApiSQLCtx["sql"]["tables"]["inviteGrants"]["$inferSelect"];

async function sendUpdateEvent(vctx: VibesApiSQLCtx, value: Omit<EvtInviteGrant, "type">) {
  await vctx.postQueue({
    payload: { ...value, type: "vibes.diy.evt-invite-grant" },
    tid: "queue-event",
    src: "invite-flow",
    dst: "vibes-service",
    ttl: 1,
  } satisfies MsgBase<EvtInviteGrant>);
}

export const createInviteEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqCreateInvite>, ResCreateInvite | VibesDiyError> = {
  hash: "create-invite",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqCreateInvite(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqCreateInvite }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqCreateInvite>>, ResCreateInvite | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const now = new Date().toISOString();
      const emailKey = canonicalEmail(req.invitedEmail);
      const token = vctx.sthis.nextId(96 / 8).str;
      const foreignInfo: ForeignInfo = { givenEmail: req.invitedEmail };

      const value = {
        userId,
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        state: "pending",
        role: req.role,
        emailKey,
        tokenOrGrantUserId: token,
        foreignInfo,
        tick: "0",
        updated: now,
        created: now,
      };
      const rIns = await exception2Result(() =>
        vctx.sql.db
          .insert(vctx.sql.tables.inviteGrants)
          .values(value)
          .onConflictDoUpdate({
            target: [
              vctx.sql.tables.inviteGrants.userId,
              vctx.sql.tables.inviteGrants.appSlug,
              vctx.sql.tables.inviteGrants.userSlug,
              vctx.sql.tables.inviteGrants.emailKey,
            ],
            set: {
              state: "pending",
              role: req.role,
              tokenOrGrantUserId: token,
              updated: now,
            },
          })
      );
      if (rIns.isErr()) {
        return Result.Err(rIns);
      }
      const val = {
        type: "vibes.diy.res-create-invite",
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        emailKey,
        state: "pending" as const,
        role: req.role,
        tokenOrGrantUserId: token,
        foreignInfo,
        updated: now,
        created: now,
      } satisfies ResCreateInvite;

      await sendUpdateEvent(vctx, {
        userId,
        grant: val,
        op: "upsert" as const,
      });

      await ctx.send.send(ctx, val);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const revokeInviteEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqRevokeInvite>, ResRevokeInvite | VibesDiyError> = {
  hash: "revoke-invite",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqRevokeInvite(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqRevokeInvite }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqRevokeInvite>>, ResRevokeInvite | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const where = and(
        eq(vctx.sql.tables.inviteGrants.userId, userId),
        eq(vctx.sql.tables.inviteGrants.appSlug, req.appSlug),
        eq(vctx.sql.tables.inviteGrants.userSlug, req.userSlug),
        eq(vctx.sql.tables.inviteGrants.emailKey, req.emailKey)
      );

      const rPrev = await exception2Result(() =>
        vctx.sql.db
          .select()
          .from(vctx.sql.tables.inviteGrants)
          .where(where)
          .limit(1)
          .then((rows) => rows[0])
      );
      if (rPrev.isErr()) {
        return Result.Err(rPrev);
      }
      const prev = rPrev.Ok();
      if (prev) {
        const foreignInfo = ForeignInfo(prev.foreignInfo);
        if (foreignInfo instanceof type.errors) {
          console.error("Failed to parse foreignInfo for invite grant", { error: foreignInfo, raw: prev.foreignInfo });
        } else {
          await sendUpdateEvent(vctx, {
            op: req.delete ? "delete" : "upsert",
            userId,
            grant: {
              appSlug: req.appSlug,
              userSlug: req.userSlug,
              emailKey: req.emailKey,
              role: prev.role as EvtInviteGrant["grant"]["role"],
              state: prev.state as EvtInviteGrant["grant"]["state"],
              tokenOrGrantUserId: prev.tokenOrGrantUserId,
              foreignInfo,
              updated: prev.updated,
              created: prev.created,
            },
          });
        }
      }

      const rOp = await exception2Result(() => {
        if (req.delete) {
          return vctx.sql.db.delete(vctx.sql.tables.inviteGrants).where(where);
        }
        return vctx.sql.db
          .update(vctx.sql.tables.inviteGrants)
          .set({ state: "revoked", updated: new Date().toISOString() })
          .where(where);
      });

      if (rOp.isErr()) {
        return Result.Err(rOp);
      }

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-revoke-invite",
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        emailKey: req.emailKey,
        deleted: !!req.delete,
      } satisfies ResRevokeInvite);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export async function redeemInvite(
  vctx: VibesApiSQLCtx,
  req: { token: string; redeemerId: string; claims: ClerkClaim }
): Promise<Result<InviteGrantRow>> {
  const rows = await vctx.sql.db
    .select()
    .from(vctx.sql.tables.inviteGrants)
    .where(
      and(eq(vctx.sql.tables.inviteGrants.tokenOrGrantUserId, req.token), ne(vctx.sql.tables.inviteGrants.userId, req.redeemerId))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return Result.Err("Invite token not found or redeemer is the owner");
  }

  const foreignInfo: ForeignInfo = {
    ...(row.foreignInfo as ForeignInfo),
    claims: req.claims,
  };

  const now = new Date().toISOString();

  const rUpd = await exception2Result(() =>
    vctx.sql.db
      .update(vctx.sql.tables.inviteGrants)
      .set({
        state: "accepted",
        tokenOrGrantUserId: req.redeemerId,
        foreignInfo,
        updated: now,
      })
      .where(eq(vctx.sql.tables.inviteGrants.tokenOrGrantUserId, req.token))
  );
  if (rUpd.isErr()) {
    return Result.Err(rUpd);
  }

  await sendUpdateEvent(vctx, {
    op: "upsert",
    userId: row.userId,
    grant: {
      appSlug: row.appSlug,
      userSlug: row.userSlug,
      emailKey: row.emailKey,
      role: row.role as EvtInviteGrant["grant"]["role"],
      state: "accepted" as EvtInviteGrant["grant"]["state"],
      tokenOrGrantUserId: req.redeemerId,
      foreignInfo,
      updated: now,
      created: row.created,
    },
  });

  return Result.Ok(row);
}

export const redeemInviteEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqRedeemInvite>, ResRedeemInviteOK | VibesDiyError> = {
  hash: "redeem-invite",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqRedeemInvite(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqRedeemInvite }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqRedeemInvite>>, ResRedeemInviteOK | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const claims = req._auth.verifiedAuth.claims;
      const redeemerId = claims.userId;

      const rRedeem = await redeemInvite(vctx, { token: req.token, redeemerId, claims });
      if (rRedeem.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: "redeem-invite: token not found or redeemer is the owner",
          code: "redeem-invite-failed",
        } satisfies ResRedeemInviteError);
        return Result.Ok(EventoResult.Continue);
      }
      const row = rRedeem.Ok();
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-redeem-invite",
        appSlug: row.appSlug,
        userSlug: row.userSlug,
        emailKey: row.emailKey,
        role: row.role as ResRedeemInviteOK["role"],
        state: "accepted",
      } satisfies ResRedeemInviteOK);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export async function hasAccessInvite(
  vctx: VibesApiSQLCtx,
  req: { grantUserId?: string; appSlug: string; userSlug: string }
): Promise<Result<ResHasAccessInvite>> {
  if (!req.grantUserId) {
    return Result.Ok({
      type: "vibes.diy.res-has-access-invite",
      state: "not-found",
      appSlug: req.appSlug,
      userSlug: req.userSlug,
    });
  }
  return exception2Result(() =>
    vctx.sql.db
      .select({
        state: vctx.sql.tables.inviteGrants.state,
        tokenOrGrantUserId: vctx.sql.tables.inviteGrants.tokenOrGrantUserId,
        role: vctx.sql.tables.inviteGrants.role,
        appSlug: vctx.sql.tables.inviteGrants.appSlug,
        userSlug: vctx.sql.tables.inviteGrants.userSlug,
      })
      .from(vctx.sql.tables.inviteGrants)
      .where(
        and(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          eq(vctx.sql.tables.inviteGrants.tokenOrGrantUserId, req.grantUserId!),
          eq(vctx.sql.tables.inviteGrants.appSlug, req.appSlug),
          eq(vctx.sql.tables.inviteGrants.userSlug, req.userSlug)
        )
      )
      .limit(1)
      .then((rows) => {
        const row = { type: "vibes.diy.res-has-access-invite" as const, ...rows[0] };
        switch (true) {
          case isResHasAccessInviteAccepted(row):
          case isResHasAccessInvitePending(row):
          case isResHasAccessInviteRevoke(row):
            return row;
          default:
            return { type: "vibes.diy.res-has-access-invite", state: "not-found", appSlug: req.appSlug, userSlug: req.userSlug };
        }
      })
  );
}

export const hasAccessInviteEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqHasAccessInvite>,
  ResHasAccessInvite | VibesDiyError
> = {
  hash: "has-access-invite",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqHasAccessInvite(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqHasAccessInvite }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqHasAccessInvite>>, ResHasAccessInvite | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const grantUserId = req._auth.verifiedAuth.claims.userId;

      const rRow = await hasAccessInvite(vctx, { ...req, grantUserId });
      if (rRow.isErr()) return Result.Err(rRow);
      await ctx.send.send(ctx, rRow.Ok());
      //   type: "vibes.diy.res-has-access-invite",
      //   appSlug: req.appSlug,
      //   userSlug: req.userSlug,
      //   ...rRow.Ok(),
      // } satisfies ResHasAccessInvite);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};

export const inviteSetRoleEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqInviteSetRole>, ResInviteSetRole | VibesDiyError> = {
  hash: "invite-set-role",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqInviteSetRole(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqInviteSetRole }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqInviteSetRole>>, ResInviteSetRole | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const now = new Date().toISOString();

      const rUpd = await exception2Result(() =>
        vctx.sql.db
          .update(vctx.sql.tables.inviteGrants)
          .set({ role: req.role, updated: now })
          .where(
            and(
              eq(vctx.sql.tables.inviteGrants.userId, userId),
              eq(vctx.sql.tables.inviteGrants.appSlug, req.appSlug),
              eq(vctx.sql.tables.inviteGrants.userSlug, req.userSlug),
              eq(vctx.sql.tables.inviteGrants.emailKey, req.emailKey)
            )
          )
      );
      if (rUpd.isErr()) {
        return Result.Err(rUpd);
      }

      const row = await vctx.sql.db
        .select()
        .from(vctx.sql.tables.inviteGrants)
        .where(
          and(
            eq(vctx.sql.tables.inviteGrants.userId, userId),
            eq(vctx.sql.tables.inviteGrants.appSlug, req.appSlug),
            eq(vctx.sql.tables.inviteGrants.userSlug, req.userSlug),
            eq(vctx.sql.tables.inviteGrants.emailKey, req.emailKey)
          )
        )
        .then((rows) => rows[0]);
      if (row) {
        const grant = InviteGrantItem(row);
        if (grant instanceof type.errors) {
          console.error("Failed to parse invite grant after role update", { error: grant, raw: row });
        } else {
          await sendUpdateEvent(vctx, {
            op: "upsert",
            userId,
            grant,
          });
        }
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-invite-set-role",
          appSlug: req.appSlug,
          userSlug: req.userSlug,
          emailKey: req.emailKey,
          role: req.role,
        } satisfies ResInviteSetRole);
      }
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const listInviteGrantsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqListInviteGrants>,
  ResListInviteGrants | VibesDiyError
> = {
  hash: "list-invite-grants",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqListInviteGrants(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqListInviteGrants }));
    }
    return Result.Ok(Option.None());
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqListInviteGrants>>,
        ResListInviteGrants | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;
      const limit = Math.min(req.pager.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

      const conditions: SQL[] = [
        eq(vctx.sql.tables.inviteGrants.userId, userId),
        eq(vctx.sql.tables.inviteGrants.appSlug, req.appSlug),
        eq(vctx.sql.tables.inviteGrants.userSlug, req.userSlug),
      ];
      if (req.pager.cursor) {
        conditions.push(lt(vctx.sql.tables.inviteGrants.created, req.pager.cursor));
      }

      const rows = await vctx.sql.db
        .select({
          appSlug: vctx.sql.tables.inviteGrants.appSlug,
          userSlug: vctx.sql.tables.inviteGrants.userSlug,
          emailKey: vctx.sql.tables.inviteGrants.emailKey,
          state: vctx.sql.tables.inviteGrants.state,
          role: vctx.sql.tables.inviteGrants.role,
          tokenOrGrantUserId: vctx.sql.tables.inviteGrants.tokenOrGrantUserId,
          foreignInfo: vctx.sql.tables.inviteGrants.foreignInfo,
          tick: vctx.sql.tables.inviteGrants.tick,
          updated: vctx.sql.tables.inviteGrants.updated,
          created: vctx.sql.tables.inviteGrants.created,
        })
        .from(vctx.sql.tables.inviteGrants)
        .where(and(...conditions))
        .orderBy(desc(vctx.sql.tables.inviteGrants.created))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const items = InviteGrantItem.array()(hasMore ? rows.slice(0, limit) : rows);
      if (items instanceof type.errors) {
        return Result.Err(`Failed to parse invite grants: ${items.summary}`);
      }
      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-invite-grants",
        appSlug: req.appSlug,
        userSlug: req.userSlug,
        items,
        ...(hasMore ? { nextCursor: items[items.length - 1].created } : {}),
      } satisfies ResListInviteGrants);

      return Result.Ok(EventoResult.Continue);
    }
  ),
};
