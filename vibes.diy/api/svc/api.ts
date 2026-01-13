import { SuperThis } from "@fireproof/core-types-base";
import { VibesSqlite } from "./create-handler.js";
import { ensureLogger } from "@fireproof/core-runtime";
import { DeviceIdCAIf } from "@fireproof/core-types-device-id";
import { FPApiParameters, FPApiToken } from "@fireproof/core-types-protocols-dashboard";
import { Logger, Result } from "@adviser/cement";

export type VibesFPApiParameters = Pick<FPApiParameters, "cloudPublicKeys" | "clerkPublishableKey"> & {
  maxAppSlugPerUserId: number;
  maxUserSlugPerUserId: number;
  maxAppsPerUserId: number;
};

export interface StorageResult {
  cid: string;
  getURL: string;
  mode: "created" | "existing";
  created: Date;
  size: number;
}

export interface VibesApiSQLCtx {
  sthis: SuperThis;
  db: VibesSqlite;
  tokenApi: Record<string, FPApiToken>;
  deviceCA: DeviceIdCAIf;
  logger: Logger;
  params: VibesFPApiParameters;
  ensureStorage(...items: {cid: string, data: Uint8Array}[]): Promise<Result<StorageResult[]>>;
}

export function createVibesFPApiSQLCtx(
  sthis: SuperThis,
  db: VibesSqlite,
  tokenApi: Record<string, FPApiToken>,
  ensureStorage: (...items: {cid: string, data: Uint8Array}[]) => Promise<Result<StorageResult[]>>,
  deviceCA: DeviceIdCAIf,
  params: VibesFPApiParameters
): VibesApiSQLCtx {
  const logger = ensureLogger(sthis, "VibesApiSQLCtx");
  return {
    db,
    tokenApi: tokenApi,
    sthis: sthis,
    logger: logger,
    params: params,
    deviceCA,
    ensureStorage
  };
}
