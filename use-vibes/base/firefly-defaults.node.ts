/**
 * Node-only keybag loader for the standalone fireproof() factory.
 *
 * Loaded via dynamic import only when the caller doesn't supply opts.getToken
 * — keeps the device-id + keybag deps out of any browser bundle that imports
 * use-vibes for SSR or iframe code.
 *
 * Thin wrapper over the shared `createDeviceIdGetToken` in
 * `@vibes.diy/identity/node` (the single owned device-id signer). Same
 * lifecycle: load the device cert from the keybag, build an ES256 signer, and
 * return a `Lazy` getToken that re-mints at most once per 60s.
 */
import type { Result } from "@adviser/cement";
import type { SuperThis, DashAuthType } from "@vibes.diy/identity";
import { createDeviceIdGetToken } from "@vibes.diy/identity/node";

export async function loadDeviceIdGetToken(sthis: SuperThis): Promise<() => Promise<Result<DashAuthType>>> {
  return createDeviceIdGetToken(sthis, { iss: "use-vibes/standalone" });
}
