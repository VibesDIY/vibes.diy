import { describe, it, expect } from "vitest";
import type { Toast } from "react-hot-toast";
import { isCopyableToast, toastText, WARNING_ICON } from "~/vibes.diy/app/components/CopyableToaster.js";

// Minimal Toast factory — only the fields isCopyableToast/toastText read.
function makeToast(overrides: Partial<Toast>): Toast {
  return { type: "blank", message: "", ...overrides } as Toast;
}

describe("toastText", () => {
  it("returns string messages verbatim", () => {
    expect(toastText(makeToast({ message: "boom" }))).toBe("boom");
  });
  it("stringifies numeric messages", () => {
    expect(toastText(makeToast({ message: 42 as unknown as string }))).toBe("42");
  });
  it("returns empty string for ReactNode messages", () => {
    expect(toastText(makeToast({ message: { foo: "bar" } as unknown as string }))).toBe("");
  });
});

describe("isCopyableToast", () => {
  it("is true for error toasts with text", () => {
    expect(isCopyableToast(makeToast({ type: "error", message: "failed" }))).toBe(true);
  });
  it("is true for warning toasts (WARNING_ICON) with text", () => {
    expect(isCopyableToast(makeToast({ icon: WARNING_ICON, message: "preview may be stale" }))).toBe(true);
  });
  it("is false for success toasts", () => {
    expect(isCopyableToast(makeToast({ type: "success", message: "saved" }))).toBe(false);
  });
  it("is false for plain blank toasts without the warning icon", () => {
    expect(isCopyableToast(makeToast({ type: "blank", message: "heads up" }))).toBe(false);
  });
  it("is false when there is no copyable text, even for errors", () => {
    expect(isCopyableToast(makeToast({ type: "error", message: undefined as unknown as string }))).toBe(false);
  });
});
