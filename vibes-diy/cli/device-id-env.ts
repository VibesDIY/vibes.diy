import type { SuperThis } from "@fireproof/core";
import type { JWKPrivate, DeviceIdKeyBagItem } from "@fireproof/core-types-base";
import { JWKPrivateSchema } from "@fireproof/core-types-base";
import { getKeyBag } from "@fireproof/core-keybag";
import { Buffer } from "node:buffer";

/**
 * Env var that carries a device-id keybag item so the CLI can authenticate
 * without an interactive `vibes-diy login` — e.g. CI or remote/headless
 * environments where no browser is available to complete the device-cert
 * enrollment.
 *
 * The value is the device-id keybag item: the exact contents of
 * `~/.fireproof/keybag/<id>.json` written by `vibes-diy login`. It may be
 * supplied either as raw JSON or as base64-encoded JSON (base64 avoids
 * quoting/newline trouble when storing JSON in an env var). The full
 * keybag file (`{ id, clazz, item: { deviceId, cert } }`) and the bare item
 * (`{ deviceId, cert }`) are both accepted.
 *
 * Only the device private key and signed certificate are read from it, and the
 * value is never logged. An interactive login already present in the keybag
 * always wins: the env var only seeds a keybag that has no device-id cert yet,
 * so `vibes-diy login --force` still re-enrolls normally.
 */
export const VIBES_DEVICE_ID_ENV = "VIBES_DEVICE_ID";

function parseEnvValue(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // not raw JSON — fall through and try base64-encoded JSON
  }
  let decoded: string;
  try {
    decoded = Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    throw new Error(`${VIBES_DEVICE_ID_ENV} is not valid JSON or base64-encoded JSON`);
  }
  try {
    return JSON.parse(decoded);
  } catch {
    throw new Error(`${VIBES_DEVICE_ID_ENV} is not valid JSON or base64-encoded JSON`);
  }
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

interface SeededDeviceId {
  readonly deviceId: JWKPrivate;
  readonly cert: DeviceIdKeyBagItem["cert"];
}

function extractDeviceId(parsed: unknown): SeededDeviceId {
  const top = asRecord(parsed);
  // Accept the full keybag file ({ id, clazz, item: {...} }) or the bare item ({ deviceId, cert }).
  const item = asRecord(top?.item) ?? top;
  if (!item || !("deviceId" in item)) {
    throw new Error(`${VIBES_DEVICE_ID_ENV} must contain a device-id keybag item with "deviceId" and "cert"`);
  }
  // The private key is the only part we sign with, so validate it strictly.
  let deviceId: JWKPrivate;
  try {
    deviceId = JWKPrivateSchema.parse(item.deviceId) as JWKPrivate;
  } catch (e) {
    throw new Error(`${VIBES_DEVICE_ID_ENV} has an invalid device private key: ${(e as Error).message}`, { cause: e });
  }
  // The cert is opaque to the CLI (the server is the authority on its validity),
  // so only check the shape we actually forward to the signer.
  const cert = asRecord(item.cert);
  if (!cert || typeof cert.certificateJWT !== "string" || !asRecord(cert.certificatePayload)) {
    throw new Error(
      `${VIBES_DEVICE_ID_ENV} is missing the signed certificate — copy the full ~/.fireproof/keybag/<id>.json written by 'vibes-diy login'`
    );
  }
  return { deviceId, cert: cert as unknown as DeviceIdKeyBagItem["cert"] };
}

/**
 * Seed the keybag from {@link VIBES_DEVICE_ID_ENV} when it is set and the keybag
 * has no device-id certificate yet. Returns `true` when it seeded, `false` when
 * the env var is unset or an interactive login already exists. Throws with a
 * clear message when the env var is set but malformed.
 */
export async function seedDeviceIdFromEnv(sthis: SuperThis): Promise<boolean> {
  const raw = sthis.env.get(VIBES_DEVICE_ID_ENV);
  if (!raw) return false;
  const kb = await getKeyBag(sthis);
  const existing = await kb.getDeviceId();
  if (existing.cert.IsSome()) return false; // an interactive `vibes-diy login` always wins
  const { deviceId, cert } = extractDeviceId(parseEnvValue(raw));
  await kb.setDeviceId(deviceId, cert);
  return true;
}
