import { FPDeviceIDSession, type SuperThis } from "@fireproof/core";
import { Lazy, Result } from "@adviser/cement";
import { ensureSuperThis } from "@fireproof/core-runtime";
import { getKeyBag } from "@fireproof/core-keybag";
import { DeviceIdKey, DeviceIdSignMsg } from "@fireproof/core-device-id";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { VibesDiyApi } from "@vibes.diy/api-impl";

export interface ApiFactoryResult {
  readonly sthis: SuperThis;
  readonly factory: (apiUrl: string, opts?: { idleTimeoutMs?: number }) => VibesDiyApi;
}

/**
 * Mirror of `vibesDiyApiFactory` in `vibes-diy/cli/main.ts`. Replicated here
 * because that helper isn't exported from the CLI package. Reads the same
 * device-id keybag the CLI uses, so a prior `vibes-diy login` is sufficient
 * auth for the eval harness.
 */
export async function buildApiFactory(): Promise<ApiFactoryResult> {
  const sthis = ensureSuperThis();
  const kb = await getKeyBag(sthis);
  const devid = await kb.getDeviceId();
  const rDevkey = await DeviceIdKey.createFromJWK(devid.deviceId.Unwrap());
  if (rDevkey.isErr()) throw rDevkey.Err();
  if (devid.cert.IsNone()) throw new Error("Device ID certificate is missing — run `vibes-diy login` first");
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const payload = devid.cert.Unwrap()!.certificatePayload;
  const deviceIdSigner = new DeviceIdSignMsg(sthis.txt.base64, rDevkey.Ok(), payload);
  let seq = 0;
  const getToken = Lazy(
    async (): Promise<Result<DashAuthType>> => {
      const now = Math.floor(Date.now() / 1000);
      const token = await deviceIdSigner.sign(
        {
          iss: "use-vibes/cli",
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
  return {
    sthis,
    factory: (apiUrl, opts) =>
      new VibesDiyApi({
        apiUrl,
        getToken,
        ...(opts?.idleTimeoutMs !== undefined ? { timeoutMs: opts.idleTimeoutMs } : {}),
      }),
  };
}
