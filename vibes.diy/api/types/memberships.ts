import { type } from "arktype";
import { dashAuthType, Role } from "./common.js";

export const resMembershipItem = type({
  userSlug: "string", // app owner's slug
  appSlug: "string",
  activityAt: "string", // ISO — drives sort, shown as "last active"
  role: Role,
  "title?": "string",
  "icon?": type({ cid: "string", mime: "string" }),
});
export type ResMembershipItem = typeof resMembershipItem.infer;

export const reqListMemberships = type({
  type: "'vibes.diy.req-list-memberships'",
  auth: dashAuthType,
  "limit?": "number",
  "cursor?": "string",
});
export type ReqListMemberships = typeof reqListMemberships.infer;
export function isReqListMemberships(obj: unknown): obj is ReqListMemberships {
  return !(reqListMemberships(obj) instanceof type.errors);
}

export const resListMemberships = type({
  type: "'vibes.diy.res-list-memberships'",
  items: resMembershipItem.array(),
  "nextCursor?": "string",
});
export type ResListMemberships = typeof resListMemberships.infer;
export function isResListMemberships(obj: unknown): obj is ResListMemberships {
  return !(resListMemberships(obj) instanceof type.errors);
}
