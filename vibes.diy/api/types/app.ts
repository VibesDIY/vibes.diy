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
  type: "'vibes.diy.res-error'",
  error: type({ message: "string", code: "'require-login'" }),
});
export type ResEnsureAppSlugRequireLogin = typeof resEnsureAppSlugRequireLogin.infer;

export function isResEnsureAppSlugOk(obj: unknown): obj is ResEnsureAppSlugOk {
  return !(resEnsureAppSlugOk(obj) instanceof type.errors);
}

export const resEnsureAppSlugUserSlugInvalid = type({
  type: "'vibes.diy.res-error'",
  error: type({ message: "string", code: "'user-slug-invalid'" }),
});
export type ResEnsureAppSlugUserSlugInvalid = typeof resEnsureAppSlugUserSlugInvalid.infer;

export function isResEnsureAppSlugUserSlugInvalid(obj: unknown): obj is ResEnsureAppSlugUserSlugInvalid {
  return !(resEnsureAppSlugUserSlugInvalid(obj) instanceof type.errors);
}

export const resEnsureAppSlugInvalid = type({
  type: "'vibes.diy.res-error'",
  error: type({ message: "string", code: "'app-slug-invalid'" }),
});
export type ResEnsureAppSlugInvalid = typeof resEnsureAppSlugInvalid.infer;

const resEnsureAppSlugMaxAppsError = type({
  type: "'vibes.diy.res-error'",
  error: type({ message: "string", code: "'max-app-slugs-reached'" }),
});
export type ResEnsureAppSlugMaxAppsError = typeof resEnsureAppSlugMaxAppsError.infer;

export function isResEnsureAppSlugMaxAppsError(obj: unknown): obj is ResEnsureAppSlugMaxAppsError {
  return !(resEnsureAppSlugMaxAppsError(obj) instanceof type.errors);
}

export function isResEnsureAppSlugInvalid(obj: unknown): obj is ResEnsureAppSlugInvalid {
  return !(resEnsureAppSlugInvalid(obj) instanceof type.errors);
}

export const resEnsureAppSlugError = resEnsureAppSlugRequireLogin
  .or(resEnsureAppSlugUserSlugInvalid)
  .or(resEnsureAppSlugInvalid)
  .or(resEnsureAppSlugMaxAppsError);

export const resEnsureAppSlug = resEnsureAppSlugOk.or(resEnsureAppSlugError);

export type ResEnsureAppSlugError = typeof resEnsureAppSlugError.infer;
export function isResEnsureAppSlugError(obj: unknown): obj is ResEnsureAppSlugError {
  return !(resEnsureAppSlugError(obj) instanceof type.errors);
}

export type ResEnsureAppSlug = typeof resEnsureAppSlug.infer;
export function isResEnsureAppSlug(obj: unknown): obj is ResEnsureAppSlug {
  return !(resEnsureAppSlug(obj) instanceof type.errors);
}

export const reqGetChatDetails = type({
  type: "'vibes.diy.req-get-chat-details'",
  auth: dashAuthType,
  ownerHandle: "string",
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
  ownerHandle: "string",
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
  ownerHandle: "string",
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
  ownerHandle: "string",
  "ownerDisplayName?": "string",
  "fsId?": "string",
  mode: "'production'|'dev'",
  grant:
    "'revoked-access'|'pending-request'| 'granted-access.editor'|'granted-access.viewer'|'granted-access.submitter'|'owner'|'not-found'|'not-grant'|'public-access'|'accepted-email-invite'|'req-login.invite'|'req-login.request'",
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
  ownerHandle: "string",
  appSlug: "string",
});

export const reqListUserSlugAppSlug = type({
  type: "'vibes.diy.req-list-user-slug-app-slug'",
  auth: dashAuthType,
  "ownerHandle?": "string",
  "appSlug?": "string",
});
export type ReqListUserSlugAppSlug = typeof reqListUserSlugAppSlug.infer;
export function isReqListUserSlugAppSlug(obj: unknown): obj is ReqListUserSlugAppSlug {
  return !(reqListUserSlugAppSlug(obj) instanceof type.errors);
}

export const resListUserSlugAppSlugItem = type({
  userId: "string",
  ownerHandle: "string",
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

export const reqListRecentVibes = type({
  type: "'vibes.diy.req-list-recent-vibes'",
  auth: dashAuthType,
  "limit?": "number",
  "cursor?": "string",
});
export type ReqListRecentVibes = typeof reqListRecentVibes.infer;
export function isReqListRecentVibes(obj: unknown): obj is ReqListRecentVibes {
  return !(reqListRecentVibes(obj) instanceof type.errors);
}

export const resRecentVibesItem = type({
  ownerHandle: "string",
  appSlug: "string",
  updated: "string",
  "title?": "string",
  "icon?": type({ cid: "string", mime: "string" }),
  // ISO timestamp when the row was pinned by this user; absent or empty
  // string means unpinned. The server orders pinned rows first.
  "pinnedAt?": "string",
});
export type ResRecentVibesItem = typeof resRecentVibesItem.infer;

export const resListRecentVibes = type({
  type: "'vibes.diy.res-list-recent-vibes'",
  items: resRecentVibesItem.array(),
  "nextCursor?": "string",
});
export type ResListRecentVibes = typeof resListRecentVibes.infer;
export function isResListRecentVibes(obj: unknown): obj is ResListRecentVibes {
  return !(resListRecentVibes(obj) instanceof type.errors);
}

// Toggle pin state on a (ownerHandle, appSlug) row owned by the caller.
export const reqPinRecentVibe = type({
  type: "'vibes.diy.req-pin-recent-vibe'",
  auth: dashAuthType,
  ownerHandle: "string",
  appSlug: "string",
  pin: "boolean",
});
export type ReqPinRecentVibe = typeof reqPinRecentVibe.infer;
export function isReqPinRecentVibe(obj: unknown): obj is ReqPinRecentVibe {
  return !(reqPinRecentVibe(obj) instanceof type.errors);
}

export const resPinRecentVibe = type({
  type: "'vibes.diy.res-pin-recent-vibe'",
  ownerHandle: "string",
  appSlug: "string",
  // Empty string when unpinned, ISO timestamp when pinned.
  pinnedAt: "string",
});
export type ResPinRecentVibe = typeof resPinRecentVibe.infer;
export function isResPinRecentVibe(obj: unknown): obj is ResPinRecentVibe {
  return !(resPinRecentVibe(obj) instanceof type.errors);
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

export const reqForkApp = type({
  type: "'vibes.diy.req-fork-app'",
  auth: dashAuthType,
  srcUserSlug: "string",
  srcAppSlug: "string",
  "srcFsId?": "string",
  // When true: slug uses `-clone` suffix, Apps.mode = 'production',
  // no ChatSection is seeded, and AppSettings are configured so non-owners
  // must request access (no auto-accept). Client is expected to redirect
  // straight to /vibe/ instead of /chat/. Default false = classic remix.
  "skipChat?": "boolean",
});
export type ReqForkApp = typeof reqForkApp.infer;
export function isReqForkApp(obj: unknown): obj is ReqForkApp {
  return !(reqForkApp(obj) instanceof type.errors);
}

export const resForkApp = type({
  type: "'vibes.diy.res-fork-app'",
  ownerHandle: "string",
  appSlug: "string",
  chatId: "string",
  // Immutable anchor pointing at the source content. Stored server-side in
  // the forked Apps row's meta as { type: 'remix-of', srcFsId }.
  srcFsId: "string",
  // Snapshot of the source slugs at fork time — used for immediate
  // redirect/link rendering. Future renders re-resolve via srcFsId so
  // slug renames are followed.
  srcUserSlug: "string",
  srcAppSlug: "string",
});
export type ResForkApp = typeof resForkApp.infer;
export function isResForkApp(obj: unknown): obj is ResForkApp {
  return !(resForkApp(obj) instanceof type.errors);
}

export const ResSetModeFs = type({
  type: "'vibes.diy.res-set-mode-fs'",
  fsId: "string",
  appSlug: "string",
  ownerHandle: "string",
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
  ownerHandle: "string",
  mode: FSMode,
});

export const reqSetModeFs = ReqSetModeFs;
export type ReqSetModeFs = typeof ReqSetModeFs.infer;
export function isReqSetModeFs(obj: unknown): obj is ReqSetModeFs {
  return !(ReqSetModeFs(obj) instanceof type.errors);
}

// HandleBinding CRUD

export const ReqListHandleBindings = type({
  type: "'vibes.diy.req-list-user-slug-bindings'",
  auth: dashAuthType,
});
export type ReqListHandleBindings = typeof ReqListHandleBindings.infer;
export function isReqListHandleBindings(obj: unknown): obj is ReqListHandleBindings {
  return !(ReqListHandleBindings(obj) instanceof type.errors);
}

export const HandleBindingItem = type({
  ownerHandle: "string",
  tenant: "string",
  created: "string",
  appSlugCount: "number",
});
export type HandleBindingItem = typeof HandleBindingItem.infer;

export const ResListHandleBindings = type({
  type: "'vibes.diy.res-list-user-slug-bindings'",
  items: HandleBindingItem.array(),
});
export type ResListHandleBindings = typeof ResListHandleBindings.infer;
export function isResListHandleBindings(obj: unknown): obj is ResListHandleBindings {
  return !(ResListHandleBindings(obj) instanceof type.errors);
}

export const ReqCreateHandleBinding = type({
  type: "'vibes.diy.req-create-user-slug-binding'",
  auth: dashAuthType,
  // if omitted, a random slug is generated; if provided it is sanitized via toRFC2822_32ByteLength
  "ownerHandle?": "string",
});
export type ReqCreateHandleBinding = typeof ReqCreateHandleBinding.infer;
export function isReqCreateHandleBinding(obj: unknown): obj is ReqCreateHandleBinding {
  return !(ReqCreateHandleBinding(obj) instanceof type.errors);
}

export const ResCreateHandleBinding = type({
  type: "'vibes.diy.res-create-user-slug-binding'",
  ownerHandle: "string",
  tenant: "string",
  created: "string",
});
export type ResCreateHandleBinding = typeof ResCreateHandleBinding.infer;
export function isResCreateHandleBinding(obj: unknown): obj is ResCreateHandleBinding {
  return !(ResCreateHandleBinding(obj) instanceof type.errors);
}

export const ReqDeleteHandleBinding = type({
  type: "'vibes.diy.req-delete-user-slug-binding'",
  auth: dashAuthType,
  ownerHandle: "string",
});
export type ReqDeleteHandleBinding = typeof ReqDeleteHandleBinding.infer;
export function isReqDeleteHandleBinding(obj: unknown): obj is ReqDeleteHandleBinding {
  return !(ReqDeleteHandleBinding(obj) instanceof type.errors);
}

export const ResDeleteHandleBinding = type({
  type: "'vibes.diy.res-delete-user-slug-binding'",
  ownerHandle: "string",
  deleted: "boolean",
});
export type ResDeleteHandleBinding = typeof ResDeleteHandleBinding.infer;
export function isResDeleteHandleBinding(obj: unknown): obj is ResDeleteHandleBinding {
  return !(ResDeleteHandleBinding(obj) instanceof type.errors);
}
