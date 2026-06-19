import { describe, it, expect } from "vitest";
import { transformImports } from "@vibes.diy/prompts";

describe("transformImports", () => {
  it("rewrites bare specifiers to esm.sh", () => {
    const out = transformImports(`import { clsx } from "clsx";`);
    expect(out).toContain(`from "https://esm.sh/clsx"`);
  });

  it("rewrites scoped bare specifiers to esm.sh", () => {
    const out = transformImports(`import x from "@scope/pkg";`);
    expect(out).toContain(`from "https://esm.sh/@scope/pkg"`);
  });

  it("rewrites dotted bare package names to esm.sh", () => {
    const out = transformImports(`import { Chart } from "chart.js/auto";`);
    expect(out).toContain(`from "https://esm.sh/chart.js/auto"`);
  });

  it("leaves node: builtin imports untouched", () => {
    const src = `import fs from "node:fs";`;
    expect(transformImports(src)).toBe(src);
  });

  it("leaves core import-map packages untouched", () => {
    const out = transformImports(`import React from "react";`);
    expect(out).toBe(`import React from "react";`);
  });

  it("leaves relative specifiers untouched", () => {
    const src = `import Badge from "./Badge.jsx";`;
    expect(transformImports(src)).toBe(src);
  });

  // Regression for garden-gnome/canary-import-regression: an already-absolute
  // esm.sh URL must NOT be re-prefixed onto esm.sh (would 400 as
  // https://esm.sh/https://esm.sh/canvas-confetti).
  it("leaves fully-qualified esm.sh URLs untouched", () => {
    const src = `import confetti from "https://esm.sh/canvas-confetti";`;
    const out = transformImports(src);
    expect(out).toBe(src);
    expect(out).not.toContain("esm.sh/https:");
  });

  it("leaves other absolute URL schemes untouched", () => {
    for (const src of [
      `import x from "http://example.com/x.js";`,
      `import x from "https://unpkg.com/three";`,
      `import x from "blob:https://host/abc";`,
      `import x from "data:text/javascript,export default 1";`,
    ]) {
      expect(transformImports(src)).toBe(src);
    }
  });
});
