import { type } from "arktype";
import { dashAuthType, ClerkClaim, ForeignInfo, InviteForeignInfo, Pager, GrantListBase, Role } from "./common.js";
import { ActiveACL } from "./invite.js";

// shared identity for all key-grant messages
export const KeyGrantKey = type({
  appSlug: "string",
  userSlug: "string",
  grantType: "'invite' | 'request'",
  key: "string",
});
export type KeyGrantKey = typeof KeyGrantKey.infer;

// response payload returned by upsert
export const ResKeyGrantItem = type({
  entry: ActiveACL,
  "grantUserId?": "string",
  grantType: "'invite' | 'request'",
  key: "string",
  updated: "string",
});
export type ResKeyGrantItem = typeof ResKeyGrantItem.infer;

export const ReqListKeyGrants = type({
  type: "'vibes.diy.req-list-key-grants'",
  auth: dashAuthType,
  pager: Pager,
}).and(KeyGrantKey.omit("key"));
export type ReqListKeyGrants = typeof ReqListKeyGrants.infer;
export function isReqListKeyGrants(obj: unknown): obj is ReqListKeyGrants {
  return !(ReqListKeyGrants(obj) instanceof type.errors);
}

export const ResListKeyGrants = type({
  type: "'vibes.diy.res-list-key-grants'",
  items: type({
    key: "string",
    entry: ActiveACL,
    "grantUserId?": "string",
    updated: "string",
    created: "string",
  }).array(),
  "nextCursor?": "string",
}).and(KeyGrantKey.omit("key"));
export type ResListKeyGrants = typeof ResListKeyGrants.infer;
export function isResListKeyGrants(obj: unknown): obj is ResListKeyGrants {
  return !(ResListKeyGrants(obj) instanceof type.errors);
}

export const ReqUpsertKeyGrant = type({
  type: "'vibes.diy.req-upsert-key-grant'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
  entry: ActiveACL,
});
export type ReqUpsertKeyGrant = typeof ReqUpsertKeyGrant.infer;
export function isReqUpsertKeyGrant(obj: unknown): obj is ReqUpsertKeyGrant {
  return !(ReqUpsertKeyGrant(obj) instanceof type.errors);
}

export const ResUpsertKeyGrant = type({
  type: "'vibes.diy.res-upsert-key-grant'",
})
  .and(KeyGrantKey)
  .and(ResKeyGrantItem);
export type ResUpsertKeyGrant = typeof ResUpsertKeyGrant.infer;
export function isResUpsertKeyGrant(obj: unknown): obj is ResUpsertKeyGrant {
  return !(ResUpsertKeyGrant(obj) instanceof type.errors);
}

export const ReqDeleteKeyGrant = type({
  type: "'vibes.diy.req-delete-key-grant'",
  auth: dashAuthType,
}).and(KeyGrantKey);
export type ReqDeleteKeyGrant = typeof ReqDeleteKeyGrant.infer;
export function isReqDeleteKeyGrant(obj: unknown): obj is ReqDeleteKeyGrant {
  return !(ReqDeleteKeyGrant(obj) instanceof type.errors);
}

export const ResDeleteKeyGrant = type({
  type: "'vibes.diy.res-delete-key-grant'",
  deleted: "boolean",
}).and(KeyGrantKey);
export type ResDeleteKeyGrant = typeof ResDeleteKeyGrant.infer;
export function isResDeleteKeyGrant(obj: unknown): obj is ResDeleteKeyGrant {
  return !(ResDeleteKeyGrant(obj) instanceof type.errors);
}

export const ReqRedeemInvite = type({
  type: "'vibes.diy.req-redeem-invite'",
  auth: dashAuthType,
  token: "string",
});
export type ReqRedeemInvite = typeof ReqRedeemInvite.infer;
export function isReqRedeemInvite(obj: unknown): obj is ReqRedeemInvite {
  return !(ReqRedeemInvite(obj) instanceof type.errors);
}

export const ResRedeemInviteOK = type({
  type: "'vibes.diy.res-redeem-invite'",
  appSlug: "string",
  userSlug: "string",
  emailKey: "string",
  role: Role,
  state: "'accepted'",
});
export type ResRedeemInviteOK = typeof ResRedeemInviteOK.infer;
export function isResRedeemInviteOK(obj: unknown): obj is ResRedeemInviteOK {
  return !(ResRedeemInviteOK(obj) instanceof type.errors);
}

export const ResRedeemInviteError = type({
  type: "'vibes.diy.error'",
  message: "string",
  code: "'redeem-invite-failed'",
  "stack?": "string[]",
});
export type ResRedeemInviteError = typeof ResRedeemInviteError.infer;

export function isResRedeemInviteError(obj: unknown): obj is ResRedeemInviteError {
  return !(ResRedeemInviteError(obj) instanceof type.errors);
}

export const ResRedeemInvite = ResRedeemInviteOK.or(ResRedeemInviteError);
export type ResRedeemInvite = typeof ResRedeemInvite.infer;
export function isResRedeemInvite(obj: unknown): obj is ResRedeemInvite {
  return !(ResRedeemInvite(obj) instanceof type.errors);
}

export const InviteGrantItem = type({
  appSlug: "string",
  userSlug: "string",
  emailKey: "string",
  state: "'pending' | 'accepted' | 'revoked'",
  role: Role,
  tokenOrGrantUserId: "string",
  foreignInfo: InviteForeignInfo,
  updated: "string",
  created: "string",
});
export type InviteGrantItem = typeof InviteGrantItem.infer;

export const ReqCreateInvite = type({
  type: "'vibes.diy.req-create-invite'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
  invitedEmail: "string",
  role: Role,
});
export type ReqCreateInvite = typeof ReqCreateInvite.infer;
export function isReqCreateInvite(obj: unknown): obj is ReqCreateInvite {
  return !(ReqCreateInvite(obj) instanceof type.errors);
}

export const ResCreateInvite = type({
  type: "'vibes.diy.res-create-invite'",
  appSlug: "string",
  userSlug: "string",
}).and(InviteGrantItem);
export type ResCreateInvite = typeof ResCreateInvite.infer;
export function isResCreateInvite(obj: unknown): obj is ResCreateInvite {
  return !(ResCreateInvite(obj) instanceof type.errors);
}

export const ReqHasAccessInvite = type({
  type: "'vibes.diy.req-has-access-invite'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
});
export type ReqHasAccessInvite = typeof ReqHasAccessInvite.infer;
export function isReqHasAccessInvite(obj: unknown): obj is ReqHasAccessInvite {
  return !(ReqHasAccessInvite(obj) instanceof type.errors);
}

export const ResHasAccessInviteBase = type({
  type: "'vibes.diy.res-has-access-invite'",
  appSlug: "string",
  userSlug: "string",
});

export const ResHasAccessInviteNotFound = type({
  state: "'not-found'",
}).and(ResHasAccessInviteBase);
export type ResHasAccessInviteNotFound = typeof ResHasAccessInviteNotFound.infer;
export function isResHasAccessInviteNotFound(obj: unknown): obj is ResHasAccessInviteNotFound {
  return !(ResHasAccessInviteNotFound(obj) instanceof type.errors);
}

export const ResHasAccessInviteRevoke = type({
  state: "'revoked'",
}).and(ResHasAccessInviteBase);
export type ResHasAccessInviteRevoke = typeof ResHasAccessInviteRevoke.infer;
export function isResHasAccessInviteRevoke(obj: unknown): obj is ResHasAccessInviteRevoke {
  return !(ResHasAccessInviteRevoke(obj) instanceof type.errors);
}

export const ResHasAccessInviteAccepted = ResHasAccessInviteBase.and(
  type({ state: "'accepted'", role: Role, tokenOrGrantUserId: "string" })
);
export type ResHasAccessInviteAccepted = typeof ResHasAccessInviteAccepted.infer;
export function isResHasAccessInviteAccepted(obj: unknown): obj is ResHasAccessInviteAccepted {
  return !(ResHasAccessInviteAccepted(obj) instanceof type.errors);
}

export const ResHasAccessInvitePending = ResHasAccessInviteBase.and(
  type({ state: "'pending'", role: Role, tokenOrGrantUserId: "string" })
);
export type ResHasAccessInvitePending = typeof ResHasAccessInvitePending.infer;
export function isResHasAccessInvitePending(obj: unknown): obj is ResHasAccessInvitePending {
  return !(ResHasAccessInvitePending(obj) instanceof type.errors);
}

export const ResHasAccessInvite = ResHasAccessInviteNotFound.or(ResHasAccessInviteRevoke)
  .or(ResHasAccessInviteAccepted)
  .or(ResHasAccessInvitePending);
export type ResHasAccessInvite = typeof ResHasAccessInvite.infer;
export function isResHasAccessInvite(obj: unknown): obj is ResHasAccessInvite {
  return !(ResHasAccessInvite(obj) instanceof type.errors);
}

export const ReqInviteSetRole = type({
  type: "'vibes.diy.req-invite-set-role'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
  emailKey: "string",
  role: Role,
});
export type ReqInviteSetRole = typeof ReqInviteSetRole.infer;
export function isReqInviteSetRole(obj: unknown): obj is ReqInviteSetRole {
  return !(ReqInviteSetRole(obj) instanceof type.errors);
}

export const ResInviteSetRole = type({
  type: "'vibes.diy.res-invite-set-role'",
  appSlug: "string",
  userSlug: "string",
  emailKey: "string",
  role: Role,
});
export type ResInviteSetRole = typeof ResInviteSetRole.infer;
export function isResInviteSetRole(obj: unknown): obj is ResInviteSetRole {
  return !(ResInviteSetRole(obj) instanceof type.errors);
}

export const ReqRevokeInvite = type({
  type: "'vibes.diy.req-revoke-invite'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
  emailKey: "string",
  "delete?": "boolean",
});
export type ReqRevokeInvite = typeof ReqRevokeInvite.infer;
export function isReqRevokeInvite(obj: unknown): obj is ReqRevokeInvite {
  return !(ReqRevokeInvite(obj) instanceof type.errors);
}

export const ResRevokeInvite = type({
  type: "'vibes.diy.res-revoke-invite'",
  appSlug: "string",
  userSlug: "string",
  emailKey: "string",
  deleted: "boolean",
});
export type ResRevokeInvite = typeof ResRevokeInvite.infer;
export function isResRevokeInvite(obj: unknown): obj is ResRevokeInvite {
  return !(ResRevokeInvite(obj) instanceof type.errors);
}

export const ReqListInviteGrants = type({
  type: "'vibes.diy.req-list-invite-grants'",
}).and(GrantListBase);
export type ReqListInviteGrants = typeof ReqListInviteGrants.infer;
export function isReqListInviteGrants(obj: unknown): obj is ReqListInviteGrants {
  return !(ReqListInviteGrants(obj) instanceof type.errors);
}

export const ResListInviteGrants = type({
  type: "'vibes.diy.res-list-invite-grants'",
  appSlug: "string",
  userSlug: "string",
  items: InviteGrantItem.array(),
  "nextCursor?": "string",
});
export type ResListInviteGrants = typeof ResListInviteGrants.infer;
export function isResListInviteGrants(obj: unknown): obj is ResListInviteGrants {
  return !(ResListInviteGrants(obj) instanceof type.errors);
}

export const evtInviteGrant = type({
  op: "'upsert' | 'delete'",
  type: "'vibes.diy.evt-invite-grant'",
  userId: "string",
  grant: InviteGrantItem,
});
export type EvtInviteGrant = typeof evtInviteGrant.infer;

export function isEvtInviteGrant(obj: unknown): obj is EvtInviteGrant {
  return !(evtInviteGrant(obj) instanceof type.errors);
}

// Re-export ForeignInfo so consumers can import from one place
export { ForeignInfo, InviteForeignInfo, ClerkClaim };
