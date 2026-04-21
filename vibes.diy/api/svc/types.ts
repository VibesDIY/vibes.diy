import { SuperThis } from "@fireproof/core-types-base";
import { FPApiToken } from "@fireproof/core-types-protocols-dashboard";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { Logger, Result } from "@adviser/cement";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import { LLMHeaders, MsgBase, VibesAssetStorage, VibesFPApiParameters } from "@vibes.diy/api-types";
import { VibesApiTables, VibesSqlite } from "@vibes.diy/api-sql";
import { type } from "arktype";

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
  prodiaToken?: string;
}

export const UserSlugBinding = type({
  type: "'vibes.diy-user-slug-binding'",
  userId: "string",
  userSlug: "string",
  tenant: "string",
});
export type UserSlugBinding = type.infer<typeof UserSlugBinding>;

export function isUserSlugBinding(obj: unknown): obj is UserSlugBinding {
  return !(UserSlugBinding(obj) instanceof type.errors);
}

export const AppSlugBinding = type({
  type: "'vibes.diy-app-slug-binding'",
  userId: "string",
  appSlug: "string",
  ledger: "string",
});
export type AppSlugBinding = type.infer<typeof AppSlugBinding>;

export function isAppSlugBinding(obj: unknown): obj is AppSlugBinding {
  return !(AppSlugBinding(obj) instanceof type.errors);
}

export const AppUserSlugBinding = type({
  type: "'vibes.diy-app-user-slug-binding'",
  userSlug: UserSlugBinding,
  appSlug: AppSlugBinding,
});
export type AppUserSlugBinding = type.infer<typeof AppUserSlugBinding>;

export function isAppUserSlugBinding(obj: unknown): obj is AppUserSlugBinding {
  return !(AppUserSlugBinding(obj) instanceof type.errors);
}
