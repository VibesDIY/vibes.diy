import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { usePortalRoot } from "../contexts/PortalRootContext.js";
import { Button } from "./ui/button.js";

interface DeleteVibeConfirmModalProps {
  /** Display title of the vibe being deleted, shown in the prompt. */
  title: string;
  /** True while the delete request is in flight — disables the buttons. */
  inFlight: boolean;
  /** Non-null when the delete request failed; shown so the user can retry. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Confirmation shown before deleting a vibe the caller owns from the sidebar
// (RecentVibes). "Delete" here soft-tombstones the vibe (setUnpublish), so no
// data is destroyed and it stays restorable — the copy says as much rather
// than implying a permanent wipe.
export function DeleteVibeConfirmModal({
  title,
  inFlight,
  error,
  onConfirm,
  onCancel,
}: DeleteVibeConfirmModalProps): React.ReactElement | null {
  const portalRoot = usePortalRoot();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  if (!portalRoot) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm delete vibe"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-[5px] border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_black] dark:bg-gray-900 dark:text-gray-100">
        <span className="text-sm font-bold uppercase tracking-wider">Delete this vibe?</span>
        <p className="-mt-2 text-center text-sm">
          <span className="font-semibold">{title}</span>
        </p>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          It will be unpublished and removed from your list. The data isn&apos;t deleted, so it can be restored later.
        </p>

        {error && (
          <p className="text-center text-xs text-red-600 dark:text-red-400" role="alert">
            Couldn&apos;t delete: {error}
          </p>
        )}

        <div className="flex w-full items-center justify-center gap-3">
          <Button variant="ghost" size="fixed" onClick={onCancel} disabled={inFlight}>
            Cancel
          </Button>
          <Button variant="danger" size="fixed" onClick={onConfirm} disabled={inFlight} autoFocus>
            {inFlight ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </div>,
    portalRoot
  );
}
