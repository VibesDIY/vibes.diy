import { SuperThis } from "@fireproof/core-types-base";
import { FPApiToken } from "@fireproof/core-types-protocols-dashboard";
import { WSSendProvider } from "./svc-ws-send-provider.js";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { Logger, Result } from "@adviser/cement";
import { LLMRequest } from "@vibes.diy/call-ai-v2";
import {
  type EvtRequestGrant,
  type EvtUserNotification,
  LLMHeaders,
  MsgBase,
  VibesAssetStorage,
  VibesFPApiParameters,
} from "@vibes.diy/api-types";
import { VibesApiTables, VibesSqlite } from "@vibes.diy/api-sql";
import { type } from "arktype";
import type { AssetGrantSigner } from "./asset-grant.js";
import type { AssetSessionSigner } from "./asset-session.js";

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
  assetGrantSigner: AssetGrantSigner;
  assetSessionSigner: AssetSessionSigner;
  llmRequest(prompt: LLMRequest & { headers: LLMHeaders }, opts?: { readonly signal?: AbortSignal }): Promise<Response>;
  prodiaToken?: string;
  metaAccessToken?: string;
  metaAdAccountId?: string;
  metaPixelId?: string;
  notifyDocChanged?(
    evt: { ownerHandle: string; appSlug: string; dbName: string; docId: string },
    senderConnId: string
  ): Promise<void>;
  registerDocSubscription?(subscriptionKey: string): Promise<void>;
  deregisterDocSubscription?(subscriptionKey: string): Promise<void>;
  notifyRequestGrantChanged?(evt: EvtRequestGrant, senderConnId: string): Promise<void>;
  registerRequestGrantSubscription?(subscriptionKey: string): Promise<void>;
  deregisterRequestGrantSubscription?(subscriptionKey: string): Promise<void>;
  notifyUser?(userId: string, evt: EvtUserNotification, senderConnId: string): Promise<void>;
  registerUserSubscription?(userId: string): Promise<void>;
  deregisterUserSubscription?(userId: string): Promise<void>;
}

export const HandleBinding = type({
  type: "'vibes.diy-user-slug-binding'",
  userId: "string",
  ownerHandle: "string",
  tenant: "string",
});
export type HandleBinding = type.infer<typeof HandleBinding>;

export function isHandleBinding(obj: unknown): obj is HandleBinding {
  return !(HandleBinding(obj) instanceof type.errors);
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

export const AppHandleBinding = type({
  type: "'vibes.diy-app-user-slug-binding'",
  ownerHandle: HandleBinding,
  appSlug: AppSlugBinding,
});
export type AppHandleBinding = type.infer<typeof AppHandleBinding>;

export function isAppHandleBinding(obj: unknown): obj is AppHandleBinding {
  return !(AppHandleBinding(obj) instanceof type.errors);
}
