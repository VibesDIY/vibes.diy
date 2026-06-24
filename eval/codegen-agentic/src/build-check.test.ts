import { describe, it, expect } from "vitest";
import { buildCheck } from "./build-check.js";

describe("buildCheck", () => {
  it("passes valid JSX with a default export", async () => {
    const files = { "App.jsx": `import React from "react";\nexport default function App(){ return <div>hi</div>; }` };
    const r = await buildCheck(files);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("fails on a syntax error and reports it", async () => {
    const files = { "App.jsx": `export default function App(){ return <div>;` };
    const r = await buildCheck(files);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/App\.jsx/);
  });
  it("fails when App.jsx has no default export", async () => {
    const files = { "App.jsx": `import React from "react";\nfunction App(){ return null; }` };
    const r = await buildCheck(files);
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toMatch(/default export/i);
  });
  it("fails when App.jsx is absent", async () => {
    expect((await buildCheck({})).ok).toBe(false);
  });
});
