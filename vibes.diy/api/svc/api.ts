import { SuperThis } from "@fireproof/core-types-base";
import { VibesSqlite } from "./create-handler.js";
import { ensureLogger } from "@fireproof/core-runtime";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { FPApiParameters, FPApiToken } from "@fireproof/core-types-protocols-dashboard";
import { Logger, Result } from "@adviser/cement";
import { VibesEnv } from "@vibes.diy/use-vibes-base";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { type } from "arktype";

export const LLMEnforced = type({
  debug: "boolean = false",
  transforms: type("string[]").default(() => ["middle-out"]),
});
export type LLMEnforced = typeof LLMEnforced.infer;

export const LLMHeaders = type({
  "HTTP-Referer": type("string").default("https://vibes.diy"),
  "X-Title": type("string").default("Vibes DIY"),
  "[string]": "string",
});
export type LLMHeaders = typeof LLMHeaders.infer;

export const LLMDefault = type({
  model: "string = 'anthropic/claude-3-opus'",
});
export type LLMDefault = typeof LLMDefault.infer;

export type VibesFPApiParameters = Pick<FPApiParameters, "cloudPublicKeys" | "clerkPublishableKey"> & {
  maxAppSlugPerUserId: number;
  maxUserSlugPerUserId: number;
  maxAppsPerUserId: number;
  npmUrl: string;
  wrapperBaseUrl: string; // relative should be access to Clerk-Auth to provide the entrypoint via postmessage the tokens to access FPCloud
  vibes: {
    svc: {
      hostnameBase: string; // localhost.vibes.app
      protocol: "https" | "http";
    };
    env: VibesEnv;
  };
  assetCacheUrl: string; // https://asset-cache.vibes.app/{assetId}
  // importMapProps: ImportMapProps;
  llm: {
    default: LLMDefault;
    enforced: LLMEnforced;
    headers: LLMHeaders;
  };
};

export interface StorageResult {
  cid: string;
  getURL: string;
  mode: "created" | "existing";
  created: Date;
  size: number;
}

export interface CfCacheIf {
  delete(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean>;
  match(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
}

export interface VibesApiSQLCtx {
  sthis: SuperThis;
  db: VibesSqlite;
  tokenApi: Record<string, FPApiToken>;
  connections: Set<WSSendProvider>;
  deviceCA: DeviceIdCAIf;
  logger: Logger;
  netHash(): string;
  params: VibesFPApiParameters;
  cache: CfCacheIf;
  fetchPkgVersion(pkg: string): Promise<string | undefined>;
  // waitUntil<T>(promise: Promise<T>): void;
  ensureStorage(...items: { cid: string; data: Uint8Array }[]): Promise<Result<StorageResult[]>>;

  llmRequest(prompt: LLMRequest & { headers: LLMHeaders }): Promise<Response>;
}

export function createVibesFPApiSQLCtx(
  ctx: Omit<VibesApiSQLCtx, "logger"> & {
    logger?: Logger;
  }
): VibesApiSQLCtx {
  const logger = ctx.logger ?? ensureLogger(ctx.sthis, "VibesApiSQLCtx");
  return {
    ...ctx,
    logger,
  };
}
