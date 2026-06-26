import { describe, expect, it } from "vitest";
import { commitWriteFile } from "../svc/intern/codegen-loop/whole-file-loop.js";

describe("commitWriteFile", () => {
  it("does not retain contents when verify fails", () => {
    const files: Record<string, string> = {};
    const r = commitWriteFile(files, "App.jsx", "broken(", () => ({ ok: false, problems: ["unbalanced"] }));
    expect(r.ok).toBe(false);
    expect("App.jsx" in files).toBe(false);
  });
  it("retains contents when verify passes", () => {
    const files: Record<string, string> = {};
    const r = commitWriteFile(files, "App.jsx", "export default () => null", () => ({ ok: true, problems: [] }));
    expect(r.ok).toBe(true);
    expect(files["App.jsx"]).toContain("export default");
  });
});
