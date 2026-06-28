// Node-only surface of @vibes.diy/identity.
//
// Keybag access, device-id ES256 signing, and the server-side certificate
// authority — none of which are browser-safe (fs, jose, env-loaded CA keys).
// Kept on a separate subpath so the browser-safe "./index.js" never links them.

import { Lazy, Option, Result } from "@adviser/cement";
import type { SuperThis, FPDeviceIDSession, DeviceIdResult } from "@fireproof/core-types-base";
import type { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { getKeyBag as getCoreKeyBag } from "@fireproof/core-keybag";
import { deviceIdRegisterEvento as coreDeviceIdRegisterEvento, isResDeviceIdRegister } from "@fireproof/core-cli";
import { DeviceIdKey } from "./device-id/key.js";
import { DeviceIdSignMsg } from "./device-id/sign.js";

// --- Re-exported crypto/keybag (the seam; swap internals progressively) ---
// Node-CLI only: core-keybag pulls in `find-up` (fs config lookup), which is
// NOT bundleable for Cloudflare Workers. Worker code must use "./server" for
// the CA/token API, never this module.
//
// #2726: normalize unreadable/corrupt keybag bytes into DeviceIdResult.error so
// callers can surface clean re-enroll guidance instead of raw throw paths.
const READ_BAG_FAILED_MARKER = "read bag failed";
const DEVICE_ID_KEYBAG_UNREADABLE_ERR_NAME = "DeviceIdKeybagUnreadableError";
const patchedKeyBags = new WeakSet<object>();

function errorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return String(error);
}

function withCause(message: string, cause: unknown): Error {
  const err = new Error(message);
  (err as Error & { cause?: unknown }).cause = cause;
  return err;
}

function toUnreadableKeybagError(cause: unknown): Error {
  const err = withCause("Device ID keybag is unreadable or corrupt", cause);
  err.name = DEVICE_ID_KEYBAG_UNREADABLE_ERR_NAME;
  return err;
}

export function isUnreadableDeviceIdKeybagError(error: unknown): boolean {
  if (!error) return false;
  if (error && typeof error === "object" && (error as { name?: unknown }).name === DEVICE_ID_KEYBAG_UNREADABLE_ERR_NAME) {
    return true;
  }
  if (errorMessage(error).toLowerCase().includes(READ_BAG_FAILED_MARKER)) {
    return true;
  }
  const cause = error && typeof error === "object" ? (error as { cause?: unknown }).cause : undefined;
  return cause !== undefined && cause !== error ? isUnreadableDeviceIdKeybagError(cause) : false;
}

export function deviceIdKeybagReEnrollMessage(opts?: { readonly headlessEnvVar?: string }): string {
  const base = "Device ID keybag is unreadable or corrupt";
  if (opts?.headlessEnvVar) {
    return `${base} — re-enroll with 'vibes-diy login --force', or set ${opts.headlessEnvVar} for headless auth`;
  }
  return `${base} — re-enroll with 'vibes-diy login --force'`;
}

export async function getKeyBag(sthis: SuperThis) {
  const kb = await getCoreKeyBag(sthis);
  if (!patchedKeyBags.has(kb as object)) {
    const rawGetDeviceId = kb.getDeviceId.bind(kb);
    kb.getDeviceId = async (): Promise<DeviceIdResult> => {
      try {
        return await rawGetDeviceId();
      } catch (error) {
        if (!isUnreadableDeviceIdKeybagError(error)) {
          throw error;
        }
        return {
          deviceId: Option.None(),
          cert: Option.None(),
          error: toUnreadableKeybagError(error),
        };
      }
    };
    patchedKeyBags.add(kb as object);
  }
  return kb;
}
// Device-id crypto (key/sign/csr) + the server-side verifier and CA are now
// in-repo (Tasks 2-3). The production server still reaches the CA/verify through
// core-protocols-dashboard's deviceIdCAFromEnv/tokenApi (./server) until Task 5
// re-homes that layer onto these in-repo classes.
export { DeviceIdKey } from "./device-id/key.js";
export { DeviceIdSignMsg } from "./device-id/sign.js";
export { DeviceIdCSR } from "./device-id/csr.js";
export { DeviceIdVerifyMsg } from "./device-id/verify.js";
export { DeviceIdCA } from "./device-id/ca.js";
// Login device-id-register flow (the localhost cert handler — Bucket C / #1616).
// Generic cmd-ts streaming primitives (isCmdProgress/sendProgress/…) are NOT
// re-exported here: they're CLI-framework, not identity, and stay on core-cli.
export const deviceIdRegisterEvento: typeof coreDeviceIdRegisterEvento = {
  ...coreDeviceIdRegisterEvento,
  handle: async (ctx) => {
    const args = ctx.validated as { readonly forceRenew?: boolean };
    const cliCtx = ctx.ctx.getOrThrow("cliCtx") as { readonly sthis: SuperThis };
    const existing = await (await getKeyBag(cliCtx.sthis)).getDeviceId();
    if (existing.error && isUnreadableDeviceIdKeybagError(existing.error) && !args.forceRenew) {
      return Result.Err(deviceIdKeybagReEnrollMessage());
    }
    try {
      return await coreDeviceIdRegisterEvento.handle(ctx);
    } catch (error) {
      if (isUnreadableDeviceIdKeybagError(error)) {
        return Result.Err(deviceIdKeybagReEnrollMessage());
      }
      throw error;
    }
  },
};
export { isResDeviceIdRegister };
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
 * `missingCertMessage` overrides the not-yet-enrolled error so CLI callers can
 * surface environment-specific guidance (e.g. the `VIBES_DEVICE_ID` headless hint).
 */
export async function createDeviceIdGetToken(
  sthis: SuperThis,
  opts: { readonly iss: string; readonly missingCertMessage?: string; readonly corruptKeybagMessage?: string }
): Promise<() => Promise<Result<DashAuthType>>> {
  const kb = await getKeyBag(sthis);
  const devid = await kb.getDeviceId();
  if (devid.error && isUnreadableDeviceIdKeybagError(devid.error)) {
    throw withCause(opts.corruptKeybagMessage ?? deviceIdKeybagReEnrollMessage(), devid.error);
  }
  if (devid.cert.IsNone()) {
    throw new Error(opts.missingCertMessage ?? "Run 'npx vibes-diy login' to authenticate this device");
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
