import { type } from "arktype";
import { dashAuthType } from "./msg-types.js";

export const RoleType = type({
  type: "'admin' | 'editor' | 'viewer'",
  // currently we only have the editor
  // due to fireproof's current permission model,
  // but we can expand this in the future
});

export const InviteTokenBase = type({
  type: "'vibes.diy.invite-token'",
  token: "string",

  appSlug: "string",
  userSlug: "string",
  roles: RoleType.array(),
  ownerUserId: "string",
  validUntil: "Date",
  created: "Date",
});

export const InviteEmailToken = type({
  style: "'email'",
  email: "string",
}).and(InviteTokenBase);

export type InviteEmailToken = typeof InviteEmailToken.infer;

export const InviteLinkToken = type({
  style: "'link'",
  acceptCount: "number",
}).and(InviteTokenBase);

export type InviteLinkToken = typeof InviteLinkToken.infer;

export function isInviteEmailToken(obj: unknown): obj is typeof InviteEmailToken.infer {
  return !(InviteEmailToken(obj) instanceof type.errors);
}

export function isInviteLinkToken(obj: unknown): obj is typeof InviteLinkToken.infer {
  return !(InviteLinkToken(obj) instanceof type.errors);
}

export const InviteToken = InviteEmailToken.or(InviteLinkToken);

export type InviteToken = typeof InviteToken.infer;

export const AcceptInvite = type({
  type: "'vibes.diy.accept-token'",
  token: "string",
  acceptUserId: "string",
  created: "Date",
});

// Request-specific invite payload types (without server-generated fields)
const ReqInviteBasePayload = type({
  appSlug: "string",
  userSlug: "string",
  roles: RoleType.array(),
  "validUntil?": "Date",
});

export const ReqInviteEmailPayload = type({
  style: "'email'",
  email: "string",
}).and(ReqInviteBasePayload);

export type ReqInviteEmailPayload = typeof ReqInviteEmailPayload.infer;

export const ReqInviteLinkPayload = type({
  style: "'link'",
  acceptCount: "number",
}).and(ReqInviteBasePayload);

export type ReqInviteLinkPayload = typeof ReqInviteLinkPayload.infer;

export function isReqInviteEmailPayload(obj: unknown): obj is typeof ReqInviteEmailPayload.infer {
  return !(ReqInviteEmailPayload(obj) instanceof type.errors);
}

export function isReqInviteLinkPayload(obj: unknown): obj is typeof ReqInviteLinkPayload.infer {
  return !(ReqInviteLinkPayload(obj) instanceof type.errors);
}

export const ReqInviteToken = type({
  type: "'req.invite'",
  auth: dashAuthType,
  invite: ReqInviteEmailPayload.or(ReqInviteLinkPayload),
});
export type ReqInviteToken = typeof ReqInviteToken.infer;

export function isReqInviteToken(obj: unknown): obj is typeof ReqInviteToken.infer {
  return !(ReqInviteToken(obj) instanceof type.errors);
}

export const ResInviteToken = type({
  type: "'res.invite'",
  invite: InviteToken,
});

export type ResInviteToken = typeof ResInviteToken.infer;

export const ReqDeleteInviteToken = type({
  type: "'req.delete-invite'",
  auth: dashAuthType,
  token: "string",
});

export type ReqDeleteInviteToken = typeof ReqDeleteInviteToken.infer;

export function isReqDeleteInviteToken(obj: unknown): obj is typeof ReqDeleteInviteToken.infer {
  return !(ReqDeleteInviteToken(obj) instanceof type.errors);
}

export const ResDeleteInviteToken = type({
  type: "'res.delete-invite'",
  token: "string",
});

export type ResDeleteInviteToken = typeof ResDeleteInviteToken.infer;

export const ReqAcceptInvite = type({
  type: "'req.accept-invite'",
  auth: dashAuthType,
  token: "string",
});

export type ReqAcceptInvite = typeof ReqAcceptInvite.infer;

export function isReqAcceptInvite(obj: unknown): obj is typeof ReqAcceptInvite.infer {
  return !(ReqAcceptInvite(obj) instanceof type.errors);
}

export const AcceptedClerkInfo = type({
  type: "'accepted-clerk-info'",
  "email?": "string",
  "nick?": "string",
});

export type AcceptedClerkInfo = typeof AcceptedClerkInfo.infer;

export const ResAcceptInvite = type({
  type: "'res.accept-invite'",
  token: "string",
  appSlug: "string",
  userSlug: "string",
  roles: RoleType.array(),
  acceptedInfo: AcceptedClerkInfo.array(),
});

export type ResAcceptInvite = typeof ResAcceptInvite.infer;

// Accept record as returned in list results (no acceptUserId exposed)
export const AcceptParams = type({
  acceptId: "string",
  token: "string",
  acceptedInfo: AcceptedClerkInfo,
  created: "Date",
});

export type AcceptParams = typeof AcceptParams.infer;

// Combined invite + its accepts
export const InviteWithAccepts = type({
  inviteParams: InviteToken,
  accepts: AcceptParams.array(),
});

export type InviteWithAccepts = typeof InviteWithAccepts.infer;

export const AppUserSlug = type({
  appSlug: "string",
  userSlug: "string",
});

export type AppUserSlug = typeof AppUserSlug.infer;

export const ReqListAcceptedInvites = type({
  type: "'req.list-accepted-invites'",
  auth: dashAuthType,
  slugs: AppUserSlug.array(),
});

export type ReqListAcceptedInvites = typeof ReqListAcceptedInvites.infer;

export function isReqListAcceptedInvites(obj: unknown): obj is typeof ReqListAcceptedInvites.infer {
  return !(ReqListAcceptedInvites(obj) instanceof type.errors);
}

export const ResListAcceptedInvites = type({
  type: "'res.list-accepted-invites'",
  items: InviteWithAccepts.array(),
});

export type ResListAcceptedInvites = typeof ResListAcceptedInvites.infer;

export const ReqDeleteAccept = type({
  type: "'req.delete-accept'",
  auth: dashAuthType,
  acceptId: "string",
});

export type ReqDeleteAccept = typeof ReqDeleteAccept.infer;

export function isReqDeleteAccept(obj: unknown): obj is typeof ReqDeleteAccept.infer {
  return !(ReqDeleteAccept(obj) instanceof type.errors);
}

export const ResDeleteAccept = type({
  type: "'res.delete-accept'",
  acceptId: "string",
});

export type ResDeleteAccept = typeof ResDeleteAccept.infer;

export const ReqGetFPToken = type({
  type: "'req.get-fp-token'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
  DbName: "string",
});

export type ReqGetFPToken = typeof ReqGetFPToken.infer;

export function isReqGetFPToken(obj: unknown): obj is typeof ReqGetFPToken.infer {
  return !(ReqGetFPToken(obj) instanceof type.errors);
}

export const ResFPToken = type({
  type: "'res.get-fp-token'",
  ledger: "string",
  tenant: "string",
  roles: RoleType.array(),
  access: "'owner' | 'shared'",
  token: "string",
});

export type ResFPToken = typeof ResFPToken.infer;
