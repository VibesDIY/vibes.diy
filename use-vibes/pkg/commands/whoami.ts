import { Result } from "@adviser/cement";
import { DeviceIdKey } from "@fireproof/core-device-id";
import { getKeyBag } from "@fireproof/core-keybag";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { decodeJwt } from "jose";
import type { CliOutput } from "./cli-output.js";
import type { ReqListUserSlugAppSlug, ResListUserSlugAppSlug, VibesDiyError } from "@vibes.diy/api-types";
import { createCliVibesApi, getCliDashAuth } from "./vibes-api.js";

export interface WhoamiListResultLike {
  isErr(): boolean;
  Err(): unknown;
  Ok(): ResListUserSlugAppSlug;
}

export interface WhoamiApi {
  listUserSlugAppSlug(req: Omit<ReqListUserSlugAppSlug, "type" | "auth">): Promise<WhoamiListResultLike>;
}

export interface WhoamiDeviceInfo {
  readonly fingerprint: string;
  readonly certExpiry: Date | undefined;
}

export interface WhoamiDeps {
  readonly api?: WhoamiApi;
  readonly deviceInfo?: WhoamiDeviceInfo;
}

function hasCode(value: unknown): value is { readonly code: string } {
  return typeof value === "object" && value !== null && "code" in value && typeof Reflect.get(value, "code") === "string";
}

async function loadDeviceInfo(): Promise<Result<WhoamiDeviceInfo>> {
  const sthis = ensureSuperThis();
  const keyBag = await getKeyBag(sthis);
  const existing = await keyBag.getDeviceId();

  if (existing.deviceId.IsNone()) {
    return Result.Err("No device identity. Run: use-vibes login");
  }

  if (existing.cert.IsNone()) {
    return Result.Err("Not registered. Run: use-vibes login");
  }

  const jwk = existing.deviceId.unwrap();
  const createResult = await DeviceIdKey.createFromJWK(jwk);
  if (createResult.isErr()) {
    return Result.Err(`Failed to load device key: ${createResult.Err()}`);
  }
  const deviceIdKey = createResult.Ok();
  const fingerprint = await deviceIdKey.fingerPrint();

  const cert = existing.cert.unwrap();
  if (!cert) {
    return Result.Err("Not registered. Run: use-vibes login");
  }
  const decoded = decodeJwt(cert.certificateJWT);

  const certExpiry = decoded.exp ? new Date(decoded.exp * 1000) : undefined;
  return Result.Ok({ fingerprint, certExpiry });
}

export async function runWhoami(output: CliOutput, deps: WhoamiDeps = {}): Promise<Result<void>> {
  let deviceInfo: WhoamiDeviceInfo;

  if (deps.deviceInfo) {
    deviceInfo = deps.deviceInfo;
  } else {
    const rDevice = await loadDeviceInfo();
    if (rDevice.isErr()) {
      return Result.Err(rDevice.Err());
    }
    deviceInfo = rDevice.Ok();
  }

  // Fetch handles from API (non-fatal on failure)
  await fetchAndPrintHandles(output, deps);

  output.stdout(`Device: ${deviceInfo.fingerprint}\n`);

  if (deviceInfo.certExpiry) {
    const now = new Date();
    if (deviceInfo.certExpiry < now) {
      output.stdout(`Certificate: expired ${deviceInfo.certExpiry.toISOString()}\n`);
    } else {
      output.stdout(`Certificate: valid until ${deviceInfo.certExpiry.toISOString()}\n`);
    }
  }

  return Result.Ok(undefined);
}

async function fetchAndPrintHandles(output: CliOutput, deps: WhoamiDeps): Promise<void> {
  try {
    const api = await resolveApi(deps);
    if (!api) {
      return;
    }

    const result = await api.listUserSlugAppSlug({});
    if (result.isErr()) {
      const err = result.Err() as VibesDiyError;
      if (hasCode(err) && err.code === "require-login") {
        output.stderr("Session expired — run: use-vibes login\n");
      } else {
        output.stderr("Could not reach API — handle info unavailable\n");
      }
      return;
    }

    const res = result.Ok();
    if (res.items.length === 0) {
      output.stdout("No handles linked\n");
      return;
    }

    for (const item of res.items) {
      output.stdout(`Handle: @${item.userSlug}\n`);
    }
  } catch {
    output.stderr("Could not reach API — handle info unavailable\n");
  }
}

async function resolveApi(deps: WhoamiDeps): Promise<WhoamiApi | undefined> {
  if (deps.api) {
    return deps.api;
  }

  const rAuth = await getCliDashAuth();
  if (rAuth.isErr()) {
    return undefined;
  }
  return createCliVibesApi({
    getToken: () => Promise.resolve(rAuth),
  });
}
