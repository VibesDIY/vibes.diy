import React, { useState } from "react";
import { Toaster, ToastBar, type Toast } from "react-hot-toast";
import { isCopyableToast, toastText, WARNING_ICON } from "./copyable-toast-logic.js";

// Re-export the pure helpers so existing importers (e.g. PreviewApp) keep their
// `../CopyableToaster.js` import path. The implementations live in the React-free
// copyable-toast-logic module so their unit tests can run in node.
export { isCopyableToast, toastText, WARNING_ICON };

function CopyButton({ toast: t }: { toast: Toast }) {
  const [copied, setCopied] = useState(false);
  const text = toastText(t);
  if (!text) return null;

  async function copy() {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission) — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy message to clipboard"
      title="Copy message to clipboard"
      className="ml-1 shrink-0 self-start rounded border border-current px-1.5 py-0.5 text-xs font-medium opacity-60 hover:opacity-100"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Drop-in replacement for <Toaster>. Renders the default toast (icon + message)
// and appends a "Copy" button to error and warning toasts so they can be grabbed
// for debug. Error toasts get a longer duration so there's time to click copy.
export function CopyableToaster() {
  return (
    <Toaster toastOptions={{ error: { duration: 10000 } }}>
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              {message}
              {isCopyableToast(t) && <CopyButton toast={t} />}
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}
