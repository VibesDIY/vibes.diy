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

  it("does not rewrite import-looking text inside a rendered string literal", async () => {
    const exec = new NodeExecutor();
    // The body string contains `import … from "react"`; the bare-specifier
    // rewrite must leave it verbatim and only touch the real top import.
    const { html } = await exec.render({
      source: `import { useState } from "react";
        export default function App(){ useState(0); return <code>{'import x from "react"'}</code>; }`,
      mountParams: { usrEnv: {} },
    });
    // React HTML-escapes the inner quotes, but the literal text must survive and
    // must NOT have been turned into a resolved file:// URL.
    expect(html).toContain("import x from");
    expect(html).not.toContain("file://");
  });

  it("leaves import-like text inside comments unchanged", async () => {
    const exec = new NodeExecutor();
    // A comment that mentions an import must not be rewritten into a file:// URL.
    const { html } = await exec.render({
      source: `// import x from "react"
        /* import y from "react-dom" */
        import { useState } from "react";
        export default function App(){ useState(0); return <p>comment-ok</p>; }`,
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("comment-ok");
    expect(html).not.toContain("file://");
  });

  it("does not rewrite dynamic import() specifiers (left to fail loud by design)", async () => {
    const exec = new NodeExecutor();
    // The real top import (react) renders fine; the dynamic import lives in an
    // unreached branch, so it never executes — but the point is the rewrite must
    // not touch its specifier (treating it like a static import would corrupt it).
    const { html } = await exec.render({
      source: `import { useState } from "react";
        export default function App(){
          const [n] = useState(3);
          const load = () => import("some-lazy-dep");
          return <u>{"dyn-" + (typeof load) + "-" + n}</u>;
        }`,
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("dyn-function-3");
    expect(html).not.toContain("file://");
  });

  it("resolves an import that follows a `use client` directive", async () => {
    const exec = new NodeExecutor();
    // Sucrase does not hoist imports; a leading-run scanner would stop at the
    // directive and leave `react` bare → "Cannot find package 'react'".
    const { html } = await exec.render({
      source: `"use client";
        import { useState } from "react";
        export default function App(){ const [n] = useState(5); return <s>{"dir-" + n}</s>; }`,
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("dir-5");
  });

  it("resolves an import with a comment between the keyword and clause", async () => {
    const exec = new NodeExecutor();
    const { html } = await exec.render({
      source: `import /* note */ { useState } from "react";
        export default function App(){ const [n] = useState(6); return <s>{"cmt-" + n}</s>; }`,
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("cmt-6");
  });

  it("resolves an import that follows another top-level statement", async () => {
    const exec = new NodeExecutor();
    // `const` before the import — again, Sucrase keeps the order.
    const { html } = await exec.render({
      source: `const TAG = "pre";
        import { useState } from "react";
        export default function App(){ const [n] = useState(8); return <s>{TAG + "-" + n}</s>; }`,
      mountParams: { usrEnv: {} },
    });
    expect(html).toContain("pre-8");
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
