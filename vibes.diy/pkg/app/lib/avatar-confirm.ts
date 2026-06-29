// Host-side controller for the avatar preview/confirm modal (#1968).
//
// The srv-sandbox bridge handler (`vibeUpdateAvatarCid`) and the Settings
// avatar flow both call `request()` BEFORE persisting an avatar. It returns a
// promise that resolves `true` only when the user clicks "Set as avatar" and
// `false` when they dismiss. A single `AvatarConfirmModal` (mounted once in the
// provider tree) subscribes via `onChange` and drives the UI.
//
// Why a module-level singleton rather than React state threaded through props:
// the srv-sandbox is a module-level Lazy built once, and its `confirmAvatarUpdate`
// thunk is captured at construction. A stable singleton lets that thunk reach
// the live modal without re-wiring on every provider render — mirroring the
// module-level coordination in lib/asset-session.ts.

import { OnFunc } from "@adviser/cement";

export interface AvatarConfirmRequest {
  // The content CID that will be persisted as the avatar on confirm.
  readonly cid: string;
  // Optional content-type hint for the preview's Content-Type — it can't
  // change which bytes are shown.
  readonly mimeType?: string;
  // Trusted storage URI for the asset, supplied by the host (the put-asset
  // response for the sandbox path, the upload response for Settings) — never by
  // a sandboxed vibe. The modal previews this exact URI, so a vibe can't show
  // one image while a different CID is saved (#2418). Absent when the host has
  // no recorded URI for `cid`, in which case the modal shows no preview.
  readonly getURL?: string;
  // The handle the avatar will be saved to. Shown on the consent card ("for
  // handle @xyz") so the user knows which identity they're changing — avatars
  // are per-handle (#2434) and the active handle is switchable. Absent → the
  // line is omitted.
  readonly handle?: string;
}

export interface PendingAvatarConfirm extends AvatarConfirmRequest {
  // Settle the in-flight request and clear the modal. Idempotent — a second
  // call (e.g. backdrop click after the confirm button) is a no-op.
  resolve(confirmed: boolean): void;
}

class AvatarConfirmController {
  private pending: PendingAvatarConfirm | undefined;

  // Fires with the new pending request (or `undefined` when cleared) so the
  // modal can re-render. Subscribing returns an unsubscribe function.
  readonly onChange = OnFunc<(pending: PendingAvatarConfirm | undefined) => void>();

  get current(): PendingAvatarConfirm | undefined {
    return this.pending;
  }

  // Open the modal for `req` and resolve once the user decides. If a previous
  // request is still open it's auto-cancelled (resolved `false`) so only one
  // modal is ever live — a second upload supersedes the first.
  request(req: AvatarConfirmRequest): Promise<boolean> {
    this.pending?.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const pending: PendingAvatarConfirm = {
        cid: req.cid,
        ...(req.mimeType ? { mimeType: req.mimeType } : {}),
        ...(req.getURL ? { getURL: req.getURL } : {}),
        ...(req.handle ? { handle: req.handle } : {}),
        resolve: (confirmed: boolean) => {
          if (settled) return;
          settled = true;
          // Only clear if this is still the active request — a superseding
          // request has already swapped `this.pending` and notified.
          if (this.pending === pending) {
            this.pending = undefined;
            this.onChange.invoke(undefined);
          }
          resolve(confirmed);
        },
      };
      this.pending = pending;
      this.onChange.invoke(pending);
    });
  }
}

export const avatarConfirmController = new AvatarConfirmController();
