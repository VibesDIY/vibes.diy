/**
 * Node-only keybag loader for the standalone fireproof() factory.
 *
 * Loaded via dynamic import only when the caller doesn't supply
 * opts.getToken — keeps the device-id + keybag deps out of any browser
 * bundle that imports use-vibes for SSR or iframe code.
 *
 * Lifted essentially verbatim from vibesDiyApiFactory in
 * vibes-diy/cli/main.ts. Same lifecycle: load device cert from keybag,
 * build a DeviceIdSignMsg signer, return a Lazy() getToken with a 60-second
 * resetAfter so the same JWT isn't re-minted on every WS request.
 */
import type { Result } from "@adviser/cement";
import type { FPDeviceIDSession, SuperThis } from "@fireproof/core-types-base";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { Lazy, Result as CementResult } from "@adviser/cement";
import { getKeyBag } from "@fireproof/core-keybag";
import { DeviceIdKey, DeviceIdSignMsg } from "@fireproof/core-device-id";

export async function loadDeviceIdGetToken(sthis: SuperThis): Promise<() => Promise<Result<DashAuthType>>> {
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
  const deviceIdSigner = new DeviceIdSignMsg(sthis.txt.base64, rDevkey.Ok(), payload);
  let seq = 0;
  return Lazy(
    async (): Promise<Result<DashAuthType>> => {
      const now = Math.floor(Date.now() / 1000);
      const token = await deviceIdSigner.sign(
        {
          iss: "use-vibes/standalone",
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
      return CementResult.Ok({
        type: "device-id",
        token,
      });
    },
    { resetAfter: 60, skipUnref: true }
  );
}
