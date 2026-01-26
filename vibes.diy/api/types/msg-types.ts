// Should be compatible with FP Dashboard's auth types
import { Result } from "@adviser/cement";
import { type } from "arktype";
import { vibeEnv } from "@vibes.diy/use-vibes-base";
import { fileSystemItem } from "./types.js";
import { BlockMsgs, PromptMsg } from "@vibes.diy/call-ai-v2";

// Base types
export const dashAuthType = type({
  type: "'clerk'|'device-id'|'ucan'",
  token: "string",
});

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

// export const vibeFileRes = type({
//   type: "'vibe-file-res'",
//   filename: "string",
//   entryPoint: "boolean",
//   mimetype: "string",
//   storageURI: "string",
//   storageItem: {
//     cid: "string",
//     size: "number"
//   }
// })

export type VibeFile = typeof vibeFile.infer;

// Request types
export const reqEnsureAppSlug = type({
  type: "'vibes.diy.req-ensure-app-slug'",
  auth: dashAuthType,
  "appSlug?": "string", // desired app slug
  "userSlug?": "string", // desired user slug
  mode: "'production'|'dev'",
  // env passed to the app
  "env?": vibeEnv,
  fileSystem: [vibeFile, "[]"],
});

export type ReqEnsureAppSlug = typeof reqEnsureAppSlug.infer;

export const reqEnsureChatContext = type({
  type: "'vibes.diy.req-ensure-chat-context'",
  auth: dashAuthType,
  "contextId?": "string", // desired context id
});

export type ReqEnsureChatContext = typeof reqEnsureChatContext.infer;

export const resEnsureChatContext = type({
  type: "'vibes.diy.res-ensure-chat-context'",
  contextId: "string",
});

export type ResEnsureChatContext = typeof resEnsureChatContext.infer;

// Error types
export const resError = type({
  // name: "VibesDiyError",
  type: "'vibes.diy.error'",
  message: "string",
  "code?": "string",
  "stack?": "string[]",
});

const blockMsg = BlockMsgs.or(PromptMsg);

export const reqAppendChatSection = type({
  type: "'vibes.diy.req-append-chat-section'",
  auth: dashAuthType,
  contextId: "string",
  origin: "'user'|'llm'",
  // Array<{ type: 'origin.prompt' | 'block.xxx'}>
  blocks: [blockMsg, "[]"],
});
export type ReqAppendChatSection = typeof reqAppendChatSection.infer;

export const resAppendChatSection = type({
  type: "'vibes.diy.res-append-chat-section'",
  contextId: "string",
  seq: "number",
  origin: "'user'|'llm'",
});
export type ResAppendChatSection = typeof resAppendChatSection.infer;

// Profile types
export const userProfileType = type({
  type: "'user'",
  name: "string",
  "url?": "string",
});
export type UserProfileType = typeof userProfileType.infer;

export const profileType = userProfileType; // future: .or(shopProfile)
export type ProfileType = typeof profileType.infer;

// User slug claim/list types
export const reqClaimUserSlug = type({
  type: "'vibes.diy.req-claim-user-slug'",
  auth: dashAuthType,
  userSlug: "string",
  "profile?": profileType,
});
export type ReqClaimUserSlug = typeof reqClaimUserSlug.infer;

export const resClaimUserSlug = type({
  type: "'vibes.diy.res-claim-user-slug'",
  userSlug: "string",
  owned: "boolean",
  "profile?": profileType,
});
export type ResClaimUserSlug = typeof resClaimUserSlug.infer;

export const reqListUserSlugs = type({
  type: "'vibes.diy.req-list-user-slugs'",
  auth: dashAuthType,
});
export type ReqListUserSlugs = typeof reqListUserSlugs.infer;

export const resListUserSlugs = type({
  type: "'vibes.diy.res-list-user-slugs'",
  slugs: ["string", "[]"],
});
export type ResListUserSlugs = typeof resListUserSlugs.infer;

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

// Response types
export const resEnsureAppSlug = type({
  type: "'vibes.diy.res-ensure-app-slug'",
  appSlug: "string",
  userSlug: "string",
  mode: "'production'|'dev'",
  env: vibeEnv,
  fsId: "string",
  fileSystem: [fileSystemItem, "[]"],
  // envRef: "string",
  wrapperUrl: "string",
  entryPointUrl: "string",
});

export type ResEnsureAppSlug = typeof resEnsureAppSlug.infer;

export const msgBase = type({
  tid: "string",
  src: "string",
  dst: "string",
  ttl: "number",
  payload: "unknown",
});

export type MsgBase = typeof msgBase.infer;

export interface MsgBox<T = unknown> extends Omit<MsgBase, "payload"> {
  payload: T;
}

export type MsgBaseCfg = Pick<MsgBase, "src" | "dst" | "ttl">;
export type MsgBaseParam = Partial<MsgBaseCfg>;

export type VibesDiyError = (ResError | ResEnsureAppSlugError) & Error;

export type ResultVibesDiy<T> = Result<T, VibesDiyError>;

const w3cMessageEventBox = type({
  type: "'MessageEvent'",
  event: type({
    data: type("string").or(["instanceof", Uint8Array]),
    origin: "string|null",
    lastEventId: "string",
    source: "unknown",
    ports: "unknown",
  }).partial(),
});

const w3cCloseEventBox = type({
  type: "'CloseEvent'",
  event: type({
    wasClean: "boolean",
    code: "number",
    reason: "string",
  }),
});

const w3cErrorEventBox = type({
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
