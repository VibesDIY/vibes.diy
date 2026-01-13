// Should be compatible with FP Dashboard's auth types
import { Result } from "@adviser/cement";
import { type } from "arktype";
import { fileSystemItem } from "../svc/types.js";

// Base types
export const dashAuthType = type({
  type: "'clerk'|'device-id'|'ucan'",
  token: "string"
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
  lang: "'jsx'",
  // the actual code content
  content: "string",
});

const codeRef = type({
  ...baseFileProps,
  type: "'code-ref'",
  // reference id to code stored elsewhere
  // if call-ai will store the result somewhere
  refId: "string"
});

// Asset types - string content
const strAssetBlock = type({
  ...baseFileProps,
  type: "'str-asset-block'",
  // the actual asset content as string
  content: "string"
});

const strAssetRef = type({
  ...baseFileProps,
  type: "'str-asset-ref'",
  // reference id to asset stored elsewhere
  refId: "string"
});

// Asset types - binary content
const uint8AssetBlock = type({
  ...baseFileProps,
  type: "'uint8-asset-block'",
  // the actual asset content as binary
  content: type.instanceOf(Uint8Array)
});

const uint8AssetRef = type({
  ...baseFileProps,
  type: "'uint8-asset-ref'",
  // reference id to asset stored elsewhere
  refId: "string"
});

// Union of all file types
export const vibeFile = type(
  codeBlock
    .or(codeRef)
    .or(strAssetBlock)
    .or(strAssetRef)
    .or(uint8AssetBlock)
    .or(uint8AssetRef)
);

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

export const env = type("Record<string, string>");
export type Env = typeof env.infer;


// Request types
export const reqEnsureAppSlug = type({
  type: "'vibes.diy.req-ensure-app-slug'",
  auth: dashAuthType,
  "appSlug?": "string", // desired app slug
  "userSlug?": "string", // desired user slug
  mode: "'production'|'dev'",
  // env passed to the app
  "env?": env,
  fileSystem: [vibeFile, "[]"]
});

export type ReqEnsureAppSlug = typeof reqEnsureAppSlug.infer;

// Error types
export const resError = type({
  // name: "VibesDiyError",
  type: "'vibes.diy.error'",
  message: "string",
  "code?": "string",
  "stack?": "string[]"
});

export type ResError = typeof resError.infer;

export const resEnsureAppSlugError = type({
  // name: "VibesDiyError",
  type: "'vibes.diy.error'",
  message: "string",
  code: "'require-login'",
  "stack?": "string[]"
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
  env: env,
  fsId: "string",
  fileSystem: [fileSystemItem, "[]"],
  // envRef: "string",
  wrapperUrl: "string",
  entryPointUrl: "string"
});

export type ResEnsureAppSlug = typeof resEnsureAppSlug.infer;

// Message payload union
// const msgPayload = type([
//   [resEnsureAppSlug, "|", resError],
//   "|",
//   [resEnsureAppSlugError, "|", reqEnsureAppSlug]
// ]);

// type("<t>", { box: "t" })
// Message base schema with discriminated union payload
export const msgBase = type({
  tid: "string",
  src: "string",
  dst: "string",
  ttl: "number",
  payload: "unknown"
});

export type MsgBase = typeof msgBase.infer;

export type MsgBaseCfg = Pick<MsgBase, "src" | "dst" | "ttl">; 
export type MsgBaseParam = Partial<MsgBaseCfg>

export type VibesDiyError = (ResError | ResEnsureAppSlugError) & Error;

export type ResultVibesDiy<T> = Result<T, VibesDiyError>;