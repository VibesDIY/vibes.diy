import { type } from "arktype";
import { dashAuthType, Role } from "./common.js";
import { AIParams, ActiveEntry, EnablePublicAccess, EnableRequest, ActiveACL, KVString } from "./invite.js";
import { dbAcl, DbAcl } from "./db-acls.js";

export const sharingGrantItem = type({
  grant: "'allow' | 'deny'",
  appSlug: "string",
  ownerHandle: "string",
  dbName: "string", // could be "*" for all databases
});
export type SharingGrantItem = typeof sharingGrantItem.infer;

export const userSettingShareing = type({
  type: "'sharing'",
  grants: sharingGrantItem.array(),
});
export type UserSettingSharing = typeof userSettingShareing.infer;
export function isUserSettingSharing(obj: unknown): obj is UserSettingSharing {
  return !(userSettingShareing(obj) instanceof type.errors);
}

// Canonical keys are `codegen`/`runtime`/`img` (#2608). The legacy `chat`/`app`
// keys stay readable so user rows written before the rename still load; new
// writes use the canonical keys. Consumers should prefer `codegen ?? chat` and
// `runtime ?? app`.
export const userSettingModelDefaults = type({
  type: "'modelDefaults'",
  "codegen?": AIParams.partial(),
  "runtime?": AIParams.partial(),
  "img?": AIParams.partial(),
  // legacy (pre-#2608), read-only back-compat
  "chat?": AIParams.partial(),
  "app?": AIParams.partial(),
});
export type UserSettingModelDefaults = typeof userSettingModelDefaults.infer;
export function isUserSettingModelDefaults(obj: unknown): obj is UserSettingModelDefaults {
  return !(userSettingModelDefaults(obj) instanceof type.errors);
}

export const userSettingDefaultHandle = type({
  type: "'defaultHandle'",
  ownerHandle: "string",
});
export type UserSettingDefaultHandle = typeof userSettingDefaultHandle.infer;
export function isUserSettingDefaultHandle(obj: unknown): obj is UserSettingDefaultHandle {
  return !(userSettingDefaultHandle(obj) instanceof type.errors);
}

export const userSettingProfile = type({
  type: "'profile'",
  // DEPRECATED (#2434): the per-user avatar has been replaced by per-handle
  // avatars in HandleSettings (`/u/<handle>/avatar`). No code writes this field
  // anymore; it is retained read-only so the one-time `migrateLegacyAvatar` seed
  // can carry an existing user's avatar onto their default handle. Remove the
  // field once the backfill is complete across all environments.
  "avatarCid?": "string",
  "displayName?": "string",
});
export type UserSettingProfile = typeof userSettingProfile.infer;
export function isUserSettingProfile(obj: unknown): obj is UserSettingProfile {
  return !(userSettingProfile(obj) instanceof type.errors);
}

export const userSettingNotifications = type({
  type: "'notifications'",
  "buildComplete?": "boolean",
  "buildFailed?": "boolean",
  "vibePublished?": "boolean",
  "commentPosted?": "boolean",
  "requestApproved?": "boolean",
  "requestRevoked?": "boolean",
});
export type UserSettingNotifications = typeof userSettingNotifications.infer;
export function isUserSettingNotifications(obj: unknown): obj is UserSettingNotifications {
  return !(userSettingNotifications(obj) instanceof type.errors);
}

// Legacy setting type stored before handle rename; normalized to defaultHandle on parse.
const userSettingLegacyDefaultHandle = type({
  type: "'defaultUserSlug'",
  userSlug: "string",
}).pipe(({ userSlug }) => ({ type: "defaultHandle" as const, ownerHandle: userSlug }));

export const userSettingItem = userSettingShareing
  .or(userSettingModelDefaults)
  .or(userSettingDefaultHandle)
  .or(userSettingLegacyDefaultHandle)
  .or(userSettingProfile)
  .or(userSettingNotifications);

export type UserSettingItem = typeof userSettingItem.infer;

export const reqEnsureUserSettings = type({
  type: "'vibes.diy.req-ensure-user-settings'",
  auth: dashAuthType,
  settings: userSettingItem.array(),
});
export type ReqEnsureUserSettings = typeof reqEnsureUserSettings.infer;

export const resEnsureUserSettings = type({
  type: "'vibes.diy.res-ensure-user-settings'",
  userId: "string",
  settings: userSettingItem.array(),
  updated: "string",
  created: "string",
});
export type ResEnsureUserSettings = typeof resEnsureUserSettings.infer;
export function isResEnsureUserSettings(obj: unknown): obj is ResEnsureUserSettings {
  return !(resEnsureUserSettings(obj) instanceof type.errors);
}

// Per-handle avatar write (spec: docs/superpowers/specs/2026-06-18-per-handle-avatar-design.md).
// `handle` is the VIEWER-selected target handle — the server validates it
// belongs to the authenticated user (never trusts an app/iframe-derived handle).
// `cid` is the bare content CID from putAsset; the server resolves it to the
// authoritative storage getURL via the AssetUploads audit table (scoped to the
// caller), so a client cannot forge the stored URL.
export const reqEnsureHandleAvatar = type({
  type: "'vibes.diy.req-ensure-handle-avatar'",
  auth: dashAuthType,
  handle: "string",
  cid: "string",
  "mime?": "string",
});
export type ReqEnsureHandleAvatar = typeof reqEnsureHandleAvatar.infer;
export function isReqEnsureHandleAvatar(obj: unknown): obj is ReqEnsureHandleAvatar {
  return !(reqEnsureHandleAvatar(obj) instanceof type.errors);
}

export const resEnsureHandleAvatar = type({
  type: "'vibes.diy.res-ensure-handle-avatar'",
  handle: "string",
  getURL: "string",
  mime: "string",
  updated: "string",
});
export type ResEnsureHandleAvatar = typeof resEnsureHandleAvatar.infer;
export function isResEnsureHandleAvatar(obj: unknown): obj is ResEnsureHandleAvatar {
  return !(resEnsureHandleAvatar(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsBase = type({
  type: "'vibes.diy.req-ensure-app-settings'",
  "auth?": dashAuthType,
  appSlug: "string",
  ownerHandle: "string",
});

export type ReqEnsureAppSettingsBase = typeof reqEnsureAppSettingsBase.infer;

export function isReqEnsureAppSettingsBase(obj: unknown): obj is ReqEnsureAppSettingsBase {
  return !(reqEnsureAppSettingsBase(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsAcl = type({
  aclEntry: type({
    entry: ActiveACL,
    op: "'delete' | 'upsert'",
  }),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsAcl = typeof reqEnsureAppSettingsAcl.infer;
export function isReqEnsureAppSettingsAcl(obj: unknown): obj is ReqEnsureAppSettingsAcl {
  return !(reqEnsureAppSettingsAcl(obj) instanceof type.errors);
}

export const reqPublicAccess = type({
  publicAccess: {
    enable: "boolean",
  },
}).and(reqEnsureAppSettingsBase);

export type ReqPublicAccess = typeof reqPublicAccess.infer;
export function isReqPublicAccess(obj: unknown): obj is ReqPublicAccess {
  return !(reqPublicAccess(obj) instanceof type.errors);
}

export const reqRequest = type({
  request: {
    enable: "boolean",
    "autoAcceptRole?": Role,
  },
}).and(reqEnsureAppSettingsBase);

export type ReqRequest = typeof reqRequest.infer;
export function isReqRequest(obj: unknown): obj is ReqRequest {
  return !(reqRequest(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsTitle = type({
  title: "string",
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsTitle = typeof reqEnsureAppSettingsTitle.infer;
export function isReqEnsureAppSettingsTitle(obj: unknown): obj is ReqEnsureAppSettingsTitle {
  return !(reqEnsureAppSettingsTitle(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsSkills = type({
  skills: type("string").array(),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsSkills = typeof reqEnsureAppSettingsSkills.infer;
export function isReqEnsureAppSettingsSkills(obj: unknown): obj is ReqEnsureAppSettingsSkills {
  return !(reqEnsureAppSettingsSkills(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsTheme = type({
  theme: "string",
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsTheme = typeof reqEnsureAppSettingsTheme.infer;
export function isReqEnsureAppSettingsTheme(obj: unknown): obj is ReqEnsureAppSettingsTheme {
  return !(reqEnsureAppSettingsTheme(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsColorTheme = type({
  colorTheme: "string | null",
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsColorTheme = typeof reqEnsureAppSettingsColorTheme.infer;
export function isReqEnsureAppSettingsColorTheme(obj: unknown): obj is ReqEnsureAppSettingsColorTheme {
  return !(reqEnsureAppSettingsColorTheme(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsIconDescription = type({
  iconDescription: "string",
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsIconDescription = typeof reqEnsureAppSettingsIconDescription.infer;
export function isReqEnsureAppSettingsIconDescription(obj: unknown): obj is ReqEnsureAppSettingsIconDescription {
  return !(reqEnsureAppSettingsIconDescription(obj) instanceof type.errors);
}

// Trigger a fresh icon generation against the existing description.
// No payload beyond the slug pair plus the literal-true discriminant
// (which makes this union member identifiable). Server-side rate-limit
// soft-no-ops within 10s of the previous generation.
export const reqEnsureAppSettingsIconRegen = type({
  iconRegen: "true",
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsIconRegen = typeof reqEnsureAppSettingsIconRegen.infer;
export function isReqEnsureAppSettingsIconRegen(obj: unknown): obj is ReqEnsureAppSettingsIconRegen {
  return !(reqEnsureAppSettingsIconRegen(obj) instanceof type.errors);
}

// A model-usage value of `null` clears the app-level override for that usage
// (mirrors the `colorTheme: null` → sqlRemove pattern). Once removed, the usage
// falls back to the user/catalog default resolved by getModelDefaults. A partial
// AIParams object (the usual case) upserts/merges the override.
export const reqEnsureAppSettingsRuntime = type({
  runtime: AIParams.partial().or("null"),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsRuntime = typeof reqEnsureAppSettingsRuntime.infer;
export function isReqEnsureAppSettingsRuntime(obj: unknown): obj is ReqEnsureAppSettingsRuntime {
  return !(reqEnsureAppSettingsRuntime(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsCodegen = type({
  codegen: AIParams.partial().or("null"),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsCodegen = typeof reqEnsureAppSettingsCodegen.infer;
export function isReqEnsureAppSettingsCodegen(obj: unknown): obj is ReqEnsureAppSettingsCodegen {
  return !(reqEnsureAppSettingsCodegen(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsImg = type({
  img: AIParams.partial().or("null"),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsImg = typeof reqEnsureAppSettingsImg.infer;
export function isReqEnsureAppSettingsImg(obj: unknown): obj is ReqEnsureAppSettingsImg {
  return !(reqEnsureAppSettingsImg(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsEnv = type({
  env: KVString.array(),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsEnv = typeof reqEnsureAppSettingsEnv.infer;
export function isReqEnsureAppSettingsEnv(obj: unknown): obj is ReqEnsureAppSettingsEnv {
  return !(reqEnsureAppSettingsEnv(obj) instanceof type.errors);
}

// Set or replace the ACL for a single dbName.
export const reqEnsureAppSettingsDbAcl = type({
  dbAcl: type({
    dbName: "string",
    acl: dbAcl,
  }),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsDbAcl = typeof reqEnsureAppSettingsDbAcl.infer;
export function isReqEnsureAppSettingsDbAcl(obj: unknown): obj is ReqEnsureAppSettingsDbAcl {
  return !(reqEnsureAppSettingsDbAcl(obj) instanceof type.errors);
}

// Remove the ACL entry for a single dbName, falling back to the resolver
// default (lazy COMMENTS_DEFAULT_ACL for "comments", undefined elsewhere).
export const reqEnsureAppSettingsDbAclRemove = type({
  dbAclRemove: type({
    dbName: "string",
  }),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsDbAclRemove = typeof reqEnsureAppSettingsDbAclRemove.infer;
export function isReqEnsureAppSettingsDbAclRemove(obj: unknown): obj is ReqEnsureAppSettingsDbAclRemove {
  return !(reqEnsureAppSettingsDbAclRemove(obj) instanceof type.errors);
}

export type ReqEnsureAppSettings =
  // | ReqEnsureAppSettingsAcl
  | ReqPublicAccess
  | ReqRequest
  | ReqEnsureAppSettingsTitle
  | ReqEnsureAppSettingsSkills
  | ReqEnsureAppSettingsTheme
  | ReqEnsureAppSettingsColorTheme
  | ReqEnsureAppSettingsIconDescription
  | ReqEnsureAppSettingsIconRegen
  | ReqEnsureAppSettingsRuntime
  | ReqEnsureAppSettingsCodegen
  | ReqEnsureAppSettingsImg
  | ReqEnsureAppSettingsEnv
  | ReqEnsureAppSettingsDbAcl
  | ReqEnsureAppSettingsDbAclRemove
  | ReqEnsureAppSettingsBase;

export function isReqEnsureAppSettings(obj: unknown): obj is ReqEnsureAppSettings {
  return (
    // isReqEnsureAppSettingsAcl(obj) ||
    isReqEnsureAppSettingsTitle(obj) ||
    isReqEnsureAppSettingsSkills(obj) ||
    isReqEnsureAppSettingsTheme(obj) ||
    isReqEnsureAppSettingsColorTheme(obj) ||
    isReqEnsureAppSettingsIconDescription(obj) ||
    isReqEnsureAppSettingsIconRegen(obj) ||
    isReqEnsureAppSettingsRuntime(obj) ||
    isReqEnsureAppSettingsCodegen(obj) ||
    isReqEnsureAppSettingsImg(obj) ||
    isReqEnsureAppSettingsEnv(obj) ||
    isReqEnsureAppSettingsDbAcl(obj) ||
    isReqEnsureAppSettingsDbAclRemove(obj) ||
    isReqEnsureAppSettingsBase(obj)
  );
}

export const AppSettings = type({
  entries: ActiveEntry.array(),
  entry: type({
    settings: {
      "title?": "string",
      "skills?": type("string").array(),
      "theme?": "string",
      "colorTheme?": "string",
      "iconDescription?": "string",
      "icon?": type({ cid: "string", mime: "string" }),
      "runtime?": AIParams.partial(),
      "codegen?": AIParams.partial(),
      "img?": AIParams.partial(),
      env: KVString.array(),
    },
    publicAccess: EnablePublicAccess.optional(),
    enableRequest: EnableRequest.optional(),
    "dbAcls?": type({ "[string]": dbAcl }),
  }),
});
export type AppSettings = typeof AppSettings.infer;
export interface AppSettingsEntry extends Omit<AppSettings["entry"], "dbAcls"> {
  dbAcls?: Record<string, DbAcl>;
}

export const resEnsureAppSettings = type({
  type: "'vibes.diy.res-ensure-app-settings'",
  userId: "string",
  appSlug: "string",
  ledger: "string",
  ownerHandle: "string",
  tenant: "string",
  "error?": "string",
  settings: AppSettings,
  updated: "string",
  created: "string",
});
export type ResEnsureAppSettings = typeof resEnsureAppSettings.infer;
export function isResEnsureAppSettings(obj: unknown): obj is ResEnsureAppSettings {
  return !(resEnsureAppSettings(obj) instanceof type.errors);
}

export const reqListApplicationChats = type({
  type: "'vibes.diy.req-list-application-chats'",
  auth: dashAuthType,
  "appSlug?": "string",
  "ownerHandle?": "string",
  "limit?": "number", // default 20, max 100
  "cursor?": "string", // ISO timestamp cursor for next page (exclusive)
});
export type ReqListApplicationChats = typeof reqListApplicationChats.infer;

export const resListApplicationChatsItem = type({
  chatId: "string",
  appSlug: "string",
  ownerHandle: "string",
  created: "string",
});
export type ResListApplicationChatsItem = typeof resListApplicationChatsItem.infer;

export const resListApplicationChats = type({
  type: "'vibes.diy.res-list-application-chats'",
  items: resListApplicationChatsItem.array(),
  "nextCursor?": "string", // present only when more pages exist
});
export type ResListApplicationChats = typeof resListApplicationChats.infer;
export function isResListApplicationChats(obj: unknown): obj is ResListApplicationChats {
  return !(resListApplicationChats(obj) instanceof type.errors);
}

export const evtAppSetting = type({
  type: "'vibes.diy.evt-app-setting'",
  ownerHandle: "string",
  appSlug: "string",
  settings: ActiveEntry.array(),
});
export type EvtAppSetting = typeof evtAppSetting.infer;

export function isEvtAppSetting(obj: unknown): obj is EvtAppSetting {
  return !(evtAppSetting(obj) instanceof type.errors);
}
