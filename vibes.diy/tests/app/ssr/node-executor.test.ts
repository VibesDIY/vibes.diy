// Slice 2 (#2802): NodeExecutor — transform → evaluate → renderVibeToString.
//
// Runs in node env (no `window`), proving the executor → slice-1 renderer round
// trip works in the worker/container server context. The compiled vibe module
// is loaded via a data: URL dynamic import with bare specifiers resolved to the
// runtime package's own node_modules (single React instance shared with
// react-dom/server), so real React hooks work.

import { describe, it, expect } from "vitest";
import { NodeExecutor } from "../../../vibe/runtime/node-executor.js";

describe("NodeExecutor", () => {
  it("globalThis.window is undefined in this test (node env)", () => {
    expect(typeof globalThis.window).toBe("undefined");
  });

  it("transforms and server-renders a TSX component to HTML", async () => {
    const exec = new NodeExecutor();
    const { html } = await exec.render({
      source: `export default function App(){ return <main className="x">hello-ssr {1 + 1}</main>; }`,
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("hello-ssr");
    expect(html).toContain("2");
    expect(html).toContain('class="x"');
  });

  it("strips TypeScript types and renders (TSX path)", async () => {
    const exec = new NodeExecutor();
    const { html } = await exec.render({
      source: [
        `const label = (n: number): string => "n=" + n;`,
        `export default function App(){ const x: number = 41; return <b>{label(x + 1)}</b>; }`,
      ].join("\n"),
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("n=42");
  });

  it("resolves bare React imports so hooks work (single React instance)", async () => {
    const exec = new NodeExecutor();
    const { html } = await exec.render({
      source: `import { useState } from "react";
        export default function App(){ const [n] = useState(7); return <i>{"count-" + n}</i>; }`,
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("count-7");
  });

  it("forwards mountParams into the validating slice-1 renderer", async () => {
    const exec = new NodeExecutor();
    await expect(
      exec.render({
        source: `export default () => null;`,
        mountParams: { nope: true }, // missing required `usrEnv`
      })
    ).rejects.toThrow(/mount params/i);
  });
});
