import type { Toast } from "react-hot-toast";

// Pure, React-free toast helpers. Kept in their own module (importing `Toast` as
// a type only, so there's no `react-hot-toast` runtime import) so their unit
// tests can run in the node `pkg-infra` project instead of the isolate:false
// browser project, where a shared-worker module graph made a top-level import of
// the React component flake as "Failed to import test file".

// The warning icon used by `toast("…", { icon: WARNING_ICON })`. Warnings are
// plain (type "blank") toasts distinguished only by this icon, so we key off it
// to decide whether they get a Copy button alongside error toasts.
export const WARNING_ICON = "⚠️";

// Extract the plain-text payload of a toast so it can be copied to the clipboard.
// Error/warning toasts carry a string message; richer (ReactNode) messages have
// no copyable text and return "" (no button).
export function toastText(t: Toast): string {
  const m = t.message;
  if (typeof m === "string") return m;
  if (typeof m === "number") return String(m);
  return "";
}

// A toast is copyable when it's an error or a warning (icon = WARNING_ICON) and
// it has plain-text content to copy.
export function isCopyableToast(t: Toast): boolean {
  if (!toastText(t)) return false;
  return t.type === "error" || t.icon === WARNING_ICON;
}
