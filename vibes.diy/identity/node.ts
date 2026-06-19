// Node-only surface of @vibes.diy/identity.
//
// Keybag access, device-id ES256 signing, and the server-side certificate
// authority — none of which are browser-safe (fs, jose, env-loaded CA keys).
// Kept on a separate subpath so the browser-safe "./index.js" never links them.

import { Lazy, Result } from "@adviser/cement";
import type { SuperThis, FPDeviceIDSession } from "@fireproof/core-types-base";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { getKeyBag } from "@fireproof/core-keybag";
import { DeviceIdKey, DeviceIdSignMsg } from "@fireproof/core-device-id";

// --- Re-exported fireproof crypto/keybag (the seam; swap internals later) ---
export { getKeyBag } from "@fireproof/core-keybag";
export { DeviceIdKey, DeviceIdSignMsg, DeviceIdCSR, DeviceIdCA } from "@fireproof/core-device-id";
export { deviceIdCAFromEnv, getCloudPubkeyFromEnv, tokenApi } from "@fireproof/core-protocols-dashboard";
export { isResDeviceIdRegister } from "@fireproof/core-cli";
export type { ReqDeviceIdRegister } from "@fireproof/core-cli";

/**
 * Build a cached device-id token minter from the local keybag.
 *
 * The single owned implementation of the three previously-duplicated client
 * signers (CLI `vibesDiyApiFactory`, `firefly-defaults.node` `loadDeviceIdGetToken`,
 * and the eval harness). Loads the device cert from the keybag, builds an ES256
 * `DeviceIdSignMsg`, and returns a `Lazy` getToken that re-mints at most once
 * per 60s. Throws a login hint if the device is not yet enrolled.
 *
 * `iss` is the informational JWT issuer (not value-verified server-side); each
 * caller passes its own (`use-vibes/cli`, `use-vibes/standalone`, …).
 */
export async function createDeviceIdGetToken(
  sthis: SuperThis,
  opts: { readonly iss: string }
): Promise<() => Promise<Result<DashAuthType>>> {
  const kb = await getKeyBag(sthis);
  const devid = await kb.getDeviceId();
  if (devid.cert.IsNone()) {
    throw new Error("Run 'npx vibes-diy login' to authenticate this device");
  }
  const rDevkey = await DeviceIdKey.createFromJWK(devid.deviceId.Unwrap());
  if (rDevkey.isErr()) {
    throw rDevkey.Err();
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const payload = devid.cert.Unwrap()!.certificatePayload;
  const signer = new DeviceIdSignMsg(sthis.txt.base64, rDevkey.Ok(), payload);
  let seq = 0;
  return Lazy(
    async (): Promise<Result<DashAuthType>> => {
      const now = Math.floor(Date.now() / 1000);
      const token = await signer.sign(
        {
          iss: opts.iss,
          sub: "device-id",
          deviceId: await rDevkey.Ok().fingerPrint(),
          seq: ++seq,
          exp: now + 120,
          nbf: now - 2,
          iat: now,
          jti: sthis.nextId().str,
        } satisfies FPDeviceIDSession,
        "ES256"
      );
      return Result.Ok({ type: "device-id", token });
    },
    { resetAfter: 60, skipUnref: true }
  );
}
