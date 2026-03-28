import { SuperThis } from "@fireproof/core-types-base";
import { FPApiToken } from "@fireproof/core-types-protocols-dashboard";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { Logger, Result } from "@adviser/cement";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { LLMHeaders, MsgBase, VibesAssetStorage, VibesFPApiParameters } from "@vibes.diy/api-types";
import { VibesApiTables, VibesSqlite } from "@vibes.diy/api-sql";

export type { VibesApiTables };
export interface CfCacheIf {
  delete(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean>;
  match(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<Response | undefined>;
  put(request: RequestInfo | URL, response: Response): Promise<void>;
}
export interface VibesApiSQLCtx {
  sthis: SuperThis;
  sql: {
    db: VibesSqlite;
    tables: VibesApiTables;
  };
  fpCloud: {
    url: string;
    secretToken: string;
    publicToken: string;
    issuer: string;
    audience: string;
    validFor: number;
  };
  tokenApi: Record<string, FPApiToken>;
  connections: Set<WSSendProvider>;
  deviceCA: DeviceIdCAIf;
  logger: Logger;
  // sendEmail: (email: RawEmailWithoutFrom) => Promise<
  //   Result<{
  //     result: unknown;
  //   }>
  // >;
  postQueue(msg: MsgBase): Promise<void>;
  netHash(): string;
  params: VibesFPApiParameters;
  cache: CfCacheIf;
  fetchPkgVersion(pkg: string): Promise<Result<{ src: string; version: string }>>;
  fetchAsset(url: string): Promise<Result<ReadableStream<Uint8Array>>>;
  storage: VibesAssetStorage;
  llmRequest(prompt: LLMRequest & { headers: LLMHeaders }): Promise<Response>;
}
