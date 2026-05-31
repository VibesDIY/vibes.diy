import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  ReqReportTopVibesByMembers,
  ResReportTopVibesByMembers,
  ResError,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  reqReportTopVibesByMembers,
  resReportTopVibesByMembers,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { checkAuth } from "../check-auth.js";
import { VibesApiSQLCtx } from "../types.js";
import { cachedReport, hasReport } from "./report-cache.js";

async function computeTopVibesByMembers(vctx: VibesApiSQLCtx): Promise<ResReportTopVibesByMembers> {
  const t = vctx.sql.tables;

  const reqRows = await vctx.sql.db
    .select({
      memberId: t.requestGrants.foreignUserId,
      ownerHandle: t.requestGrants.ownerHandle,
      appSlug: t.requestGrants.appSlug,
    })
    .from(t.requestGrants)
    .where(eq(t.requestGrants.state, "approved"));

  const invRows = await vctx.sql.db
    .select({
      memberId: t.inviteGrants.tokenOrGrantUserId,
      ownerHandle: t.inviteGrants.ownerHandle,
      appSlug: t.inviteGrants.appSlug,
    })
    .from(t.inviteGrants)
    .where(eq(t.inviteGrants.state, "accepted"));

  // Dedupe members per vibe (same person might have both a request and an invite)
  const vibeMembers = new Map<string, Set<string>>();
  for (const r of [...reqRows, ...invRows]) {
    const vibeKey = `${r.ownerHandle}\x00${r.appSlug}`;
    let members = vibeMembers.get(vibeKey);
    if (members === undefined) {
      members = new Set();
      vibeMembers.set(vibeKey, members);
    }
    members.add(r.memberId);
  }

  const rows = [...vibeMembers.entries()]
    .map(([key, members]) => {
      const sep = key.indexOf("\x00");
      return {
        ownerHandle: key.slice(0, sep),
        appSlug: key.slice(sep + 1),
        memberCount: members.size,
      };
    })
    .sort((a, b) => b.memberCount - a.memberCount)
    .slice(0, 20);

  return {
    type: "vibes.diy.res-report-top-vibes-by-members",
    generatedAt: new Date().toISOString(),
    rows,
  };
}

export const reportTopVibesByMembersEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqReportTopVibesByMembers>,
  ResReportTopVibesByMembers | VibesDiyError
> = {
  hash: "vibes.diy.req-report-top-vibes-by-members",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqReportTopVibesByMembers(msg.payload);
    if (ret instanceof type.errors) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithVerifiedAuth<ReqReportTopVibesByMembers>>,
        ResReportTopVibesByMembers | VibesDiyError
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

      const res = await cachedReport(vctx, "top-vibes-by-members", resReportTopVibesByMembers, () =>
        computeTopVibesByMembers(vctx)
      );
      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
