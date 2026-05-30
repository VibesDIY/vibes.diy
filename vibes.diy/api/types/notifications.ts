import { type } from "arktype";
import { dashAuthType } from "./common.js";
import { evtCommentPosted } from "./app-documents.js";
import { evtRequestGrant } from "./request-access.js";
import { evtInviteGrant } from "./invite-flow.js";

export const userNotificationPreferences = type({
  buildCompleteSuccess: "boolean",
  buildCompleteFailed: "boolean",
  commentPosted: "boolean",
  accessRequestPending: "boolean",
});
export type UserNotificationPreferences = typeof userNotificationPreferences.infer;

export const defaultUserNotificationPreferences: UserNotificationPreferences = {
  buildCompleteSuccess: true,
  buildCompleteFailed: true,
  commentPosted: true,
  accessRequestPending: true,
};

export const userNotificationPreferencesPatch = type({
  "buildCompleteSuccess?": "boolean",
  "buildCompleteFailed?": "boolean",
  "commentPosted?": "boolean",
  "accessRequestPending?": "boolean",
});
export type UserNotificationPreferencesPatch = typeof userNotificationPreferencesPatch.infer;

export const reqSubscribeUserNotifications = type({
  type: "'vibes.diy.req-subscribe-user-notifications'",
  auth: dashAuthType,
});
export type ReqSubscribeUserNotifications = typeof reqSubscribeUserNotifications.infer;
export function isReqSubscribeUserNotifications(obj: unknown): obj is ReqSubscribeUserNotifications {
  return !(reqSubscribeUserNotifications(obj) instanceof type.errors);
}

export const resSubscribeUserNotifications = type({
  type: "'vibes.diy.res-subscribe-user-notifications'",
  status: "'ok'",
  userId: "string",
});
export type ResSubscribeUserNotifications = typeof resSubscribeUserNotifications.infer;
export function isResSubscribeUserNotifications(obj: unknown): obj is ResSubscribeUserNotifications {
  return !(resSubscribeUserNotifications(obj) instanceof type.errors);
}

export const reqGetUserNotificationPreferences = type({
  type: "'vibes.diy.req-get-user-notification-preferences'",
  auth: dashAuthType,
});
export type ReqGetUserNotificationPreferences = typeof reqGetUserNotificationPreferences.infer;
export function isReqGetUserNotificationPreferences(obj: unknown): obj is ReqGetUserNotificationPreferences {
  return !(reqGetUserNotificationPreferences(obj) instanceof type.errors);
}

export const resGetUserNotificationPreferences = type({
  type: "'vibes.diy.res-get-user-notification-preferences'",
  userId: "string",
  preferences: userNotificationPreferences,
  updated: "string",
  created: "string",
});
export type ResGetUserNotificationPreferences = typeof resGetUserNotificationPreferences.infer;
export function isResGetUserNotificationPreferences(obj: unknown): obj is ResGetUserNotificationPreferences {
  return !(resGetUserNotificationPreferences(obj) instanceof type.errors);
}

export const reqSetUserNotificationPreferences = type({
  type: "'vibes.diy.req-set-user-notification-preferences'",
  auth: dashAuthType,
  preferences: userNotificationPreferencesPatch,
});
export type ReqSetUserNotificationPreferences = typeof reqSetUserNotificationPreferences.infer;
export function isReqSetUserNotificationPreferences(obj: unknown): obj is ReqSetUserNotificationPreferences {
  return !(reqSetUserNotificationPreferences(obj) instanceof type.errors);
}

export const resSetUserNotificationPreferences = type({
  type: "'vibes.diy.res-set-user-notification-preferences'",
  userId: "string",
  preferences: userNotificationPreferences,
  updated: "string",
  created: "string",
});
export type ResSetUserNotificationPreferences = typeof resSetUserNotificationPreferences.infer;
export function isResSetUserNotificationPreferences(obj: unknown): obj is ResSetUserNotificationPreferences {
  return !(resSetUserNotificationPreferences(obj) instanceof type.errors);
}

export const evtBuildComplete = type({
  type: "'vibes.diy.evt-build-complete'",
  userSlug: "string",
  appSlug: "string",
  promptId: "string",
  status: "'success' | 'failed'",
  "durationMs?": "number",
});
export type EvtBuildComplete = typeof evtBuildComplete.infer;
export function isEvtBuildComplete(obj: unknown): obj is EvtBuildComplete {
  return !(evtBuildComplete(obj) instanceof type.errors);
}

export const userNotificationEvent = evtBuildComplete.or(evtCommentPosted).or(evtRequestGrant).or(evtInviteGrant);
export type UserNotificationEvent = typeof userNotificationEvent.infer;

export function userNotificationSubscriptionKey(userId: string): string {
  return `user/${userId}`;
}
