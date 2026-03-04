import { Result } from "@adviser/cement";

export * from "./types.js";
export * from "./vibes-diy-serv-ctx.js";
export * from "./msg-types.js";
export * from "./vibes-types.js";

export * from "./screen-shotter.js";

export * from "./vibes-diy-api.js";
export * from "./invite.js";

export * from "./cf-env.js";

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

export interface S3Api {
  genId: () => string;
  get(iurl: string): Promise<FetchResult>;
  put(iurl: string): Promise<WritableStream<Uint8Array>>;
  rename(fromUrl: string, toUrl: string): Promise<Result<void>>;
}
