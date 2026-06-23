import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectSourceFiles, toDataUrl } from "./score.js";

describe("collectSourceFiles", () => {
  it("reads code files but skips README and non-source", () => {
    const dir = mkdtempSync(join(tmpdir(), "cm-src-"));
    writeFileSync(join(dir, "App.jsx"), "export default function App(){}");
    writeFileSync(join(dir, "access.js"), "export function access(){}");
    writeFileSync(join(dir, "README.md"), "# readme");
    const files = collectSourceFiles(dir);
    expect(Object.keys(files).sort()).toEqual(["App.jsx", "access.js"]);
  });
});

describe("toDataUrl", () => {
  it("builds a base64 data url", () => {
    expect(toDataUrl(new Uint8Array([1, 2, 3]), "image/jpeg")).toBe("data:image/jpeg;base64,AQID");
  });
});
