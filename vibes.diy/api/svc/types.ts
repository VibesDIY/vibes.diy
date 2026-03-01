import { SuperThis } from "@fireproof/core-types-base";
import { FPApiToken } from "@fireproof/core-types-protocols-dashboard";
import { VibesSqlite } from "./create-handler.js";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { Logger, Result } from "@adviser/cement";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { LLMHeaders, MsgBase, VibesFPApiParameters } from "@vibes.diy/api-types";

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
  postQueue(msg: MsgBase): Promise<void>;
  netHash(): string;
  params: VibesFPApiParameters;
  cache: CfCacheIf;
  fetchPkgVersion(pkg: string): Promise<Result<{ src: string; version: string }>>;
  fetchAsset(url: string): Promise<Result<ReadableStream<Uint8Array>>>;
  storage: {
    fetch(url: string): Promise<Result<ReadableStream<Uint8Array>>>;
    ensure(...items: { cid: string; data: Uint8Array }[]): Promise<Result<StorageResult[]>>;
  };
  llmRequest(prompt: LLMRequest & { headers: LLMHeaders }): Promise<Response>;
}
