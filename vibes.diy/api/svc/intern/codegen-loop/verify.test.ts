import { describe, it, expect } from "vitest";
import { verifyFiles } from "./verify.js";

describe("verifyFiles", () => {
  it("passes a well-formed App.jsx", () => {
    const files = { "App.jsx": "export default function App(){ return <div>hi</div>; }" };
    expect(verifyFiles(files, { needsAccess: false })).toEqual({ ok: true, problems: [] });
  });
  it("flags a missing default export", () => {
    const files = { "App.jsx": "function App(){ return <div/>; }" };
    const r = verifyFiles(files, { needsAccess: false });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/default export/i);
  });
  it("flags missing access.js when access is required", () => {
    const files = { "App.jsx": "export default function App(){ return <div/>; }" };
    const r = verifyFiles(files, { needsAccess: true });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/access\.js/i);
  });
  it("flags unbalanced braces as a syntax heuristic", () => {
    const files = { "App.jsx": "export default function App(){ return <div/>; " };
    const r = verifyFiles(files, { needsAccess: false });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/unbalanced|syntax/i);
  });
});
