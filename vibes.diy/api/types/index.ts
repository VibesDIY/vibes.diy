import { Result } from "@adviser/cement";

export * from "./types.js";
export * from "./vibes-diy-serv-ctx.js";
export * from "./common.js";
export * from "./app.js";
export * from "./chat.js";
export * from "./settings.js";
export * from "./fpcloud-token.js";
export * from "./invite-flow.js";
export * from "./request-access.js";
export * from "./vibes-types.js";

export * from "./screen-shotter.js";

export * from "./vibes-diy-api.js";
export * from "./invite.js";

export * from "./cf-env.js";
export * from "./auth.js";

export * from "./prompt.js";
export * from "./app-documents.js";
export * from "./db-acls.js";
export * from "./members.js";

export interface FetchOkResult {
  type: "fetch.ok";
  url: string;
  data: ReadableStream<Uint8Array>;
}

export function isFetchOkResult(result: FetchResult): result is FetchOkResult {
  return result.type === "fetch.ok";
}
export function isFetchErrResult(result: FetchResult): result is FetchErrResult {
  return result.type === "fetch.err";
}
export interface FetchErrResult {
  type: "fetch.err";
  url: string;
  error: Error;
}
export interface FetchNotFoundResult {
  type: "fetch.notfound";
  url: string;
}
export function isFetchNotFoundResult(result: FetchResult): result is FetchNotFoundResult {
  return result.type === "fetch.notfound";
}

export type FetchResult = FetchOkResult | FetchErrResult | FetchNotFoundResult;

// Per-call progress signal emitted from where work physically happens
// (S3-style multipart writes, multipart renames). Higher layers forward
// these unchanged; the push handler turns them into wire-level
// `vibes.diy.res-progress` messages.
export interface StorageProgressInfo {
  readonly stage: string;
  readonly bytes?: number;
  readonly partNumber?: number;
}

export type StorageProgressFn = (info: StorageProgressInfo) => void;

export interface S3PutOptions {
  readonly onProgress?: StorageProgressFn;
}

export interface S3RenameOptions {
  readonly onProgress?: StorageProgressFn;
}

export interface S3Api {
  genId: () => string;
  get(iurl: string): Promise<FetchResult>;
  put(iurl: string, opts?: S3PutOptions): Promise<WritableStream<Uint8Array>>;
  rename(fromUrl: string, toUrl: string, opts?: S3RenameOptions): Promise<Result<void>>;
  // Optional: await a pending put for the given URL. Implementations that don't
  // track in-flight puts can omit this; callers must tolerate undefined.
  awaitPut?(iurl: string): Promise<void>;
}

export interface StorageResult {
  cid: string;
  getURL: string;
  mode: "created" | "existing";
  created: Date;
  size: number;
}

export interface EnsureCallOptions {
  readonly onProgress?: StorageProgressFn;
}

export interface VibesAssetStorage {
  fetch: (url: string) => Promise<FetchResult>;
  ensure: {
    (...items: ReadableStream<Uint8Array | string>[]): Promise<Result<StorageResult>[]>;
    (opts: EnsureCallOptions, ...items: ReadableStream<Uint8Array | string>[]): Promise<Result<StorageResult>[]>;
  };
}
