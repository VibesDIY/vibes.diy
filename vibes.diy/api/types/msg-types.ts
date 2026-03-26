// Should be compatible with FP Dashboard's auth types
import { Result } from "@adviser/cement";
import { type } from "arktype";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { fileSystemItem, MetaItem } from "./types.js";
import { BlockMsgs, CoercedDate, FileSystemRef, LLMRequest, PromptMsgs } from "@vibes.diy/call-ai-v2";
import { AIParams, ActiveEntry, EnablePublicAccess, EnableRequest, ActiveACL, KVString } from "./invite.js";
// import { FPCloudClaimSchema } from "@fireproof/core-types-protocols-cloud";

export const ClerkClaimParams = type({
  "nick?": "string",
  email: "string",
  email_verified: "boolean",
  "external_id?": "string | null",
  first: "string",
  image_url: "string",
  last: "string",
  name: "string | null",
  public_meta: "unknown",
});

export type ClerkClaimParams = typeof ClerkClaimParams.infer;

export const ClerkClaim = type({
  "azp?": "string",
  "exp?": "number",
  "iat?": "number",
  "iss?": "string",
  "jti?": "string",
  "nbf?": "number",
  params: ClerkClaimParams,
  role: "string",
  sub: "string",
  userId: "string",
  "aud?": "string | string[]",
  "app_metadata?": "unknown",
});
export type ClerkClaim = typeof ClerkClaim.infer;

export const FPCloudClaim = type({
  "azp?": "string",
  "iss?": "string",
  "sub?": "string",
  "aud?": "string | string[]",
  "exp?": "number",
  "nbf?": "number",
  "iat?": "number",
  "jti?": "string",
  userId: "string",
  email: "string.email",
  "nickname?": "string",
  "provider?": "'github' | 'google'",
  created: type("number | string").pipe((v) => new Date(v as number)),
  tenants: type({
    id: "string",
    role: "'admin' | 'member' | 'owner'",
  }).array(),
  ledgers: type({
    id: "string",
    role: "'admin' | 'member' | 'owner'",
    right: "'read' | 'write'",
  }).array(),
  selected: {
    "appId?": "string",
    tenant: "string",
    ledger: "string",
  },
});
export type FPCloudClaim = typeof FPCloudClaim.infer;

// Base types

// Runtime validator — must stay compatible with DashAuthType from @fireproof/core-types-protocols-dashboard
export const dashAuthType = type({
  type: "'clerk'|'device-id'|'ucan'",
  token: "string",
}) satisfies { infer: DashAuthType };

export const vibeUserEnv = type("Record<string, string>");

// Base file properties - used for composition
const baseFileProps = type({
  // including path within the filesystem - absolute from root, no .. or .
  // must start with / and not contain .. or relative path segments
  filename: type("string").narrow((s) => {
    // Must start with /
    if (!s.startsWith("/")) return false;
    // Must not contain //
    if (s.includes("//")) return false;
    // Must not contain ..
    if (s.includes("/../")) return false;
    // Must not contain /./
    if (s.includes("/./")) return false;
    return true;
  }),
  "entryPoint?": "boolean" as const, // last wins should only set once per filesystem
  "mimetype?": "string" as const, // derived from filename if not set
});

// Code types
export const VibeCodeBlock = type({
  type: "'code-block'",
  // currently supported languages
  lang: "string", // "'jsx'|'js'",
  // the actual code content
  content: "string",
}).and(baseFileProps);

export type VibeCodeBlock = typeof VibeCodeBlock.infer;

export function isVibeCodeBlock(obj: unknown): obj is VibeCodeBlock {
  return !(VibeCodeBlock(obj) instanceof type.errors);
}

export const VibeCodeRef = type({
  type: "'code-ref'",
  // reference id to code stored elsewhere
  // if call-ai will store the result somewhere
  refId: "string",
}).and(baseFileProps);

// Asset types - string content
export const VibeStrAssetBlock = type({
  type: "'str-asset-block'",
  // the actual asset content as string
  content: "string",
}).and(baseFileProps);

export const VibeStrAssetRef = type({
  type: "'str-asset-ref'",
  // reference id to asset stored elsewhere
  refId: "string",
}).and(baseFileProps);

// Asset types - binary content
export const VibeUint8AssetBlock = type({
  type: "'uint8-asset-block'",
  // the actual asset content as binary
  content: type.instanceOf(Uint8Array),
}).and(baseFileProps);

export const VibeUint8AssetRef = type({
  type: "'uint8-asset-ref'",
  // reference id to asset stored elsewhere
  refId: "string",
}).and(baseFileProps);

// Union of all file types
export const vibeFile = type(
  VibeCodeBlock.or(VibeCodeRef).or(VibeStrAssetBlock).or(VibeStrAssetRef).or(VibeUint8AssetBlock).or(VibeUint8AssetRef)
);

export type VibeFile = typeof vibeFile.infer;

// Request types

export const reqOpenChat = type({
  type: "'vibes.diy.req-open-chat'",
  auth: dashAuthType,
  "appSlug?": "string",
  "userSlug?": "string",
  "chatId?": "string",
  mode: "'creation'|'application'",
});

export type ReqOpenChat = typeof reqOpenChat.infer;

export const resOpenChat = type({
  type: "'vibes.diy.res-open-chat'",
  appSlug: "string",
  userSlug: "string",
  chatId: "string",
  mode: "'creation'|'application'",
});

export type ResOpenChat = typeof resOpenChat.infer;

export function isResOpenChat(obj: unknown): obj is ResOpenChat {
  return !(resOpenChat(obj) instanceof type.errors);
}

// export const reqEnsureChatContext = type({
//   type: "'vibes.diy.req-ensure-chat-context'",
//   auth: dashAuthType,
//   "contextId?": "string", // desired context id
// });

// export type ReqEnsureChatContext = typeof reqEnsureChatContext.infer;

// export const resEnsureChatContext = type({
//   type: "'vibes.diy.res-ensure-chat-context'",
//   contextId: "string",
// });

// export type ResEnsureChatContext = typeof resEnsureChatContext.infer;

// Error types
export const resError = type({
  // name: "VibesDiyError",
  type: "'vibes.diy.error'",
  message: "string",
  "code?": "string",
  "stack?": "string[]",
});

export const reqCreationPromptChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'creation'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
});

export function isReqCreationPromptChatSection(obj: unknown): obj is typeof reqCreationPromptChatSection.infer {
  return !(reqCreationPromptChatSection(obj) instanceof type.errors);
}

export const reqPromptApplicationChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  mode: "'application'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
});

export function isReqPromptApplicationChatSection(obj: unknown): obj is typeof reqPromptApplicationChatSection.infer {
  return !(reqPromptApplicationChatSection(obj) instanceof type.errors);
}

export const reqPromptChatSection = reqCreationPromptChatSection.or(reqPromptApplicationChatSection);

export type ReqPromptChatSection = typeof reqPromptChatSection.infer;

export const resPromptChatSection = type({
  type: "'vibes.diy.res-prompt-chat-section'",
  mode: "'creation'|'application'",
  chatId: "string",
  userSlug: "string",
  appSlug: "string",
  promptId: "string",
  outerTid: "string",
  // prompt: PromptMsg,
});

export type ResPromptChatSection = typeof resPromptChatSection.infer;
export function isResPromptChatSection(obj: unknown): obj is ResPromptChatSection {
  return !(resPromptChatSection(obj) instanceof type.errors);
}

export const reqAddFS = type({
  type: "'vibes.diy.req-add-fs'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string",
  fs: [vibeFile, "[]"],
});

export type ReqAddFS = typeof reqAddFS.infer;
export function isReqAddFS(obj: unknown): obj is ReqAddFS {
  return !(reqAddFS(obj) instanceof type.errors);
}

export const resAddFS = type({
  type: "'vibes.diy.res-add-fs'",
  chatId: "string",
  outerTid: "string",
}).and(FileSystemRef);

export type ResAddFS = typeof resAddFS.infer;
export function isResAddFS(obj: unknown): obj is ResAddFS {
  return !(resAddFS(obj) instanceof type.errors);
}

export const PromptAndBlockMsgs = PromptMsgs.or(BlockMsgs);
export type PromptAndBlockMsgs = typeof PromptAndBlockMsgs.infer;

export const sectionEvent = type({
  type: "'vibes.diy.section-event'",
  chatId: "string",
  promptId: "string",
  blockSeq: "number",
  timestamp: CoercedDate,
  blocks: [PromptAndBlockMsgs, "[]"],
});

export type SectionEvent = typeof sectionEvent.infer;

export function isSectionEvent(obj: unknown): obj is SectionEvent {
  return !(sectionEvent(obj) instanceof type.errors);
}

export type ResError = typeof resError.infer;

// ID types
export type CodeID = string;
export type EnvID = string;

export const FSMode = type("'production'|'dev'");

export const AppSlugUserSlug = type({
  appSlug: "string", // desired app slug
  userSlug: "string", // desired user slug
});
export type AppSlugUserSlug = typeof AppSlugUserSlug.infer;

export const OptAppSlugUserSlug = type({
  "appSlug?": "string", // desired app slug
  userSlug: "string", // desired user slug
});
export type OptAppSlugUserSlug = typeof OptAppSlugUserSlug.infer;

export const AppSlugOptUserSlug = type({
  appSlug: "string", // desired app slug
  "userSlug?": "string", // desired user slug
});
export type AppSlugOptUserSlug = typeof AppSlugOptUserSlug.infer;

export const OptAppSlugOptUserSlug = type({
  "appSlug?": "string", // desired app slug
  "userSlug?": "string", // desired user slug
});
export type OptAppSlugOptUserSlug = typeof OptAppSlugOptUserSlug.infer;

export const NeedOneAppSlugUserSlug = AppSlugUserSlug.or(OptAppSlugUserSlug).or(AppSlugOptUserSlug).or(OptAppSlugOptUserSlug);

export type NeedOneAppSlugUserSlug = typeof NeedOneAppSlugUserSlug.infer;

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
  // appSlug: "string",
  // userSlug: "string",
  // mode: "'production'|'dev'",
  env: vibeUserEnv,
  // "promptId?": "string",
  // "chatId?": "string",
  // fsId: "string",
  fileSystem: [fileSystemItem, "[]"],
  // envRef: "string",
  // wrapperUrl: "string",
  // entryPointUrl: "string",
}).and(FileSystemRef);

export type ResEnsureAppSlugOk = typeof resEnsureAppSlugOk.infer;

export const resEnsureAppSlugRequireLogin = type({
  // name: "VibesDiyError",
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
  // name: "VibesDiyError",
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
  // name: "VibesDiyError",
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
  // "sectionId?": "string",
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
  // "sectionId?": "string",
}).and(FileSystemRef);

export type ResGetByUserSlugAppSlug = typeof resGetByUserSlugAppSlug.infer;
export function isResGetByUserSlugAppSlug(obj: unknown): obj is ResGetByUserSlugAppSlug {
  const res = resGetByUserSlugAppSlug(obj);
  if (res instanceof type.errors) {
    console.error(`Invalid resGetByUserSlugAppSlug:`, obj, res.summary);
  }
  return !(resGetByUserSlugAppSlug(obj) instanceof type.errors);
}

export const msgBase = type({
  tid: "string",
  src: "string",
  dst: "string",
  ttl: "number",
  payload: "unknown",
});

export type msgBaseType = typeof msgBase.infer;

export function isMsgBase(obj: unknown): obj is msgBaseType {
  return !(msgBase(obj) instanceof type.errors);
}

export interface MsgBase<T = unknown> extends Omit<msgBaseType, "payload"> {
  payload: T;
}

export interface InMsgBase<T> {
  readonly tid: string;
  readonly src?: string;
  readonly dst?: string;
  readonly ttl?: number;
  readonly payload: T;
}

export interface MsgBox<T = unknown> extends Omit<MsgBase, "payload"> {
  payload: T;
}

export type MsgBaseCfg = Pick<MsgBase, "src" | "dst" | "ttl">;
export type MsgBaseParam = Partial<MsgBaseCfg>;

export type VibesDiyError = (ResError | ResEnsureAppSlugError) & Error;

export type ResultVibesDiy<T> = Result<T, VibesDiyError>;

export const w3cMessageEventBox = type({
  type: "'MessageEvent'",
  event: type({
    data: "unknown",
    origin: "string|null",
    lastEventId: "string",
    source: "unknown",
    ports: "unknown",
  }).partial(),
});

export const w3cCloseEventBox = type({
  type: "'CloseEvent'",
  event: type({
    wasClean: "boolean",
    code: "number",
    reason: "string",
  }),
});

export const w3cErrorEventBox = type({
  type: "'ErrorEvent'",
  event: type({
    message: "string",
    filename: "string",
    lineno: "number",
    colno: "number",
    error: "unknown",
  }).partial(),
});

export const w3CWebSocketEvent = w3cMessageEventBox.or(w3cCloseEventBox).or(w3cErrorEventBox);
export type W3CWebSocketEvent = typeof w3CWebSocketEvent.infer;
export type W3CWebSocketErrorEvent = typeof w3cErrorEventBox.infer;
export type W3CWebSocketMessageEvent = typeof w3cMessageEventBox.infer;
export type W3CWebSocketCloseEvent = typeof w3cCloseEventBox.infer;

export const userSettingShareing = type({
  type: "'sharing'",
  grants: type({
    grant: "'allow' | 'deny'",
    appSlug: "string",
    userSlug: "string",
    dbName: "string", // could be "*" for all databases
  }).array(),
});
export function isUserSettingSharing(obj: unknown): obj is typeof userSettingShareing.infer {
  return !(userSettingShareing(obj) instanceof type.errors);
}

export const userSettingItem = userSettingShareing;

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
    // "tick?": tick
  },
}).and(reqEnsureAppSettingsBase);

export type ReqPublicAccess = typeof reqPublicAccess.infer;
export function isReqPublicAccess(obj: unknown): obj is ReqPublicAccess {
  return !(reqPublicAccess(obj) instanceof type.errors);
}

export const reqRequest = type({
  request: {
    enable: "boolean",
    "autoAcceptViewRequest?": "boolean",
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

export const reqEnsureAppSettingsEnv = type({
  env: KVString.array(),
}).and(reqEnsureAppSettingsBase);

export type ReqEnsureAppSettingsEnv = typeof reqEnsureAppSettingsEnv.infer;
export function isReqEnsureAppSettingsEnv(obj: unknown): obj is ReqEnsureAppSettingsEnv {
  return !(reqEnsureAppSettingsEnv(obj) instanceof type.errors);
}

export type ReqEnsureAppSettings =
  // | ReqEnsureAppSettingsAcl
  | ReqPublicAccess
  | ReqRequest
  | ReqEnsureAppSettingsTitle
  | ReqEnsureAppSettingsApp
  | ReqEnsureAppSettingsChat
  | ReqEnsureAppSettingsEnv
  | ReqEnsureAppSettingsBase;

export function isReqEnsureAppSettings(obj: unknown): obj is ReqEnsureAppSettings {
  return (
    // isReqEnsureAppSettingsAcl(obj) ||
    isReqEnsureAppSettingsTitle(obj) ||
    isReqEnsureAppSettingsApp(obj) ||
    isReqEnsureAppSettingsChat(obj) ||
    isReqEnsureAppSettingsEnv(obj) ||
    isReqEnsureAppSettingsBase(obj)
  );
}

export const AppSettings = type({
  // type: "'vibes.diy.app-settings'",
  entries: ActiveEntry.array(),
  entry: type({
    settings: {
      "title?": "string",
      "app?": AIParams.partial(),
      "chat?": AIParams.partial(),
      env: KVString.array(),
    },
    publicAccess: EnablePublicAccess.optional(),
    enableRequest: EnableRequest.optional(),
    // request: type({
    //   pending: ActiveRequestPending.array(),
    //   approved: ActiveRequestApproved.array(),
    //   rejected: ActiveRequestRejected.array(),
    // }),
    // invite: type({
    //   viewers: type({
    //     pending: ActiveInviteViewerPending.array(),
    //     accepted: ActiveInviteViewerAccepted.array(),
    //     revoked: ActiveInviteViewerRevoked.array(),
    //   }),
    //   editors: type({
    //     pending: ActiveInviteEditorPending.array(),
    //     accepted: ActiveInviteEditorAccepted.array(),
    //     revoked: ActiveInviteEditorRevoked.array(),
    //   }),
    // }),
  }),
});
export type AppSettings = typeof AppSettings.infer;

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

export const Pager = type({
  "limit?": "number",
  "cursor?": "string", // ISO timestamp cursor for next page (exclusive)
});
export type Pager = typeof Pager.infer;

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
  // created: "string",
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

const GrantListBase = type({
  appSlug: "string",
  userSlug: "string",
  auth: dashAuthType,
  pager: Pager,
});

export const ForeignInfo = type({ "givenEmail?": "string", "claims?": ClerkClaim });
export type ForeignInfo = typeof ForeignInfo.infer;
/** @deprecated use ForeignInfo */
export const InviteForeignInfo = ForeignInfo;
export type InviteForeignInfo = ForeignInfo;

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
  role: "'editor' | 'viewer'",
  state: "'accepted'",
});
export type ResRedeemInviteOK = typeof ResRedeemInviteOK.infer;
export function isResRedeemInviteOK(obj: unknown): obj is ResRedeemInviteOK {
  return !(ResRedeemInviteOK(obj) instanceof type.errors);
}

export const ResRedeemInviteError = type({
  // name: "VibesDiyError",
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
  emailKey: "string",
  state: "'pending' | 'accepted' | 'revoked'",
  role: "'editor' | 'viewer'",
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
  role: "'editor' | 'viewer'",
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
  type({ state: "'accepted'", role: "'editor' | 'viewer'", tokenOrGrantUserId: "string" })
);
export type ResHasAccessInviteAccepted = typeof ResHasAccessInviteAccepted.infer;
export function isResHasAccessInviteAccepted(obj: unknown): obj is ResHasAccessInviteAccepted {
  return !(ResHasAccessInviteAccepted(obj) instanceof type.errors);
}

export const ResHasAccessInvitePending = ResHasAccessInviteBase.and(
  type({ state: "'pending'", role: "'editor' | 'viewer'", tokenOrGrantUserId: "string" })
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
  role: "'editor' | 'viewer'",
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
  role: "'editor' | 'viewer'",
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

export const ResRequestAccessApproved = type({ state: "'approved'", role: "'editor' | 'viewer'" }).and(ResRequestAccessBase);

export type ResRequestAccessApproved = typeof ResRequestAccessApproved.infer;
export function isResRequestAccessApproved(obj: unknown): obj is ResRequestAccessApproved {
  return !(ResRequestAccessApproved(obj) instanceof type.errors);
}

export const ResRequestAccessRevoked = type({ state: "'revoked'", role: "'editor' | 'viewer'" }).and(ResRequestAccessBase);

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
  role: "'editor' | 'viewer'",
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
  role: "'editor' | 'viewer'",
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
  role: "'editor' | 'viewer'",
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
  role: "'editor' | 'viewer'",
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
  type({ state: "'pending'", role: "'editor' | 'viewer' | undefined | null" })
);
export type ResHasAccessRequestPending = typeof ResHasAccessRequestPending.infer;
export function isResHasAccessRequestPending(obj: unknown): obj is ResHasAccessRequestPending {
  return !(ResHasAccessRequestPending(obj) instanceof type.errors);
}

export const ResHasAccessRequestApproved = type({
  state: "'approved'",
  role: "'editor' | 'viewer'",
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
    role: "'editor' | 'viewer' | undefined | null",
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

export const evtNewFsId = type({
  type: "'vibes.diy.evt-new-fs-id'",
  userSlug: "string",
  appSlug: "string",
  fsId: "string",
  sessionToken: "string",
  vibeUrl: "string",
});
export type EvtNewFsId = typeof evtNewFsId.infer;

export function isEvtNewFsId(obj: unknown): obj is EvtNewFsId {
  return !(evtNewFsId(obj) instanceof type.errors);
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

export const evtInviteGrant = type({
  cud: "'create' | 'update' | 'delete'",
  type: "'vibes.diy.evt-invite-grant'",
  userSlug: "string",
  appSlug: "string",
  userId: "string",
  state: "'pending' | 'approved' | 'revoked'",
  role: "'editor' | 'viewer' | undefined | null",
  foreignInfo: ForeignInfo,
  emailKey: "string",
  tokenOrGrantUserId: "string",
});
export type EvtInviteGrant = typeof evtInviteGrant.infer;

export function isEvtInviteGrant(obj: unknown): obj is EvtInviteGrant {
  return !(evtInviteGrant(obj) instanceof type.errors);
}

export const evtRequestGrant = type({
  cud: "'create' | 'update' | 'delete'",
  type: "'vibes.diy.evt-request-grant'",
  userSlug: "string",
  appSlug: "string",
  userId: "string",
  foreignUserId: "string",
  state: "'pending' | 'approved' | 'revoked'",
  role: "'editor' | 'viewer' | undefined | null",
  foreignInfo: ForeignInfo,
});
export type EvtRequestGrant = typeof evtRequestGrant.infer;

export function isEvtRequestGrant(obj: unknown): obj is EvtRequestGrant {
  return !(evtRequestGrant(obj) instanceof type.errors);
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

export const ReqFPCloudToken = type({
  type: "'vibes.diy.req-fpcloud-token'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  dbName: "string",
});

export type ReqFPCloudToken = typeof ReqFPCloudToken.infer;

export function isReqFPCloudToken(obj: unknown): obj is ReqFPCloudToken {
  return !(ReqFPCloudToken(obj) instanceof type.errors);
}

export const ResFPCloudTokenNoGrant = type({
  type: "'vibes.diy.res-fpcloud-token'",
  grant: "'no-grant'",
});

export type ResFPCloudTokenNoGrant = typeof ResFPCloudTokenNoGrant.infer;

export function isResFPCloudTokenNoGrant(obj: unknown): obj is ResFPCloudTokenNoGrant {
  return !(ResFPCloudTokenNoGrant(obj) instanceof type.errors);
}

export const Token = type({
  expiresInSec: "number",
  token: "string",
  claims: FPCloudClaim,
});
export type Token = typeof Token.infer;

export const ResFPCloudTokenGrant = type({
  type: "'vibes.diy.res-fpcloud-token'",
  grant: "'public' | 'owner' | 'request-editor' | 'request-viewer' | 'invite-editor' | 'invite-viewer'",
  token: Token,
  fpCloudUrl: "string",
  appSlug: "string",
  userSlug: "string",
  dbName: "string",
  ledger: "string",
  tenant: "string",
});
export type ResFPCloudTokenGrant = typeof ResFPCloudTokenGrant.infer;

export function isResFPCloudTokenGrant(obj: unknown): obj is ResFPCloudTokenGrant {
  return !(ResFPCloudTokenGrant(obj) instanceof type.errors);
}

export const ResFPCloudToken = ResFPCloudTokenGrant.or(ResFPCloudTokenNoGrant);

export type ResFPCloudToken = typeof ResFPCloudToken.infer;

export function isResFPCloudToken(obj: unknown): obj is ResFPCloudToken {
  return !(ResFPCloudToken(obj) instanceof type.errors);
}

// export const reqCertFromCsr = type({
//   type: "'vibes.diy.req-cert-from-csr'",
//   auth: dashAuthType,
//   csr: "string",
// });

// export type ReqCertFromCsr = typeof reqCertFromCsr.infer;

// export function isReqCertFromCsr(obj: unknown): obj is ReqCertFromCsr {
//   return !(reqCertFromCsr(obj) instanceof type.errors);
// }

// export const resCertFromCsr = type({
//   type: "'vibes.diy.res-cert-from-csr'",
//   cert: "string",
// });

// export type ResCertFromCsr = typeof resCertFromCsr.infer;

// export function isResCertFromCsr(obj: unknown): obj is ResCertFromCsr {
//   return !(resCertFromCsr(obj) instanceof type.errors);
// }
