import React, { useState } from "react";
import { Toaster, ToastBar, type Toast } from "react-hot-toast";

// Extract the plain-text payload of a toast so it can be copied to the clipboard.
// Error toasts are created with `toast.error("...")`, so the message is a string;
// richer (ReactNode) messages have no copyable text and return "" (no button).
export function toastText(t: Toast): string {
  const m = t.message;
  if (typeof m === "string") return m;
  if (typeof m === "number") return String(m);
  return "";
}

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
      aria-label="Copy error message to clipboard"
      title="Copy error to clipboard"
      className="ml-1 shrink-0 self-start rounded border border-current px-1.5 py-0.5 text-xs font-medium opacity-60 hover:opacity-100"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Drop-in replacement for <Toaster>. Renders the default toast (icon + message)
// and appends a "Copy" button to error toasts so errors can be grabbed for debug.
// Error toasts get a longer duration so there's time to click copy.
export function CopyableToaster() {
  return (
    <Toaster toastOptions={{ error: { duration: 10000 } }}>
      {(t) => (
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              {icon}
              {message}
              {t.type === "error" && <CopyButton toast={t} />}
            </>
          )}
        </ToastBar>
      )}
    </Toaster>
  );
}
