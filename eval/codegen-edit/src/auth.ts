import { exception2Result, Result } from "@adviser/cement";
import { ensureSuperThis, type SuperThis } from "@vibes.diy/identity";
import { createDeviceIdGetToken } from "@vibes.diy/identity/node";
import { VibesDiyApi } from "@vibes.diy/api-impl";

export interface ApiFactoryResult {
  readonly sthis: SuperThis;
  readonly factory: (apiUrl: string, opts?: { idleTimeoutMs?: number }) => VibesDiyApi;
}

/**
 * Reads the same device-id keybag the CLI uses (a prior `vibes-diy login` is
 * sufficient auth for the eval harness), via the shared
 * `createDeviceIdGetToken` from `@vibes.diy/identity/node`.
 */
export async function buildApiFactory(): Promise<Result<ApiFactoryResult>> {
  const sthis = ensureSuperThis();
  const rGetToken = await exception2Result(() => createDeviceIdGetToken(sthis, { iss: "use-vibes/cli" }));
  if (rGetToken.isErr()) return Result.Err(rGetToken.Err());
  const getToken = rGetToken.Ok();
  return Result.Ok({
    sthis,
    factory: (apiUrl, opts) =>
      new VibesDiyApi({
        apiUrl,
        getToken,
        ...(opts?.idleTimeoutMs !== undefined ? { timeoutMs: opts.idleTimeoutMs } : {}),
      }),
  });
}
