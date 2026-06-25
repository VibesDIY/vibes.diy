import { describe, it, expect } from "vitest";
import { makeWriteFileExecutor } from "./agentic.js";

describe("makeWriteFileExecutor", () => {
  it("accumulates files and reports clean when build+structure pass", async () => {
    const files: Record<string, string> = {};
    const exec = makeWriteFileExecutor(files, () => false);
    const r = await exec({
      path: "App.jsx",
      contents: `import React from "react";\nexport default function App(){ return <div/>; }`,
    });
    expect(files["App.jsx"]).toContain("export default");
    expect(r.ok).toBe(true);
    expect(r.feedback).toMatch(/pass/i);
  });
  it("reports not-clean with the build error and lets a later write fix it", async () => {
    const files: Record<string, string> = {};
    const exec = makeWriteFileExecutor(files, () => false);
    const bad = await exec({ path: "App.jsx", contents: `export default function App(){ return <div ;` });
    expect(bad.ok).toBe(false);
    const good = await exec({
      path: "App.jsx",
      contents: `import React from "react";\nexport default function App(){ return <div/>; }`,
    });
    expect(good.ok).toBe(true);
  });
  it("requires access.js when needsAccess is true", async () => {
    const files: Record<string, string> = {};
    const exec = makeWriteFileExecutor(files, () => true);
    const r = await exec({
      path: "App.jsx",
      contents: `import React from "react";\nexport default function App(){ return <div/>; }`,
    });
    expect(r.ok).toBe(false);
    expect(r.feedback).toMatch(/access\.js/);
  });
});
