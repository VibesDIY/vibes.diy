// Should be compatible with FP Dashboard's auth types
import { Result } from "@adviser/cement";
import { type } from "arktype";
import { fileSystemItem } from "./types.js";
import { BlockMsgs, CoercedDate, FileSystemRef, LLMRequest, PromptMsgs } from "@vibes.diy/call-ai-v2";

// Base types
export const dashAuthType = type({
  type: "'clerk'|'device-id'|'ucan'",
  token: "string",
});

export const vibeUserEnv = type("Record<string, string>")


export type DashAuthType = typeof dashAuthType.infer;

// Base file properties - used for composition
const baseFileProps = {
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
};

// Code types
const codeBlock = type({
  ...baseFileProps,
  type: "'code-block'",
  // currently supported languages
  lang: "'jsx'|'js'",
  // the actual code content
  content: "string",
});

const codeRef = type({
  ...baseFileProps,
  type: "'code-ref'",
  // reference id to code stored elsewhere
  // if call-ai will store the result somewhere
  refId: "string",
});

// Asset types - string content
const strAssetBlock = type({
  ...baseFileProps,
  type: "'str-asset-block'",
  // the actual asset content as string
  content: "string",
});

const strAssetRef = type({
  ...baseFileProps,
  type: "'str-asset-ref'",
  // reference id to asset stored elsewhere
  refId: "string",
});

// Asset types - binary content
const uint8AssetBlock = type({
  ...baseFileProps,
  type: "'uint8-asset-block'",
  // the actual asset content as binary
  content: type.instanceOf(Uint8Array),
});

const uint8AssetRef = type({
  ...baseFileProps,
  type: "'uint8-asset-ref'",
  // reference id to asset stored elsewhere
  refId: "string",
});

// Union of all file types
export const vibeFile = type(codeBlock.or(codeRef).or(strAssetBlock).or(strAssetRef).or(uint8AssetBlock).or(uint8AssetRef));

export type VibeFile = typeof vibeFile.infer;

// Request types

export const reqOpenChat = type({
  type: "'vibes.diy.req-open-chat'",
  auth: dashAuthType,
  "appSlug?": "string",
  "userSlug?": "string",
  "chatId?": "string",
});

export type ReqOpenChat = typeof reqOpenChat.infer;

export const resOpenChat = type({
  type: "'vibes.diy.res-open-chat'",
  appSlug: "string",
  userSlug: "string",
  chatId: "string",
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

export const reqPromptChatSection = type({
  type: "'vibes.diy.req-prompt-chat-section'",
  auth: dashAuthType,
  chatId: "string",
  outerTid: "string", // this is used to emit events to the current chat session
  prompt: LLMRequest,
});

export type ReqPromptChatSection = typeof reqPromptChatSection.infer;

export const resPromptChatSection = type({
  type: "'vibes.diy.res-prompt-chat-section'",
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

export type ResError = typeof resError.infer;

export const resEnsureAppSlugError = type({
  // name: "VibesDiyError",
  type: "'vibes.diy.error'",
  message: "string",
  code: "'require-login'",
  "stack?": "string[]",
});

export type ResEnsureAppSlugError = typeof resEnsureAppSlugError.infer;

// ID types
export type CodeID = string;
export type EnvID = string;

export const reqEnsureAppSlug = type({
  type: "'vibes.diy.req-ensure-app-slug'",
  auth: dashAuthType,
  "appSlug?": "string", // desired app slug
  "userSlug?": "string", // desired user slug
  // "promptId?": "string", // used to emit events to the current chat session
  // "chatId?": "string", // used to emit events to the current chat session
  mode: "'production'|'dev'",
  // env passed to the app
  "env?": vibeUserEnv,
  fileSystem: [vibeFile, "[]"],
});

export type ReqEnsureAppSlug = typeof reqEnsureAppSlug.infer;

// Response types
export const resEnsureAppSlug = type({
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

export type ResEnsureAppSlug = typeof resEnsureAppSlug.infer;
export function isResEnsureAppSlug(obj: unknown): obj is ResEnsureAppSlug {
  return !(resEnsureAppSlug(obj) instanceof type.errors);
}


export const reqGetByUserSlugAppSlug = type({
  type: "'vibes.diy.req-get-by-user-slug-app-slug'",
  auth: dashAuthType,
  userSlug: "string",
  appSlug: "string",
  "sectionId?": "string",
});
export type ReqGetByUserSlugAppSlug = typeof reqGetByUserSlugAppSlug.infer;
export function isReqGetByUserSlugAppSlug(obj: unknown): obj is ReqGetByUserSlugAppSlug {
  return !(reqGetByUserSlugAppSlug(obj) instanceof type.errors);
}

export const resGetByUserSlugAppSlug = type({
  type: "'vibes.diy.res-get-by-user-slug-app-slug'",
  "sectionId?": "string",
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
