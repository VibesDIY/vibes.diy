import {
  isInviteEmailToken,
  isInviteLinkToken,
  isReqInviteEmailPayload,
  isReqInviteLinkPayload,
  InviteToken,
  ReqInviteToken,
  ResInviteToken,
  ReqDeleteInviteToken,
  ResDeleteInviteToken,
  ReqAcceptInvite,
  ResAcceptInvite,
  ReqListAcceptedInvites,
  ResListAcceptedInvites,
  ReqDeleteAccept,
  ResDeleteAccept,
  AcceptedClerkInfo,
  ReqGetFPToken,
  ResFPToken,
  type InviteWithAccepts,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { VibesSqlite } from "../create-handler.js";
import { Result, exception2Result } from "@adviser/cement";
import { ReqWithVerifiedAuth } from "../check-auth.js";
import { sqlInviteTokens, sqlAcceptInvites, sqlUserSlugBinding, sqlAppSlugBinding } from "../sql/vibes-diy-api-schema.js";
import { count } from "drizzle-orm";
import { and, eq, or } from "drizzle-orm/sql/expressions";

export interface InviteSystemOpts {
  db: VibesSqlite;
  maxPerUserInviteTokens: number;
  maxPerSlugInviteTokens: number;
  emailValidDurationMs: number;
  linkValidDurationMs: number;
  nextId: () => string;
  now?: Date;
}

export async function createInviteToken(
  req: ReqWithVerifiedAuth<ReqInviteToken>,
  opts: InviteSystemOpts
): Promise<Result<ResInviteToken>> {
  const userId = req.auth.verifiedAuth.claims.userId;

  // select count from sqlInviteTokens by req.invite.appSlug, req.invite.userSlug
  const rCount = await exception2Result(() =>
    opts.db
      .select({ count: count() })
      .from(sqlInviteTokens)
      .where(and(eq(sqlInviteTokens.appSlug, req.invite.appSlug), eq(sqlInviteTokens.userSlug, req.invite.userSlug)))
      .get()
  );
  if (rCount.isErr()) {
    return Result.Err(`Failed to count invite tokens: ${rCount.Err().message}`);
  }
  // if count >= opts.maxPerSlugInviteTokens, return error
  if ((rCount.Ok()?.count ?? 0) >= opts.maxPerSlugInviteTokens) {
    return Result.Err(
      `Max invite tokens (${opts.maxPerSlugInviteTokens}) reached for ${req.invite.appSlug}/${req.invite.userSlug}`
    );
  }

  const now = opts.now ?? new Date();
  const token = opts.nextId();
  const base = {
    type: "vibes.diy.invite-token" as const,
    token,
    appSlug: req.invite.appSlug,
    userSlug: req.invite.userSlug,
    roles: req.invite.roles,
    ownerUserId: userId,
    created: now,
  };

  let invite: InviteToken;
  switch (true) {
    case isReqInviteEmailPayload(req.invite):
      // fill InviteEmailToken and insert into sqlInviteTokens
      invite = {
        ...base,
        style: "email",
        email: req.invite.email,
        validUntil: req.invite.validUntil ?? new Date(now.getTime() + opts.emailValidDurationMs),
      };
      break;
    case isReqInviteLinkPayload(req.invite):
      // fill InviteLinkToken and insert into sqlInviteTokens
      invite = {
        ...base,
        style: "link",
        acceptCount: req.invite.acceptCount,
        validUntil: req.invite.validUntil ?? new Date(now.getTime() + opts.linkValidDurationMs),
      };
      break;
    default:
      return Result.Err(`Invalid invite token style`);
  }

  const rInsert = await exception2Result(() =>
    opts.db
      .insert(sqlInviteTokens)
      .values({
        token: invite.token,
        appSlug: invite.appSlug,
        userSlug: invite.userSlug,
        ownerUserId: invite.ownerUserId,
        validUntil: invite.validUntil.toISOString(),
        created: invite.created.toISOString(),
        style: invite,
      })
      .run()
  );
  if (rInsert.isErr()) {
    return Result.Err(`Failed to insert invite token: ${rInsert.Err().message}`);
  }

  return Result.Ok({
    type: "res.invite" as const,
    invite,
  });
}

export async function deleteInviteToken(
  req: ReqWithVerifiedAuth<ReqDeleteInviteToken>,
  opts: InviteSystemOpts
): Promise<Result<ResDeleteInviteToken>> {
  const rDelete = await exception2Result(() => opts.db.delete(sqlInviteTokens).where(eq(sqlInviteTokens.token, req.token)).run());
  if (rDelete.isErr()) {
    return Result.Err(`Failed to delete invite token: ${rDelete.Err().message}`);
  }

  const rDeleteAccepts = await exception2Result(() =>
    opts.db.delete(sqlAcceptInvites).where(eq(sqlAcceptInvites.token, req.token)).run()
  );
  if (rDeleteAccepts.isErr()) {
    return Result.Err(`Failed to delete accept invites: ${rDeleteAccepts.Err().message}`);
  }

  return Result.Ok({
    type: "res.delete-invite" as const,
    token: req.token,
  });
}

export async function acceptInvite(
  req: ReqWithVerifiedAuth<ReqAcceptInvite>,
  opts: InviteSystemOpts
): Promise<Result<ResAcceptInvite>> {
  const acceptUserId = req.auth.verifiedAuth.claims.userId;
  const now = opts.now ?? new Date();

  const rToken = await exception2Result(() =>
    opts.db.select().from(sqlInviteTokens).where(eq(sqlInviteTokens.token, req.token)).get()
  );
  if (rToken.isErr()) {
    return Result.Err(`Failed to query invite token: ${rToken.Err().message}`);
  }
  const tokenRow = rToken.Ok();
  if (!tokenRow) {
    return Result.Err(`Invite token not found: ${req.token}`);
  }
  if (new Date(tokenRow.validUntil) < now) {
    return Result.Err(`Invite token has expired`);
  }
  if (tokenRow.ownerUserId === acceptUserId) {
    return Result.Err(`Invite owner cannot accept their own invite`);
  }

  const invite = InviteToken(tokenRow.style);
  if (invite instanceof type.errors) {
    return Result.Err(`Invalid stored invite token: ${invite.summary}`);
  }

  // Count existing accepts for limit check
  const rCount = await exception2Result(() =>
    opts.db.select({ count: count() }).from(sqlAcceptInvites).where(eq(sqlAcceptInvites.token, req.token)).get()
  );
  if (rCount.isErr()) {
    return Result.Err(`Failed to count accept invites: ${rCount.Err().message}`);
  }
  const accepted = rCount.Ok()?.count ?? 0;

  switch (true) {
    case isInviteEmailToken(invite):
      if (accepted >= 1) {
        return Result.Err(`Email invite has already been accepted`);
      }
      break;
    case isInviteLinkToken(invite):
      if (accepted >= invite.acceptCount) {
        return Result.Err(`Link invite has reached its accept limit (${invite.acceptCount})`);
      }
      break;
    default:
      return Result.Err(`Invalid invite token style`);
  }

  const newInfo: (typeof AcceptedClerkInfo.infer)[] = [];

  if (isInviteLinkToken(invite)) {
    newInfo.push({
      type: "accepted-clerk-info" as const,
      email: req.auth.verifiedAuth.claims.params.email,
      nick: req.auth.verifiedAuth.claims.params.nick ?? req.auth.verifiedAuth.claims.params.name ?? undefined,
    });
  }

  // unique index on (token, acceptUserId) prevents the same user accepting twice
  const rInsert = await exception2Result(() =>
    opts.db
      .insert(sqlAcceptInvites)
      .values({
        acceptId: opts.nextId(),
        token: req.token,
        acceptUserId,
        acceptedInfo: newInfo,
        created: now.toISOString(),
      })
      .run()
  );
  if (rInsert.isErr()) {
    return Result.Err(`Failed to record accept invite: ${rInsert.Err().message}`);
  }

  return Result.Ok({
    type: "res.accept-invite" as const,
    token: req.token,
    appSlug: invite.appSlug,
    userSlug: invite.userSlug,
    roles: invite.roles,
    acceptedInfo: newInfo,
  });
}

export async function listAcceptedInvites(
  req: ReqWithVerifiedAuth<ReqListAcceptedInvites>,
  opts: InviteSystemOpts
): Promise<Result<ResListAcceptedInvites>> {
  const userId = req.auth.verifiedAuth.claims.userId;

  if (req.slugs.length === 0) {
    return Result.Ok({ type: "res.list-accepted-invites" as const, items: [] });
  }

  const rRows = await exception2Result(() =>
    opts.db
      .select()
      .from(sqlInviteTokens)
      .leftJoin(sqlAcceptInvites, eq(sqlInviteTokens.token, sqlAcceptInvites.token))
      .where(
        and(
          eq(sqlInviteTokens.ownerUserId, userId),
          or(...req.slugs.map((s) => and(eq(sqlInviteTokens.appSlug, s.appSlug), eq(sqlInviteTokens.userSlug, s.userSlug))))
        )
      )
      .all()
  );
  if (rRows.isErr()) {
    return Result.Err(`Failed to query invites: ${rRows.Err().message}`);
  }

  // Group accept rows by invite token
  const inviteMap = new Map<
    string,
    { inviteRow: typeof sqlInviteTokens.$inferSelect; acceptRows: (typeof sqlAcceptInvites.$inferSelect)[] }
  >();
  for (const row of rRows.Ok()) {
    const inviteRow = row.InviteTokens;
    if (!inviteMap.has(inviteRow.token)) {
      inviteMap.set(inviteRow.token, { inviteRow, acceptRows: [] });
    }
    if (row.AcceptInvites) {
      const entry = inviteMap.get(inviteRow.token);
      if (entry) entry.acceptRows.push(row.AcceptInvites);
    }
  }

  // Build InviteWithAccepts items
  const items: InviteWithAccepts[] = [];
  for (const { inviteRow, acceptRows } of inviteMap.values()) {
    const inviteParams = InviteToken(inviteRow.style);
    if (inviteParams instanceof type.errors) continue;

    const accepts = acceptRows.flatMap((ar) => {
      const acceptedInfo = AcceptedClerkInfo(ar.acceptedInfo);
      if (acceptedInfo instanceof type.errors) return [];
      return [{ acceptId: ar.acceptId, token: ar.token, acceptedInfo, created: new Date(ar.created) }];
    });

    items.push({ inviteParams, accepts });
  }

  return Result.Ok({ type: "res.list-accepted-invites" as const, items });
}

export async function deleteAccept(
  req: ReqWithVerifiedAuth<ReqDeleteAccept>,
  opts: InviteSystemOpts
): Promise<Result<ResDeleteAccept>> {
  const rDelete = await exception2Result(() =>
    opts.db.delete(sqlAcceptInvites).where(eq(sqlAcceptInvites.acceptId, req.acceptId)).run()
  );
  if (rDelete.isErr()) {
    return Result.Err(`Failed to delete accept: ${rDelete.Err().message}`);
  }

  return Result.Ok({ type: "res.delete-accept" as const, acceptId: req.acceptId });
}

export async function getFPToken(req: ReqWithVerifiedAuth<ReqGetFPToken>, opts: InviteSystemOpts): Promise<Result<ResFPToken>> {
  const userId = req.auth.verifiedAuth.claims.userId;

  // Owner path: user owns the slug binding
  const rDirect = await exception2Result(() =>
    opts.db
      .select()
      .from(sqlUserSlugBinding)
      .innerJoin(sqlAppSlugBinding, eq(sqlUserSlugBinding.userSlug, sqlAppSlugBinding.userSlug))
      .where(
        and(
          eq(sqlUserSlugBinding.userId, userId),
          eq(sqlUserSlugBinding.userSlug, req.userSlug),
          eq(sqlAppSlugBinding.appSlug, req.appSlug)
        )
      )
      .get()
  );
  if (rDirect.isErr()) {
    return Result.Err(`Failed to query owner token: ${rDirect.Err().message}`);
  }
  const directRow = rDirect.Ok();
  if (directRow) {
    console.log("owner-token", req.DbName, req.appSlug, req.userSlug);
    return Result.Ok({
      type: "res.get-fp-token" as const,
      ledger: directRow.AppSlugBindings.ledger,
      tenant: directRow.UserSlugBindings.tenant,
      roles: [],
      access: "owner" as const,
      token: req.DbName,
    });
  }

  // Shared path: user accepted an invite for the given appSlug/userSlug
  const now = opts.now ?? new Date();
  const rShared = await exception2Result(() =>
    opts.db
      .select()
      .from(sqlInviteTokens)
      .innerJoin(sqlAcceptInvites, eq(sqlInviteTokens.token, sqlAcceptInvites.token))
      .innerJoin(sqlUserSlugBinding, eq(sqlInviteTokens.userSlug, sqlUserSlugBinding.userSlug))
      .innerJoin(
        sqlAppSlugBinding,
        and(eq(sqlInviteTokens.appSlug, sqlAppSlugBinding.appSlug), eq(sqlInviteTokens.userSlug, sqlAppSlugBinding.userSlug))
      )
      .where(
        and(
          eq(sqlInviteTokens.appSlug, req.appSlug),
          eq(sqlInviteTokens.userSlug, req.userSlug),
          eq(sqlAcceptInvites.acceptUserId, userId)
        )
      )
      .get()
  );
  if (rShared.isErr()) {
    return Result.Err(`Failed to query shared token: ${rShared.Err().message}`);
  }
  const sharedRow = rShared.Ok();
  if (!sharedRow) {
    return Result.Err(`No access found for ${req.appSlug}/${req.userSlug}`);
  }

  if (new Date(sharedRow.InviteTokens.validUntil) < now) {
    return Result.Err(`Invite token has expired`);
  }

  const invite = InviteToken(sharedRow.InviteTokens.style);
  if (invite instanceof type.errors) {
    return Result.Err(`Invalid stored invite token: ${invite.summary}`);
  }

  console.log("shared-token", req.DbName, req.appSlug, req.userSlug);
  return Result.Ok({
    type: "res.get-fp-token" as const,
    ledger: sharedRow.AppSlugBindings.ledger,
    tenant: sharedRow.UserSlugBindings.tenant,
    roles: invite.roles,
    access: "shared" as const,
    token: req.DbName,
  });
}
