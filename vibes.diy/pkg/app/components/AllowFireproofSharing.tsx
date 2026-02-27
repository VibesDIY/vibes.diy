import React, { useState } from "react";
import { createPortal } from "react-dom";
import type { SharingState, SharingResult, DbRef } from "../hooks/useShareableDB.js";

export type { DbRef, SharingResult, SharingState };

interface AllowFireproofSharingProps {
  state: SharingState;
  dbRef: DbRef | null;
  onResult: (result: SharingResult) => void;
  onDismiss: () => void;
  onLoginRedirect: () => void;
}

export function AllowFireproofSharing({ state, dbRef, onResult, onDismiss, onLoginRedirect }: AllowFireproofSharingProps) {
  const [allowAll, setAllowAll] = useState(false);

  if (state === "waiting" || state === "allowed" || state === "denied") {
    return null;
  }

  if (state === "notSignedIn") {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-dialog-title"
        tabIndex={-1}
        onClick={onDismiss}
        onKeyDown={(e) => {
          if (e.key === "Escape") onDismiss();
        }}
      >
        <div
          className="w-80 max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-dark-background-01"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="login-dialog-title" className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Login Required
          </h2>
          <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">
            You need to be logged in to share your Fireproof database.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => onResult({ status: "login-declined" })}
              className="px-4 py-2 text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onLoginRedirect}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Login
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // state === "ask"
  if (!dbRef) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sharing-dialog-title"
      tabIndex={-1}
      onClick={onDismiss}
      onKeyDown={(e) => {
        if (e.key === "Escape") onDismiss();
      }}
    >
      <div
        className="w-80 max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-dark-background-01"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sharing-dialog-title" className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
          Allow Database Sharing
        </h2>
        <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">Allow sharing this Fireproof database?</p>
        <div className="mb-5 rounded bg-gray-100 px-3 py-2 font-mono text-xs text-gray-700 dark:bg-dark-decorative-00 dark:text-gray-300">
          <div>
            <span className="text-gray-500">app:</span> {dbRef.appSlug}
          </div>
          <div>
            <span className="text-gray-500">user:</span> {dbRef.userSlug}
          </div>
          <div>
            <span className="text-gray-500">db:</span> {dbRef.dbName}
          </div>
        </div>
        <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={allowAll}
            onChange={(e) => setAllowAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 accent-green-600"
          />
          Allow all databases from this app
        </label>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onResult({ status: "declined", dbRef })}
            className="px-4 py-2 text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onResult({ status: "accepted", dbRef: allowAll ? { ...dbRef, dbName: "*" } : dbRef })}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            Allow
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
