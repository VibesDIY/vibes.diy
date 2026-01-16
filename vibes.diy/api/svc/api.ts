import { SuperThis } from "@fireproof/core-types-base";
import { VibesSqlite } from "./create-handler.js";
import { ensureLogger } from "@fireproof/core-runtime";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { FPApiParameters, FPApiToken } from "@fireproof/core-types-protocols-dashboard";
import { Logger, Result } from "@adviser/cement";
import { ImportMapProps } from "./intern/import-map.js";
import { VibesEnv } from "@vibes.diy/use-vibes-base";

export type VibesFPApiParameters = Pick<FPApiParameters, "cloudPublicKeys" | "clerkPublishableKey"> & {
  maxAppSlugPerUserId: number;
  maxUserSlugPerUserId: number;
  maxAppsPerUserId: number;
  wrapperBaseUrl: string; // relative should be access to Clerk-Auth to provide the entrypoint via postmessage the tokens to access FPCloud
  vibes: {
    svc: {
      hostnameBase: string; // localhost.vibes.app
      protocol: "https" | "http";
    };
    env: VibesEnv;
  };
  assetCacheUrl: string; // https://asset-cache.vibes.app/{assetId}
  importMapProps: ImportMapProps;
};

export interface StorageResult {
  cid: string;
  getURL: string;
  mode: "created" | "existing";
  created: Date;
  size: number;
}

export interface CfCacheIf {
  match(request: Request): Promise<Response | null>;
  put(request: Request, response: Response): Promise<void>;
}

export interface VibesApiSQLCtx {
  sthis: SuperThis;
  db: VibesSqlite;
  tokenApi: Record<string, FPApiToken>;
  deviceCA: DeviceIdCAIf;
  logger: Logger;
  params: VibesFPApiParameters;
  cache: CfCacheIf;
  fetchPkgVersion(pkg: string): Promise<string | undefined>;
  waitUntil<T>(promise: Promise<T>): void;
  ensureStorage(...items: { cid: string; data: Uint8Array }[]): Promise<Result<StorageResult[]>>;
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
