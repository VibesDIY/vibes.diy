import { Result } from "@adviser/cement";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

export interface VibesDiySrvSandboxArgs {
  // dashApi: ReturnType<typeof clerkDashApi>;
  chatApi: VibesDiyApiIface;
  vibeApi?: VibesDiyApiIface;
  errorLogger: (r: string | Result<unknown> | Error) => void;
  eventListeners: {
    addEventListener: typeof window.addEventListener;
    removeEventListener: typeof window.removeEventListener;
  };
  // Optional injected fetcher — defaults to globalThis.fetch. Tests pass
  // a fake here to avoid mocking globals.
  fetch?: typeof fetch;
  // Called when the sandboxed app fires vibe.req.login. Opens the platform
  // sign-in UI. Optional: if absent the request is silently ignored.
  openSignIn?: () => void;
  // Stage C: hook the asset-host cookie bridge into the iframe boot
  // handshake. Called BEFORE we post vibe.evt.runtime.ack — the iframe
  // gates every RPC on that ack, so any meta.url the iframe ever sees
  // is already post-cookie. Idempotent + cached at the module level
  // (see pkg/app/lib/asset-session.ts), so redundant calls are no-ops.
  // Optional: tests omit it; production binds it via the provider.
  ensureAssetSession?: () => Promise<void>;
}


export interface VibeApiCapableSandbox {
  readonly args: VibesDiySrvSandboxArgs;
  readonly vibeApi: VibesDiyApiIface | undefined;
}
