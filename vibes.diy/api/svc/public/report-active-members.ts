import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqReportActiveMembers,
  ResReportActiveMembers,
  ResError,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  reqReportActiveMembers,
  resReportActiveMembers,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq, gte } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { checkAuth } from "../check-auth.js";
import { VibesApiSQLCtx } from "../types.js";
import { cachedReport, hasReport } from "./report-cache.js";

function last30DaysUTC(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function computeActiveMembers(vctx: VibesApiSQLCtx): Promise<ResReportActiveMembers> {
  const t = vctx.sql.tables;

  const reqRows = await vctx.sql.db
    .select({
      memberId: t.requestGrants.foreignUserId,
      userSlug: t.requestGrants.userSlug,
      appSlug: t.requestGrants.appSlug,
    })
    .from(t.requestGrants)
    .where(eq(t.requestGrants.state, "approved"));

  const invRows = await vctx.sql.db
    .select({
      memberId: t.inviteGrants.tokenOrGrantUserId,
      userSlug: t.inviteGrants.userSlug,
      appSlug: t.inviteGrants.appSlug,
    })
    .from(t.inviteGrants)
    .where(eq(t.inviteGrants.state, "accepted"));

  // Build a lookup: "userId:ownerUserSlug:appSlug" → is a member
  const memberKeys = new Set<string>();
  for (const r of [...reqRows, ...invRows]) {
    memberKeys.add(`${r.memberId}:${r.userSlug}:${r.appSlug}`);
  }

  const days = last30DaysUTC();
  const since = `${days[0]}T00:00:00.000Z`;

  const writes = await vctx.sql.db
    .select({
      userId: t.appDocuments.userId,
      userSlug: t.appDocuments.userSlug,
      appSlug: t.appDocuments.appSlug,
      created: t.appDocuments.created,
    })
    .from(t.appDocuments)
    .where(gte(t.appDocuments.created, since));

  // Count distinct active members per day (non-cumulative)
  const dayBuckets = new Map<string, Set<string>>();
  for (const w of writes) {
    if (w.userId === "unknown") continue;
    const key = `${w.userId}:${w.userSlug}:${w.appSlug}`;
    if (!memberKeys.has(key)) continue;
    const day = w.created.slice(0, 10);
    let bucket = dayBuckets.get(day);
    if (bucket === undefined) {
      bucket = new Set();
      dayBuckets.set(day, bucket);
    }
    bucket.add(w.userId);
  }

  return {
    type: "vibes.diy.res-report-active-members",
    generatedAt: new Date().toISOString(),
    days: days.map((day) => ({ day, count: dayBuckets.get(day)?.size ?? 0 })),
  };
}

export const reportActiveMembersEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqReportActiveMembers>,
  ResReportActiveMembers | VibesDiyError
> = {
  hash: "vibes.diy.req-report-active-members",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqReportActiveMembers(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqReportActiveMembers>>,
        ResReportActiveMembers | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (hasReport(req._auth.verifiedAuth.claims, "growth") === false) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: "not authorized for growth report", code: "report-not-authorized" },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const res = await cachedReport(vctx, "active-members", resReportActiveMembers, () => computeActiveMembers(vctx));
      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
