import { Result } from "@adviser/cement";
import { VibeDiyApi, type VibesDiyApiParam } from "@vibes.diy/api-impl";
import type { DashAuthType, VibesDiyApiIface } from "@vibes.diy/api-types";
import { DeviceIdKey, DeviceIdSignMsg } from "@fireproof/core-device-id";
import { getKeyBag } from "@fireproof/core-keybag";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { env as processEnv } from "node:process";

const DEFAULT_CLI_VIBES_API_URL = "wss://api.vibes.diy/v1/ws";
const VIBES_API_URL_ENV = "VIBES_DIY_API_URL";

export interface CliVibesApiOptions {
  readonly apiUrl?: string;
  readonly getToken?: () => Promise<Result<DashAuthType>>;
  readonly timeoutMs?: number;
  readonly fetch?: VibesDiyApiParam["fetch"];
  readonly ws?: WebSocket;
}

export function getCliVibesApiUrl(env: Readonly<Record<string, string | undefined>> = processEnv): string {
  const envUrl = env[VIBES_API_URL_ENV];
  switch (true) {
    case typeof envUrl === "string" && envUrl.length > 0:
      return envUrl;
    default:
      return DEFAULT_CLI_VIBES_API_URL;
  }
}

export async function getCliDashAuth(): Promise<Result<DashAuthType>> {
  const sthis = ensureSuperThis();
  const keyBag = await getKeyBag(sthis);
  const existing = await keyBag.getDeviceId();

  if (existing.deviceId.IsNone() || existing.cert.IsNone()) {
    return Result.Err("Not logged in. Run: use-vibes login");
  }

  const jwk = existing.deviceId.unwrap();
  const createResult = await DeviceIdKey.createFromJWK(jwk);
  if (createResult.isErr()) {
    return Result.Err(`Failed to load device key: ${createResult.Err()}`);
  }
  const deviceIdKey = createResult.Ok();
  const cert = existing.cert.unwrap();
  if (!cert) {
    return Result.Err("Not logged in. Run: use-vibes login");
  }

  const fingerprint = await deviceIdKey.fingerPrint();
  const signer = new DeviceIdSignMsg(sthis.txt.base64, deviceIdKey, cert.certificatePayload);
  const token = await signer.sign({ deviceId: fingerprint, seq: 0 } as Record<string, unknown>);

  return Result.Ok({ type: "device-id", token } as DashAuthType);
}

export function toCliVibesApiParam(options: CliVibesApiOptions = {}): VibesDiyApiParam {
  return {
    apiUrl: options.apiUrl ?? getCliVibesApiUrl(),
    getToken: options.getToken ?? getCliDashAuth,
    timeoutMs: options.timeoutMs,
    fetch: options.fetch,
    ws: options.ws,
  };
}

export function createCliVibesApi(options: CliVibesApiOptions = {}): VibesDiyApiIface {
  return new VibeDiyApi(toCliVibesApiParam(options));
}
