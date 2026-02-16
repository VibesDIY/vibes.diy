import { SuperThis } from "@fireproof/core-types-base";
import { FPApiToken } from "@fireproof/core-types-protocols-dashboard";
import { VibesSqlite } from "./create-handler.js";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { Logger } from "@adviser/cement";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { LLMHeaders, VibesFPApiParameters } from "@vibes.diy/api-types";
import type { AssetProvider } from "./intern/asset-provider.js";

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
  assetProvider: AssetProvider;
  llmRequest(prompt: LLMRequest & { headers: LLMHeaders }): Promise<Response>;
}
