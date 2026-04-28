import { type } from "arktype";
import { dashAuthType, Role } from "./common.js";

// ── listMembers ───────────────────────────────────────────────────
//
// Returns approved members of a vibe. Gated on read access (any reader
// can see who else is in the room) — does NOT expose emails, user ids,
// or pending requests. The owner-only `listInviteGrants` /
// `listRequestGrants` endpoints continue to provide that data.

export const memberItem = type({
  displayName: "string",
  role: Role,
});
export type MemberItem = typeof memberItem.infer;

export const reqListMembers = type({
  type: "'vibes.diy.req-list-members'",
  "auth?": dashAuthType,
  userSlug: "string",
  appSlug: "string",
});
export type ReqListMembers = typeof reqListMembers.infer;
export function isReqListMembers(obj: unknown): obj is ReqListMembers {
  return !(reqListMembers(obj) instanceof type.errors);
}

export const resListMembers = type({
  type: "'vibes.diy.res-list-members'",
  status: "'ok'",
  members: memberItem.array(),
});
export type ResListMembers = typeof resListMembers.infer;
export function isResListMembers(obj: unknown): obj is ResListMembers {
  return !(resListMembers(obj) instanceof type.errors);
}
