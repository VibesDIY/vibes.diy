// Regression guard for #2823 (Codex P1): the vibe iframe loads
// @vibes.diy/vibe-runtime natively via the generated import map
// (api/svc/intern/grouped-vibe-import-map.ts), which maps `react-dom` and
// `react-dom/client` but NOT `react-dom/server`. So no file reachable from the
// client entry (index.ts → mount-vibes.ts → vibe-tree.ts) may statically import
// `react-dom/server`, or native module resolution fails before hydration.
//
// `renderVibeToString` (render-vibes.ts) is the only file allowed to import it,
// and it must stay off the root entry — server callers deep-import it.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const runtimeFile = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../vibe/runtime/${name}`, import.meta.url)), "utf8");

describe("vibe-runtime client entry stays free of react-dom/server", () => {
  // Files reachable when a vibe page imports `mountVibe` and is loaded natively.
  for (const name of ["index.ts", "mount-vibes.ts", "vibe-tree.ts"]) {
    it(`${name} does not import react-dom/server`, () => {
      expect(runtimeFile(name)).not.toMatch(/["']react-dom\/server["']/);
    });
  }

  it("index.ts does not re-export the server renderer (render-vibes)", () => {
    expect(runtimeFile("index.ts")).not.toMatch(/from\s+["']\.\/render-vibes\.js["']/);
  });

  it("render-vibes.ts is the file that owns the server import", () => {
    expect(runtimeFile("render-vibes.ts")).toMatch(/["']react-dom\/server["']/);
  });

  // Slice 2 (#2802): the SSR executors reach `react-dom/server` (NodeExecutor
  // deep-imports render-vibes.js; the Worker Loader code embeds it as a string),
  // so they must also stay off the client root. Server callers deep-import them.
  it("index.ts does not re-export the SSR executor modules", () => {
    const index = runtimeFile("index.ts");
    expect(index).not.toMatch(/from\s+["']\.\/node-executor\.js["']/);
    expect(index).not.toMatch(/from\s+["']\.\/worker-loader-executor\.js["']/);
  });

  // Slice B1 (#2856): the backend executor seam is server-only too (it shapes
  // Worker Loader code + drives the beta binding), so it must stay off the client
  // root. Server callers deep-import it.
  it("index.ts does not re-export the backend executor modules", () => {
    const index = runtimeFile("index.ts");
    expect(index).not.toMatch(/from\s+["']\.\/backend-executor\.js["']/);
    expect(index).not.toMatch(/from\s+["']\.\/backend-worker-loader-executor\.js["']/);
  });

  it("node-executor.ts deep-imports the slice-1 renderer (not the package root)", () => {
    const node = runtimeFile("node-executor.ts");
    expect(node).toMatch(/from\s+["']\.\/render-vibes\.js["']/);
  });
});
