import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  reqSetDbPolicy,
  ReqSetDbPolicy,
  ResSetDbPolicy,
  reqGetDbPolicy,
  ReqGetDbPolicy,
  ResGetDbPolicy,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  DbPolicy,
  DEFAULT_DB_POLICY,
  COMMENTS_DB_NAME,
  COMMENTS_DEFAULT_POLICY,
  isDbPolicy,
  ClerkClaim,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq, and } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import { checkDocAccess } from "./access-helpers.js";

// ── Policy resolver ────────────────────────────────────────────────

export async function resolveDbPolicy(
  vctx: VibesApiSQLCtx,
  userSlug: string,
  appSlug: string,
  dbName: string
): Promise<DbPolicy> {
  const t = vctx.sql.tables.appDbPolicies;
  const row = await vctx.sql.db
    .select({ policy: t.policy })
    .from(t)
    .where(and(eq(t.userSlug, userSlug), eq(t.appSlug, appSlug), eq(t.dbName, dbName)))
    .limit(1)
    .then((r) => r[0]);

  if (!row) return DEFAULT_DB_POLICY;
  if (isDbPolicy(row.policy)) return row.policy as DbPolicy;
  return DEFAULT_DB_POLICY;
}

// ── Stamp helpers ──────────────────────────────────────────────────

export function deriveAuthorDisplay(claims: ClerkClaim): string {
  const p = claims.params;
  if (p.nick && p.nick.trim()) return p.nick.trim();
  if (p.name && p.name.trim()) return p.name.trim();
  const composed = `${p.first ?? ""} ${p.last ?? ""}`.trim();
  if (composed) return composed;
  return p.email;
}

export function stampDoc(
  doc: Record<string, unknown>,
  policy: DbPolicy,
  claims: ClerkClaim,
  nowIso: string
): Record<string, unknown> {
  if (!policy.stamp || policy.stamp.length === 0) return doc;
  const out = { ...doc };
  for (const field of policy.stamp) {
    switch (field) {
      case "authorUserId":
        out.authorUserId = claims.userId;
        break;
      case "authorDisplay":
        out.authorDisplay = deriveAuthorDisplay(claims);
        break;
      case "createdAt":
        out.createdAt = nowIso;
        break;
    }
  }
  return out;
}

// ── Seeder: ensure default policies for a vibe exist ──────────────

export async function seedDefaultDbPolicies(vctx: VibesApiSQLCtx, userSlug: string, appSlug: string): Promise<void> {
  const now = new Date().toISOString();
  const t = vctx.sql.tables.appDbPolicies;
  await exception2Result(() =>
    vctx.sql.db
      .insert(t)
      .values({
        userSlug,
        appSlug,
        dbName: COMMENTS_DB_NAME,
        policy: COMMENTS_DEFAULT_POLICY,
        updated: now,
        created: now,
      })
      .onConflictDoNothing()
  );
}

// ── setDbPolicy (owner-gated) ──────────────────────────────────────

export const setDbPolicyEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqSetDbPolicy>, ResSetDbPolicy | VibesDiyError> = {
  hash: "set-db-policy",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqSetDbPolicy(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqSetDbPolicy>>, ResSetDbPolicy | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      if (access !== "owner") {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access denied" },
        } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      const now = new Date().toISOString();
      const t = vctx.sql.tables.appDbPolicies;
      await vctx.sql.db
        .insert(t)
        .values({
          userSlug: req.userSlug,
          appSlug: req.appSlug,
          dbName: req.dbName,
          policy: req.policy,
          updated: now,
          created: now,
        })
        .onConflictDoUpdate({
          target: [t.userSlug, t.appSlug, t.dbName],
          set: { policy: req.policy, updated: now },
        });

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-set-db-policy",
        status: "ok",
        userSlug: req.userSlug,
        appSlug: req.appSlug,
        dbName: req.dbName,
        policy: req.policy,
      } satisfies ResSetDbPolicy);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};

// ── getDbPolicy (owner-gated) ──────────────────────────────────────

export const getDbPolicyEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqGetDbPolicy>, ResGetDbPolicy | VibesDiyError> = {
  hash: "get-db-policy",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqGetDbPolicy(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqGetDbPolicy>>, ResGetDbPolicy | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const userId = req._auth.verifiedAuth.claims.userId;

      const access = await checkDocAccess(vctx, userId, req.appSlug, req.userSlug);
      if (access !== "owner") {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "Access denied" },
        } as unknown as VibesDiyError);
        return Result.Ok(EventoResult.Continue);
      }

      const policy = await resolveDbPolicy(vctx, req.userSlug, req.appSlug, req.dbName);

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-get-db-policy",
        status: "ok",
        userSlug: req.userSlug,
        appSlug: req.appSlug,
        dbName: req.dbName,
        policy,
      } satisfies ResGetDbPolicy);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
