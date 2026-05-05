import { type } from "arktype";
import { dashAuthType, Role } from "./common.js";
import { AIParams, ActiveEntry, EnablePublicAccess, EnableRequest, ActiveACL, KVString } from "./invite.js";
import { dbAcl, DbAcl } from "./db-acls.js";

export const sharingGrantItem = type({
  grant: "'allow' | 'deny'",
  appSlug: "string",
  userSlug: "string",
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

export const userSettingModelDefaults = type({
  type: "'modelDefaults'",
  "chat?": AIParams.partial(),
  "app?": AIParams.partial(),
  "img?": AIParams.partial(),
});
export type UserSettingModelDefaults = typeof userSettingModelDefaults.infer;
export function isUserSettingModelDefaults(obj: unknown): obj is UserSettingModelDefaults {
  return !(userSettingModelDefaults(obj) instanceof type.errors);
}

export const userSettingDefaultUserSlug = type({
  type: "'defaultUserSlug'",
  userSlug: "string",
});
export type UserSettingDefaultUserSlug = typeof userSettingDefaultUserSlug.infer;
export function isUserSettingDefaultUserSlug(obj: unknown): obj is UserSettingDefaultUserSlug {
  return !(userSettingDefaultUserSlug(obj) instanceof type.errors);
}

export const userSettingItem = userSettingShareing.or(userSettingModelDefaults).or(userSettingDefaultUserSlug);

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

export const reqEnsureAppSettingsBase = type({
  type: "'vibes.diy.req-ensure-app-settings'",
  "auth?": dashAuthType,
  appSlug: "string",
  userSlug: "string",
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

export const reqEnsureAppSettingsApp = type({
  app: AIParams.partial(),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsApp = typeof reqEnsureAppSettingsApp.infer;
export function isReqEnsureAppSettingsApp(obj: unknown): obj is ReqEnsureAppSettingsApp {
  return !(reqEnsureAppSettingsApp(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsChat = type({
  chat: AIParams.partial(),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsChat = typeof reqEnsureAppSettingsChat.infer;
export function isReqEnsureAppSettingsChat(obj: unknown): obj is ReqEnsureAppSettingsChat {
  return !(reqEnsureAppSettingsChat(obj) instanceof type.errors);
}

export const reqEnsureAppSettingsImg = type({
  img: AIParams.partial(),
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
  | ReqEnsureAppSettingsIconDescription
  | ReqEnsureAppSettingsIconRegen
  | ReqEnsureAppSettingsApp
  | ReqEnsureAppSettingsChat
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
    isReqEnsureAppSettingsIconDescription(obj) ||
    isReqEnsureAppSettingsIconRegen(obj) ||
    isReqEnsureAppSettingsApp(obj) ||
    isReqEnsureAppSettingsChat(obj) ||
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
      "iconDescription?": "string",
      "icon?": type({ cid: "string", mime: "string" }),
      "app?": AIParams.partial(),
      "chat?": AIParams.partial(),
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
  userSlug: "string",
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
  "userSlug?": "string",
  "limit?": "number", // default 20, max 100
  "cursor?": "string", // ISO timestamp cursor for next page (exclusive)
});
export type ReqListApplicationChats = typeof reqListApplicationChats.infer;

export const resListApplicationChatsItem = type({
  chatId: "string",
  appSlug: "string",
  userSlug: "string",
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
  userSlug: "string",
  appSlug: "string",
  settings: ActiveEntry.array(),
});
export type EvtAppSetting = typeof evtAppSetting.infer;

export function isEvtAppSetting(obj: unknown): obj is EvtAppSetting {
  return !(evtAppSetting(obj) instanceof type.errors);
}
