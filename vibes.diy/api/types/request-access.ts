import { type } from "arktype";
import { dashAuthType, ClerkClaim, ForeignInfo, GrantListBase, Role } from "./common.js";

export const ReqRequestAccess = type({
  type: "'vibes.diy.req-request-access'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
});
export type ReqRequestAccess = typeof ReqRequestAccess.infer;
export function isReqRequestAccess(obj: unknown): obj is ReqRequestAccess {
  return !(ReqRequestAccess(obj) instanceof type.errors);
}

export const ResRequestAccessBase = type({
  type: "'vibes.diy.res-request-access'",
  appSlug: "string",
  userSlug: "string",
  foreignUserId: "string",
  foreignInfo: ForeignInfo,
  updated: "string",
  created: "string",
});

export const ResRequestAccessPending = type({ state: "'pending'" }).and(ResRequestAccessBase);
export type ResRequestAccessPending = typeof ResRequestAccessPending.infer;
export function isResRequestAccessPending(obj: unknown): obj is ResRequestAccessPending {
  return !(ResRequestAccessPending(obj) instanceof type.errors);
}

export const ResRequestAccessApproved = type({ state: "'approved'", role: Role }).and(ResRequestAccessBase);

export type ResRequestAccessApproved = typeof ResRequestAccessApproved.infer;
export function isResRequestAccessApproved(obj: unknown): obj is ResRequestAccessApproved {
  return !(ResRequestAccessApproved(obj) instanceof type.errors);
}

export const ResRequestAccessRevoked = type({ state: "'revoked'", role: Role }).and(ResRequestAccessBase);

export type ResRequestAccessRevoked = typeof ResRequestAccessRevoked.infer;
export function isResRequestAccessRevoked(obj: unknown): obj is ResRequestAccessRevoked {
  return !(ResRequestAccessRevoked(obj) instanceof type.errors);
}

export const ResRequestAccess = ResRequestAccessPending.or(ResRequestAccessApproved).or(ResRequestAccessRevoked);
export type ResRequestAccess = typeof ResRequestAccess.infer;
export function isResRequestAccess(obj: unknown): obj is ResRequestAccess {
  return !(ResRequestAccess(obj) instanceof type.errors);
}

export const ReqApproveRequest = type({
  type: "'vibes.diy.req-approve-request'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
  foreignUserId: "string",
  role: Role,
});
export type ReqApproveRequest = typeof ReqApproveRequest.infer;
export function isReqApproveRequest(obj: unknown): obj is ReqApproveRequest {
  return !(ReqApproveRequest(obj) instanceof type.errors);
}

export const ResApproveRequest = type({
  type: "'vibes.diy.res-approve-request'",
  appSlug: "string",
  userSlug: "string",
  foreignUserId: "string",
  role: Role,
  state: "'approved'",
  updated: "string",
});
export type ResApproveRequest = typeof ResApproveRequest.infer;
export function isResApproveRequest(obj: unknown): obj is ResApproveRequest {
  return !(ResApproveRequest(obj) instanceof type.errors);
}

export const ReqRequestSetRole = type({
  type: "'vibes.diy.req-request-set-role'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
  foreignUserId: "string",
  role: Role,
});
export type ReqRequestSetRole = typeof ReqRequestSetRole.infer;
export function isReqRequestSetRole(obj: unknown): obj is ReqRequestSetRole {
  return !(ReqRequestSetRole(obj) instanceof type.errors);
}

export const ResRequestSetRole = type({
  type: "'vibes.diy.res-request-set-role'",
  appSlug: "string",
  userSlug: "string",
  foreignUserId: "string",
  role: Role,
});
export type ResRequestSetRole = typeof ResRequestSetRole.infer;
export function isResRequestSetRole(obj: unknown): obj is ResRequestSetRole {
  return !(ResRequestSetRole(obj) instanceof type.errors);
}

export const ReqRevokeRequest = type({
  type: "'vibes.diy.req-revoke-request'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
  foreignUserId: "string",
  "delete?": "boolean",
});
export type ReqRevokeRequest = typeof ReqRevokeRequest.infer;
export function isReqRevokeRequest(obj: unknown): obj is ReqRevokeRequest {
  return !(ReqRevokeRequest(obj) instanceof type.errors);
}

export const ResRevokeRequest = type({
  type: "'vibes.diy.res-revoke-request'",
  appSlug: "string",
  userSlug: "string",
  foreignUserId: "string",
  deleted: "boolean",
});
export type ResRevokeRequest = typeof ResRevokeRequest.infer;
export function isResRevokeRequest(obj: unknown): obj is ResRevokeRequest {
  return !(ResRevokeRequest(obj) instanceof type.errors);
}

export const ReqHasAccessRequest = type({
  type: "'vibes.diy.req-has-access-request'",
  auth: dashAuthType,
  appSlug: "string",
  userSlug: "string",
});
export type ReqHasAccessRequest = typeof ReqHasAccessRequest.infer;
export function isReqHasAccessRequest(obj: unknown): obj is ReqHasAccessRequest {
  return !(ReqHasAccessRequest(obj) instanceof type.errors);
}

export const ResHasAccessRequestBase = type({
  type: "'vibes.diy.res-has-access-request'",
  appSlug: "string",
  userSlug: "string",
});

export const ResHasAccessRequestNotFound = type({
  state: "'not-found'",
}).and(ResHasAccessRequestBase);
export type ResHasAccessRequestNotFound = typeof ResHasAccessRequestNotFound.infer;
export function isResHasAccessRequestNotFound(obj: unknown): obj is ResHasAccessRequestNotFound {
  return !(ResHasAccessRequestNotFound(obj) instanceof type.errors);
}

export const ResHasAccessRequestPending = ResHasAccessRequestBase.and(
  type({ state: "'pending'", role: Role.or("undefined | null") })
);
export type ResHasAccessRequestPending = typeof ResHasAccessRequestPending.infer;
export function isResHasAccessRequestPending(obj: unknown): obj is ResHasAccessRequestPending {
  return !(ResHasAccessRequestPending(obj) instanceof type.errors);
}

export const ResHasAccessRequestApproved = type({
  state: "'approved'",
  role: Role,
}).and(ResHasAccessRequestBase);

export type ResHasAccessRequestApproved = typeof ResHasAccessRequestApproved.infer;
export function isResHasAccessRequestApproved(obj: unknown): obj is ResHasAccessRequestApproved {
  return !(ResHasAccessRequestApproved(obj) instanceof type.errors);
}

export const ResHasAccessRequestRevoked = type({
  state: "'revoked'",
}).and(ResHasAccessRequestBase);
export type ResHasAccessRequestRevoked = typeof ResHasAccessRequestRevoked.infer;
export function isResHasAccessRequestRevoked(obj: unknown): obj is ResHasAccessRequestRevoked {
  return !(ResHasAccessRequestRevoked(obj) instanceof type.errors);
}

export const ResHasAccessRequest = ResHasAccessRequestNotFound.or(ResHasAccessRequestPending)
  .or(ResHasAccessRequestApproved)
  .or(ResHasAccessRequestRevoked);
export type ResHasAccessRequest = typeof ResHasAccessRequest.infer;
export function isResHasAccessRequest(obj: unknown): obj is ResHasAccessRequest {
  return !(ResHasAccessRequest(obj) instanceof type.errors);
}

export const ResFlowOwnerError = type({
  type: "'vibes.diy.error'",
  message: "string",
  code: "'owner-error'",
  "stack?": "string[]",
});
export type ResFlowOwnerError = typeof ResFlowOwnerError.infer;
export function isResFlowOwnerError(obj: unknown): obj is ResFlowOwnerError {
  return !(ResFlowOwnerError(obj) instanceof type.errors);
}

export const ResRequestAccessError = type({
  type: "'vibes.diy.error'",
  message: "string",
  code: "'request-access-app-not-found' | 'request-access-not-enabled'",
  "stack?": "string[]",
});
export type ResRequestAccessError = typeof ResRequestAccessError.infer;
export function isResRequestAccessError(obj: unknown): obj is ResRequestAccessError {
  return !(ResRequestAccessError(obj) instanceof type.errors);
}

export const ResApproveRequestError = type({
  type: "'vibes.diy.error'",
  message: "string",
  code: "'approve-request-not-found'",
  "stack?": "string[]",
});
export type ResApproveRequestError = typeof ResApproveRequestError.infer;

export const ResRequestSetRoleError = type({
  type: "'vibes.diy.error'",
  message: "string",
  code: "'request-set-role-not-found'",
  "stack?": "string[]",
});
export type ResRequestSetRoleError = typeof ResRequestSetRoleError.infer;

export const ResRequestAccessFlow = ResRequestAccess.or(ResRequestAccessError).or(ResFlowOwnerError);
export type ResRequestAccessFlow = typeof ResRequestAccessFlow.infer;
export function isResRequestAccessFlow(obj: unknown): obj is ResRequestAccessFlow {
  return !(ResRequestAccessFlow(obj) instanceof type.errors);
}

export const ResHasAccessRequestFlow = ResHasAccessRequest.or(ResFlowOwnerError);
export type ResHasAccessRequestFlow = typeof ResHasAccessRequestFlow.infer;
export function isResHasAccessRequestFlow(obj: unknown): obj is ResHasAccessRequestFlow {
  return !(ResHasAccessRequestFlow(obj) instanceof type.errors);
}

export const ReqListRequestGrants = type({
  type: "'vibes.diy.req-list-request-grants'",
}).and(GrantListBase);
export type ReqListRequestGrants = typeof ReqListRequestGrants.infer;
export function isReqListRequestGrants(obj: unknown): obj is ReqListRequestGrants {
  return !(ReqListRequestGrants(obj) instanceof type.errors);
}

export const ResListRequestGrants = type({
  type: "'vibes.diy.res-list-request-grants'",
  appSlug: "string",
  userSlug: "string",
  items: type({
    foreignUserId: "string",
    state: "'pending' | 'approved' | 'revoked'",
    role: Role.or("undefined | null"),
    foreignInfo: type({
      "claims?": ClerkClaim.partial(),
    }),
    tick: "string",
    updated: "string",
    created: "string",
  }).array(),
  "nextCursor?": "string",
});
export type ResListRequestGrants = typeof ResListRequestGrants.infer;
export function isResListRequestGrants(obj: unknown): obj is ResListRequestGrants {
  const x = ResListRequestGrants(obj);
  if (x instanceof type.errors) {
    console.error("ResListRequestGrants validation error:", x.summary);
  }
  return !(x instanceof type.errors);
}

export const evtRequestGrant = type({
  op: "'upsert' | 'delete'",
  type: "'vibes.diy.evt-request-grant'",
  userId: "string",
  grant: ResRequestAccess,
});
export type EvtRequestGrant = typeof evtRequestGrant.infer;

export function isEvtRequestGrant(obj: unknown): obj is EvtRequestGrant {
  return !(evtRequestGrant(obj) instanceof type.errors);
}
