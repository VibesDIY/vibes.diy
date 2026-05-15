import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqReportGrowthMemberships,
  ResReportGrowthMemberships,
  ResError,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  reqReportGrowthMemberships,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq, inArray } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { checkAuth } from "../check-auth.js";
import { VibesApiSQLCtx } from "../types.js";

// Reports are gated on Clerk publicMetadata.reports — an array of report
// keys (or ["*"] for all). The existing Clerk JWT template emits
// publicMetadata as params.public_meta, so the check is a claims read.
function hasReport(claims: { params?: { public_meta?: unknown } }, name: string): boolean {
  const pm = claims.params?.public_meta as { reports?: unknown } | undefined;
  const list = pm?.reports;
  return Array.isArray(list) && (list.includes("*") || list.includes(name));
}

function last30DaysUTC(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function computeMemberships(vctx: VibesApiSQLCtx): Promise<ResReportGrowthMemberships> {
  const t = vctx.sql.tables;

  // Approved requests: foreignUserId is the member.
  const reqRows = await vctx.sql.db
    .select({
      created: t.requestGrants.created,
      memberId: t.requestGrants.foreignUserId,
      userSlug: t.requestGrants.userSlug,
      appSlug: t.requestGrants.appSlug,
    })
    .from(t.requestGrants)
    .where(eq(t.requestGrants.state, "approved"));

  // Accepted invites: tokenOrGrantUserId becomes the redeemer's userId on accept.
  const invRows = await vctx.sql.db
    .select({
      created: t.inviteGrants.created,
      memberId: t.inviteGrants.tokenOrGrantUserId,
      userSlug: t.inviteGrants.userSlug,
      appSlug: t.inviteGrants.appSlug,
    })
    .from(t.inviteGrants)
    .where(eq(t.inviteGrants.state, "accepted"));

  // Dedupe a member's access to the same vibe across request+invite, keep
  // the earliest grant date so cumulative counts and "new today" reflect
  // first-acquisition, not whichever path arrived later.
  const earliest = new Map<string, string>();
  for (const r of [...reqRows, ...invRows]) {
    const key = `${r.memberId} ${r.userSlug} ${r.appSlug}`;
    const prev = earliest.get(key);
    if (prev === undefined || r.created < prev) earliest.set(key, r.created);
  }

  const days = last30DaysUTC();
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const dayEnd = `${lastDay}T23:59:59.999Z`;

  let totalThroughLastDay = 0;
  const newByDay = new Map<string, Set<string>>();
  const memberIdsNeedingSlug = new Set<string>();
  for (const [key, created] of earliest) {
    if (created > dayEnd) continue;
    totalThroughLastDay += 1;
    const day = created.slice(0, 10);
    if (day < firstDay) continue;
    const memberId = key.slice(0, key.indexOf(" "));
    let bucket = newByDay.get(day);
    if (!bucket) {
      bucket = new Set();
      newByDay.set(day, bucket);
    }
    bucket.add(memberId);
    memberIdsNeedingSlug.add(memberId);
  }

  // Resolve member userIds → slugs for the tooltip. A member without a
  // slug binding falls back to userId so the hover never shows blanks.
  const slugById = new Map<string, string>();
  if (memberIdsNeedingSlug.size > 0) {
    const bindings = await vctx.sql.db
      .select({ userId: t.userSlugBinding.userId, userSlug: t.userSlugBinding.userSlug })
      .from(t.userSlugBinding)
      .where(inArray(t.userSlugBinding.userId, [...memberIdsNeedingSlug]));
    for (const b of bindings) slugById.set(b.userId, b.userSlug);
  }

  const earliestList = [...earliest.values()].sort();
  const result: { day: string; memberships: number; newMembers: string[] }[] = [];
  let idx = 0;
  for (const day of days) {
    const end = `${day}T23:59:59.999Z`;
    while (idx < earliestList.length && earliestList[idx] <= end) idx += 1;
    const bucket = newByDay.get(day);
    const newMembers = bucket ? [...bucket].map((id) => slugById.get(id) ?? id).sort() : [];
    result.push({ day, memberships: idx, newMembers });
  }

  return {
    type: "vibes.diy.res-report-growth-memberships",
    generatedAt: new Date().toISOString(),
    total: totalThroughLastDay,
    days: result,
  };
}

export const reportGrowthMembershipsEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqReportGrowthMemberships>,
  ResReportGrowthMemberships | VibesDiyError
> = {
  hash: "vibes.diy.req-report-growth-memberships",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqReportGrowthMemberships(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqReportGrowthMemberships>>,
        ResReportGrowthMemberships | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      if (!hasReport(req._auth.verifiedAuth.claims, "growth")) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.error",
          message: "not authorized for growth report",
          code: "report-not-authorized",
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }

      const res = await computeMemberships(vctx);
      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
