import { Result } from "@adviser/cement";
import { DeviceIdKey } from "@fireproof/core-device-id";
import { getKeyBag } from "@fireproof/core-keybag";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { decodeJwt } from "jose";
import type { CliOutput } from "./cli-output.js";

export async function runWhoami(output: CliOutput): Promise<Result<void>> {
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

  // Extract user info from creatingUser claims (embedded by CA during signing)
  const creatingUser = (decoded as Record<string, unknown>).creatingUser as
    | { params?: { email?: string; name?: string; first?: string; last?: string }; userId?: string }
    | undefined;

  if (creatingUser?.params) {
    const { email, name, first, last } = creatingUser.params;
    const displayName = name || [first, last].filter(Boolean).join(" ") || undefined;
    if (displayName) {
      output.stdout(`Name: ${displayName}\n`);
    }
    if (email) {
      output.stdout(`Email: ${email}\n`);
    }
  }

  if (creatingUser?.userId) {
    output.stdout(`User ID: ${creatingUser.userId}\n`);
  }

  output.stdout(`Device: ${fingerprint}\n`);

  if (decoded.exp) {
    const expiry = new Date(decoded.exp * 1000);
    const now = new Date();
    if (expiry < now) {
      output.stdout(`Certificate: expired ${expiry.toISOString()}\n`);
    } else {
      output.stdout(`Certificate: valid until ${expiry.toISOString()}\n`);
    }
  }

  return Result.Ok(undefined);
}
