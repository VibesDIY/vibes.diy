import { describe, it, expect } from "vitest";
import { extractExportSource } from "../../vibe/runtime/access-extract.js";

describe("extractExportSource (runtime port)", () => {
  it("extracts a named export by db name", () => {
    const src = `export function notes(doc, oldDoc, user, ctx) { return { channels: ["n"] }; }`;
    const out = extractExportSource(src, "notes");
    expect(out).toBe(`function notes(doc, oldDoc, user, ctx) { return { channels: ["n"] }; }`);
  });

  it("extracts a default export for '*'", () => {
    const src = `export default function (doc) { return {}; }`;
    expect(extractExportSource(src, "*")).toBe(`function (doc) { return {}; }`);
  });

  it("returns undefined when the named export is absent", () => {
    const src = `export function other(doc) { return {}; }`;
    expect(extractExportSource(src, "notes")).toBeUndefined();
  });
});
