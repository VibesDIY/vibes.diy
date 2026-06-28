// Browser device-id session intake (device-id browser-login spec, Seam 1).
//
// The qa-pr harness injects a keybag item (sourced from VIBES_DEVICE_ID /
// _PREVIEW) into localStorage before the app boots. When present, the app
// authenticates as that user via device-id tokens instead of Clerk. No injected
// key → unchanged Clerk behavior.
import { Result } from "@adviser/cement";
import type { SuperThis } from "@fireproof/use-fireproof";
import { createDeviceIdGetTokenFromItem, JWKPrivateSchema, type DashAuthType, type DeviceIdItem } from "@vibes.diy/identity";

// localStorage key the qa-pr harness writes (raw keybag JSON or base64 of it).
export const DEVICE_ID_KEYBAG_KEY = "vibes.diy.device-id-keybag";

// Informational `iss` for browser-minted device tokens (the server authenticates
// off the cert CA, not this claim — mirrors the CLI's "use-vibes/cli").
const DEVICE_ID_ISS = "use-vibes/web";

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

/**
 * Read + validate the injected keybag item. Buffer-free (browser-safe): accepts
 * raw JSON or base64-encoded JSON, and the full keybag file ({ item }) or the
 * bare item. Returns undefined when no/invalid keybag is present (→ Clerk path).
 */
export function readDeviceIdItem(sthis: SuperThis): DeviceIdItem | undefined {
  if (typeof localStorage === "undefined") return undefined;
  const raw = localStorage.getItem(DEVICE_ID_KEYBAG_KEY);
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    try {
      parsed = JSON.parse(sthis.txt.base64.decode(raw.trim()));
    } catch {
      return undefined;
    }
  }

  const top = asRecord(parsed);
  const item = asRecord(top?.item) ?? top;
  if (!item || !("deviceId" in item)) return undefined;

  // Validate the private key strictly (it's what we sign with); the cert is
  // opaque to the client (the server is the authority on its validity), so only
  // check the shape we forward to the signer.
  const devKey = JWKPrivateSchema.safeParse(item.deviceId);
  if (!devKey.success) return undefined;
  const cert = asRecord(item.cert);
  if (!cert || typeof cert.certificateJWT !== "string" || !asRecord(cert.certificatePayload)) {
    return undefined;
  }
  return item as unknown as DeviceIdItem;
}

/** True when a usable device-id keybag is injected. */
export function isDeviceIdSession(sthis: SuperThis): boolean {
  return readDeviceIdItem(sthis) !== undefined;
}

/**
 * Build a getToken() backed by the injected keybag, or undefined if none. The
 * underlying minter is Lazy-cached (re-mints at most every 60s), so the returned
 * function is cheap to call per message.
 */
export function buildDeviceIdGetToken(sthis: SuperThis): (() => Promise<Result<DashAuthType>>) | undefined {
  const item = readDeviceIdItem(sthis);
  if (!item) return undefined;
  let lazyFn: Promise<() => Promise<Result<DashAuthType>>> | undefined;
  return async (): Promise<Result<DashAuthType>> => {
    try {
      if (!lazyFn) lazyFn = createDeviceIdGetTokenFromItem(sthis, item, { iss: DEVICE_ID_ISS });
      const fn = await lazyFn;
      return fn();
    } catch (e) {
      return Result.Err(e as Error);
    }
  };
}
