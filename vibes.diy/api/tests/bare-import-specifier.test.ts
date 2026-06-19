import { describe, it, expect } from "vitest";
import { isBareImportSpecifier } from "../svc/intern/write-apps.js";

// Guards which import specifiers the deploy-time scanner feeds into the
// generated esm.sh import map. Only bare package names belong there; relative
// paths and already-absolute URLs must be excluded (regression for
// garden-gnome/canary-import-regression, where `https://esm.sh/canvas-confetti`
// was re-prefixed to `https://esm.sh/https:/esm.sh/canvas-confetti` → 400).
describe("isBareImportSpecifier", () => {
  it("accepts bare package names", () => {
    for (const spec of [
      "clsx",
      "ms",
      "three",
      "react-dom/client",
      "@scope/pkg",
      "@scope/pkg/sub",
      // Dotted names must stay captured — the `.`/scheme guards must not eat them.
      "chart.js",
      "chart.js/auto",
      // Version-pinned bare specifier (the `@` is not at the start).
      "react@18.2.0",
      // node: builtins are browser-polyfillable — esm.sh serves them at
      // https://esm.sh/node:buffer, so they stay bare (Codex review on #2471).
      "node:buffer",
      "node:fs",
    ]) {
      expect(isBareImportSpecifier(spec), spec).toBe(true);
    }
  });

  it("rejects relative paths", () => {
    for (const spec of ["./Badge.jsx", "../lib/x.js", "/root.js"]) {
      expect(isBareImportSpecifier(spec), spec).toBe(false);
    }
  });

  it("rejects protocol-relative and fully-qualified URLs", () => {
    for (const spec of [
      "//cdn.example.com/x.js",
      "https://esm.sh/canvas-confetti",
      "http://example.com/x.js",
      "https://unpkg.com/three",
      "blob:https://host/abc",
      "data:text/javascript,export default 1",
    ]) {
      expect(isBareImportSpecifier(spec), spec).toBe(false);
    }
  });
});
