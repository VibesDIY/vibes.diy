// Slice 2 (#2802): transformVibeSource — Sucrase TSX→JS string.
//
// Pure transform, no module evaluation. Workers-safe (no wasm, no eval), so the
// same function runs in the Node executor and inside the Worker Loader isolate.

import { describe, it, expect } from "vitest";
import { transformVibeSource } from "../../../vibe/runtime/transform-vibe-source.js";

describe("transformVibeSource", () => {
  it("compiles JSX to the automatic react/jsx-runtime", () => {
    const { module } = transformVibeSource(`export default function App(){ return <main>hi</main>; }`);
    expect(module).toMatch(/react\/jsx-runtime/);
    expect(module).not.toContain("<main>"); // JSX lowered, not left verbatim
  });

  it("strips TypeScript type annotations (TSX)", () => {
    const src = [
      `interface Props { name: string }`,
      `const greet = (p: Props): string => p.name;`,
      `export default function App(){ const n: number = 2; return <span>{greet({ name: "x" })}{n}</span>; }`,
    ].join("\n");
    const { module } = transformVibeSource(src);
    expect(module).not.toContain("interface Props");
    expect(module).not.toContain(": string");
    expect(module).not.toContain(": number");
    expect(module).toContain("greet");
  });

  it("returns the compiled source as a string under `module`", () => {
    const out = transformVibeSource(`export default () => null;`);
    expect(typeof out.module).toBe("string");
    expect(out.module.length).toBeGreaterThan(0);
  });
});
