import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { avatarConfirmController, type PendingAvatarConfirm } from "../lib/avatar-confirm.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";
import { Button } from "./ui/button.js";

// Platform-host preview/confirm modal shown before any avatar write (#1968).
//
// Mounted once in the provider tree. It subscribes to `avatarConfirmController`
// and appears whenever something (a sandboxed vibe via the srv-sandbox bridge,
// or the Settings upload flow) requests confirmation. The user sees the
// proposed image cropped to the circular avatar shape and must click
// "Set as avatar" to approve; dismissing — button, backdrop, or Escape —
// cancels the write.
//
// SECURITY: the preview is derived from the request's `cid` via the
// content-addressed asset endpoint — the same CID the host persists on
// confirm. A sandbox cannot supply a preview URL of its own, so it can't show
// one image while a different one gets saved (bait-and-switch on consent).
export function AvatarConfirmModal(): React.ReactElement | null {
  const [pending, setPending] = useState<PendingAvatarConfirm | undefined>(() => avatarConfirmController.current);
  const [brokenPreview, setBrokenPreview] = useState(false);

  useEffect(() => {
    return avatarConfirmController.onChange((next) => {
      setBrokenPreview(false);
      setPending(next);
    }) as () => void;
  }, []);

  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") pending.resolve(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pending]);

  if (!pending) return null;

  // Always the asset addressed by the CID we'll persist — never a value the
  // sandbox controls. mimeType only labels the Content-Type; the bytes are
  // fixed by the CID.
  const previewUrl = cidAssetUrl(pending.cid, pending.mimeType ?? "application/octet-stream", getAppHostBaseUrl());
  const hasPreview = !brokenPreview;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) pending.resolve(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm avatar"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-[5px] border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_black] dark:bg-gray-900 dark:text-gray-100">
        <span className="text-sm font-bold uppercase tracking-wider">Set this as your avatar?</span>

        <div
          className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-black dark:border-gray-600"
          style={{ background: "var(--vibes-bg-secondary, #f3f4f6)" }}
        >
          {hasPreview ? (
            <img
              src={previewUrl}
              alt="Proposed avatar"
              className="h-full w-full object-cover"
              onError={() => setBrokenPreview(true)}
            />
          ) : (
            <span className="px-2 text-center text-xs text-gray-500 dark:text-gray-400">Preview unavailable</span>
          )}
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          This updates the avatar shown across your profile and the apps you visit.
        </p>

        <div className="flex w-full items-center justify-center gap-3">
          <Button variant="ghost" size="fixed" onClick={() => pending.resolve(false)}>
            Cancel
          </Button>
          <Button variant="blue" size="fixed" onClick={() => pending.resolve(true)} autoFocus>
            Set as avatar
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
