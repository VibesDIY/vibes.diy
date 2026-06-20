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
  // Host-side consent gate for sandbox-initiated avatar writes. Called with
  // the proposed CID (and an optional mime hint) BEFORE ensureUserSettings
  // runs; the host shows a preview/confirm modal and resolves `true` only when
  // the user explicitly approves. Resolving `false` cancels the write.
  //
  // `getURL` is the storage URI the host itself learned when it proxied the
  // `putAsset` that produced this CID — server-supplied, never sandbox-
  // supplied — so the modal can preview the exact bytes that will be persisted
  // without trusting a value the vibe could forge (the #2418 bait-and-switch).
  // It is absent when the CID wasn't uploaded through this host session, in
  // which case the modal shows "preview unavailable" but the consent gate and
  // the persisted CID are unaffected.
  //
  // Optional: if absent the write proceeds (server/test paths that have no UI);
  // the browser provider always wires it, so production gets the gate. See #1968.
  confirmAvatarUpdate?: (req: { cid: string; mimeType?: string; getURL?: string }) => Promise<boolean>;
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
  // Record the server-supplied storage URI for a CID this host just uploaded,
  // so a later avatar-confirm gate can preview the exact bytes without trusting
  // a sandbox-supplied URL (#2418).
  recordAssetGetURL(cid: string, getURL: string): void;
  // The recorded storage URI for a CID, or undefined if this host never
  // uploaded it. Callers treat undefined as "no preview", not as an error.
  getAssetGetURL(cid: string): string | undefined;
}
