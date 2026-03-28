import { type } from "arktype";
import { FileSystemRef } from "@vibes.diy/call-ai-v2";
import { fileSystemItem, MetaItem } from "./types.js";
import { dashAuthType, vibeUserEnv, vibeFile, FSMode, NeedOneAppSlugUserSlug } from "./common.js";

export const ReqEnsureAppSlug = type({
  type: "'vibes.diy.req-ensure-app-slug'",
  auth: dashAuthType,
  mode: FSMode,
  "env?": vibeUserEnv,
  fileSystem: [vibeFile, "[]"],
}).and(NeedOneAppSlugUserSlug);

export type ReqEnsureAppSlug = typeof ReqEnsureAppSlug.infer;

// Response types
export const resEnsureAppSlugOk = type({
  type: "'vibes.diy.res-ensure-app-slug'",
  env: vibeUserEnv,
  fileSystem: [fileSystemItem, "[]"],
}).and(FileSystemRef);

export type ResEnsureAppSlugOk = typeof resEnsureAppSlugOk.infer;

export const resEnsureAppSlugRequireLogin = type({
  type: "'vibes.diy.error'",
  message: "string",
  code: "'require-login'",
  "stack?": "string[]",
});
export type ResEnsureAppSlugRequireLogin = typeof resEnsureAppSlugRequireLogin.infer;

export function isResEnsureAppSlugOk(obj: unknown): obj is ResEnsureAppSlugOk {
  return !(resEnsureAppSlugOk(obj) instanceof type.errors);
}

export const resEnsureAppSlugUserSlugInvalid = type({
  type: "'vibes.diy.error'",
  message: "string",
  code: "'user-slug-invalid'",
  "stack?": "string[]",
});
export type ResEnsureAppSlugUserSlugInvalid = typeof resEnsureAppSlugUserSlugInvalid.infer;

export function isResEnsureAppSlugUserSlugInvalid(obj: unknown): obj is ResEnsureAppSlugUserSlugInvalid {
  return !(resEnsureAppSlugUserSlugInvalid(obj) instanceof type.errors);
}

export const resEnsureAppSlugInvalid = type({
  type: "'vibes.diy.error'",
  message: "string",
  code: "'app-slug-invalid'",
  "stack?": "string[]",
});
export type ResEnsureAppSlugInvalid = typeof resEnsureAppSlugInvalid.infer;

export function isResEnsureAppSlugInvalid(obj: unknown): obj is ResEnsureAppSlugInvalid {
  return !(resEnsureAppSlugInvalid(obj) instanceof type.errors);
}

export const resEnsureAppSlugError = resEnsureAppSlugRequireLogin.or(resEnsureAppSlugUserSlugInvalid).or(resEnsureAppSlugInvalid);

export const resEnsureAppSlug = resEnsureAppSlugOk.or(resEnsureAppSlugError);

export type ResEnsureAppSlugError = typeof resEnsureAppSlugError.infer;

export type ResEnsureAppSlug = typeof resEnsureAppSlug.infer;
export function isResEnsureAppSlug(obj: unknown): obj is ResEnsureAppSlug {
  return !(resEnsureAppSlug(obj) instanceof type.errors);
}

export const reqGetChatDetails = type({
  type: "'vibes.diy.req-get-chat-details'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
});
export type ReqGetChatDetails = typeof reqGetChatDetails.infer;

export const resChatDetailsPrompt = type({
  prompt: "string",
  fsId: "string",
  created: "string",
});
export type ResChatDetailsPrompt = typeof resChatDetailsPrompt.infer;

export const resGetChatDetails = type({
  type: "'vibes.diy.res-get-chat-details'",
  chatId: "string",
  userSlug: "string",
  appSlug: "string",
  prompts: resChatDetailsPrompt.array(),
});
export type ResGetChatDetails = typeof resGetChatDetails.infer;
export function isResGetChatDetails(obj: unknown): obj is ResGetChatDetails {
  return !(resGetChatDetails(obj) instanceof type.errors);
}

export const reqGetAppByFsId = type({
  type: "'vibes.diy.req-get-app-by-fsid'",
  "auth?": dashAuthType,
  "fsId?": "string",
  appSlug: "string",
  userSlug: "string",
  "token?": "string",
});
export type ReqGetAppByFsId = typeof reqGetAppByFsId.infer;
export function isReqGetAppByFsId(obj: unknown): obj is ReqGetAppByFsId {
  return !(reqGetAppByFsId(obj) instanceof type.errors);
}

export const resGetAppByFsId = type({
  type: "'vibes.diy.res-get-app-by-fsid'",
  "error?": "string",
  appSlug: "string",
  userSlug: "string",
  "fsId?": "string",
  mode: "'production'|'dev'",
  grant:
    "'revoked-access'|'pending-request'| 'granted-access.editor'|'granted-access.viewer'|'owner'|'not-found'|'not-grant'|'public-access'|'accepted-email-invite'|'req-login.invite'|'req-login.request'",
  releaseSeq: "number",
  env: vibeUserEnv,
  fileSystem: [fileSystemItem, "[]"],
  meta: MetaItem.array(),
  created: "string",
});
export type ResGetAppByFsId = typeof resGetAppByFsId.infer;
export function isResGetAppByFsId(obj: unknown): obj is ResGetAppByFsId {
  return !(resGetAppByFsId(obj) instanceof type.errors);
}

export const reqGetByUserSlugAppSlug = type({
  type: "'vibes.diy.req-get-by-user-slug-app-slug'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
});

export const reqListUserSlugAppSlug = type({
  type: "'vibes.diy.req-list-user-slug-app-slug'",
  auth: dashAuthType,
  "userSlug?": "string",
  "appSlug?": "string",
});
export type ReqListUserSlugAppSlug = typeof reqListUserSlugAppSlug.infer;
export function isReqListUserSlugAppSlug(obj: unknown): obj is ReqListUserSlugAppSlug {
  return !(reqListUserSlugAppSlug(obj) instanceof type.errors);
}

export const resListUserSlugAppSlugItem = type({
  userId: "string",
  userSlug: "string",
  appSlugs: type("string").array(),
});
export type ResListUserSlugAppSlugItem = typeof resListUserSlugAppSlugItem.infer;

export const resListUserSlugAppSlug = type({
  type: "'vibes.diy.res-list-user-slug-app-slug'",
  items: resListUserSlugAppSlugItem.array(),
});
export type ResListUserSlugAppSlug = typeof resListUserSlugAppSlug.infer;
export function isResListUserSlugAppSlug(obj: unknown): obj is ResListUserSlugAppSlug {
  return !(resListUserSlugAppSlug(obj) instanceof type.errors);
}

export type ReqGetByUserSlugAppSlug = typeof reqGetByUserSlugAppSlug.infer;
export function isReqGetByUserSlugAppSlug(obj: unknown): obj is ReqGetByUserSlugAppSlug {
  return !(reqGetByUserSlugAppSlug(obj) instanceof type.errors);
}

export const resGetByUserSlugAppSlug = type({
  type: "'vibes.diy.res-get-by-user-slug-app-slug'",
}).and(FileSystemRef);

export type ResGetByUserSlugAppSlug = typeof resGetByUserSlugAppSlug.infer;
export function isResGetByUserSlugAppSlug(obj: unknown): obj is ResGetByUserSlugAppSlug {
  const res = resGetByUserSlugAppSlug(obj);
  if (res instanceof type.errors) {
    console.error(`Invalid resGetByUserSlugAppSlug:`, obj, res.summary);
  }
  return !(resGetByUserSlugAppSlug(obj) instanceof type.errors);
}

export const ResSetModeFs = type({
  type: "'vibes.diy.res-set-mode-fs'",
  fsId: "string",
  appSlug: "string",
  userSlug: "string",
  mode: FSMode,
});

export type ResSetModeFs = typeof ResSetModeFs.infer;
export function isResSetModeFs(obj: unknown): obj is ResSetModeFs {
  return !(ResSetModeFs(obj) instanceof type.errors);
}

export const ReqSetModeFs = type({
  type: "'vibes.diy.req-set-mode-fs'",
  auth: dashAuthType,
  fsId: "string",
  appSlug: "string",
  userSlug: "string",
  mode: FSMode,
});

export const reqSetModeFs = ReqSetModeFs;
export type ReqSetModeFs = typeof ReqSetModeFs.infer;
export function isReqSetModeFs(obj: unknown): obj is ReqSetModeFs {
  return !(ReqSetModeFs(obj) instanceof type.errors);
}
