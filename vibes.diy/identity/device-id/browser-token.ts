// Browser-safe device-id token minter.
//
// `createDeviceIdGetToken` in ../node.ts is Node-only because it reaches the
// keybag through `getKeyBag` (fs / find-up). The actual signing path
// (DeviceIdKey + DeviceIdSignMsg, both jose-based) is fully isomorphic, so a
// browser can mint the exact same wire token if it is handed the keybag *item*
// directly instead of reading it off disk.
//
// This is the token seam for the device-id browser-login spec
// (docs/specs/2026-06-28-device-id-browser-login.md, Seam 1): the qa-pr harness
// injects the keybag item (sourced from VIBES_DEVICE_ID / _PREVIEW) and the web
// app mints `{ type: "device-id", token }` per message, just like the CLI.
import { Lazy, Result } from "@adviser/cement";
import type { SuperThis, FPDeviceIDSession, CertificatePayload } from "@fireproof/core-types-base";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import type { JWKPrivate } from "../types/wire.js";
import { DeviceIdKey } from "./key.js";
import { DeviceIdSignMsg } from "./sign.js";

/** The shape the CLI persists in `~/.fireproof/keybag/<id>.json` (the `item`),
 * and that `VIBES_DEVICE_ID` carries — the private key plus the signed cert. */
export interface DeviceIdItem {
  readonly deviceId: JWKPrivate;
  readonly cert: {
    readonly certificateJWT: string;
    readonly certificatePayload: CertificatePayload;
  };
}

/**
 * Returns a getToken() that mints short-lived device-id JWTs from an in-memory
 * keybag item — the browser-safe analogue of createDeviceIdGetToken(). The
 * returned function is Lazy-cached (re-mints at most every 60s, like the CLI).
 */
export async function createDeviceIdGetTokenFromItem(
  sthis: SuperThis,
  item: DeviceIdItem,
  opts: { readonly iss: string }
): Promise<() => Promise<Result<DashAuthType>>> {
  const rDevkey = await DeviceIdKey.createFromJWK(item.deviceId);
  if (rDevkey.isErr()) {
    throw rDevkey.Err();
  }
  const signer = new DeviceIdSignMsg(sthis.txt.base64, rDevkey.Ok(), item.cert.certificatePayload);
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
