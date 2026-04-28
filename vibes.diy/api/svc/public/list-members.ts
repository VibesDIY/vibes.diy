import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import {
  MsgBase,
  reqListMembers,
  ReqListMembers,
  ResListMembers,
  MemberItem,
  ReqWithOptionalAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  ClerkClaim,
  ForeignInfo,
  Role,
} from "@vibes.diy/api-types";
import { eq, and } from "drizzle-orm";
import { type } from "arktype";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";
import { checkDocAccess, canRead, isPublicReadable } from "./access-helpers.js";

function deriveAuthorDisplay(claims: ClerkClaim): string {
  const p = claims.params;
  if (p.nick !== undefined && p.nick.trim() !== "") return p.nick.trim();
  if (p.name !== null && p.name.trim() !== "") return p.name.trim();
  const composed = `${p.first} ${p.last}`.trim();
  if (composed !== "") return composed;
  return p.email;
}

function safeDisplay(foreignInfo: unknown, fallbackEmail?: string): string {
  const fi = foreignInfo as ForeignInfo | undefined;
  if (fi?.claims) return deriveAuthorDisplay(fi.claims as ClerkClaim);
  if (fi?.givenEmail) return fi.givenEmail;
  if (fallbackEmail) return fallbackEmail;
  return "anonymous";
}

export const listMembersEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqListMembers>, ResListMembers | VibesDiyError> = {
  hash: "list-members",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqListMembers(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some({ ...msg, payload: ret }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithOptionalAuth<ReqListMembers>>, ResListMembers | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Read-access gate: any reader (or public-readable) can list members.
      const access = req._auth
        ? await checkDocAccess(vctx, req._auth.verifiedAuth.claims.userId, req.appSlug, req.userSlug)
        : "none";
      if (!canRead(access)) {
        const pub = await isPublicReadable(vctx, req.appSlug, req.userSlug);
        if (!pub) {
          await ctx.send.send(ctx, {
            type: "vibes.diy.res-error",
            error: { message: "Access denied" },
          } as unknown as VibesDiyError);
          return Result.Ok(EventoResult.Continue);
        }
      }

      // Find the owner's userId — grants are keyed by it.
      const binding = await vctx.sql.db
        .select({ userId: vctx.sql.tables.userSlugBinding.userId })
        .from(vctx.sql.tables.userSlugBinding)
        .where(eq(vctx.sql.tables.userSlugBinding.userSlug, req.userSlug))
        .limit(1)
        .then((r) => r[0]);

      if (!binding) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-list-members",
          status: "ok",
          members: [],
        } satisfies ResListMembers);
        return Result.Ok(EventoResult.Continue);
      }

      const ownerUserId = binding.userId;

      // Approved invites
      const inviteRows = await vctx.sql.db
        .select({
          role: vctx.sql.tables.inviteGrants.role,
          foreignInfo: vctx.sql.tables.inviteGrants.foreignInfo,
          state: vctx.sql.tables.inviteGrants.state,
        })
        .from(vctx.sql.tables.inviteGrants)
        .where(
          and(
            eq(vctx.sql.tables.inviteGrants.userId, ownerUserId),
            eq(vctx.sql.tables.inviteGrants.appSlug, req.appSlug),
            eq(vctx.sql.tables.inviteGrants.userSlug, req.userSlug),
            eq(vctx.sql.tables.inviteGrants.state, "accepted")
          )
        );

      // Approved requests
      const requestRows = await vctx.sql.db
        .select({
          role: vctx.sql.tables.requestGrants.role,
          foreignInfo: vctx.sql.tables.requestGrants.foreignInfo,
          state: vctx.sql.tables.requestGrants.state,
        })
        .from(vctx.sql.tables.requestGrants)
        .where(
          and(
            eq(vctx.sql.tables.requestGrants.userId, ownerUserId),
            eq(vctx.sql.tables.requestGrants.appSlug, req.appSlug),
            eq(vctx.sql.tables.requestGrants.userSlug, req.userSlug),
            eq(vctx.sql.tables.requestGrants.state, "approved")
          )
        );

      const seen = new Set<string>();
      const members: MemberItem[] = [];
      const collect = (role: string | null, foreignInfo: unknown) => {
        if (role !== "editor" && role !== "viewer" && role !== "submitter") return;
        const display = safeDisplay(foreignInfo);
        const key = `${display}|${role}`;
        if (seen.has(key)) return;
        seen.add(key);
        members.push({ displayName: display, role: role as Role });
      };
      for (const r of inviteRows) collect(r.role, r.foreignInfo);
      for (const r of requestRows) collect(r.role, r.foreignInfo);

      members.sort((a, b) => a.displayName.localeCompare(b.displayName));

      await ctx.send.send(ctx, {
        type: "vibes.diy.res-list-members",
        status: "ok",
        members,
      } satisfies ResListMembers);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
