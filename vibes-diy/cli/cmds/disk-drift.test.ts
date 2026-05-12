import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { collectDiskDraft } from "./disk-drift.js";

describe("collectDiskDraft", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "vibes-disk-drift-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("returns draft when .undo absent and source files exist", async () => {
    await fs.writeFile(path.join(dir, "App.jsx"), "function App(){}");
    const r = await collectDiskDraft(dir);
    expect(r).toBeDefined();
    if (r === undefined) throw new Error("unreachable — assertion above failed");
    expect(r.files.map((f) => f.filename)).toContain("App.jsx");
  });

  it("returns undefined when .undo present and contents match disk", async () => {
    await fs.writeFile(path.join(dir, "App.jsx"), "function App(){}");
    await fs.writeFile(path.join(dir, ".undo"), JSON.stringify([{ filename: "App.jsx", content: "function App(){}" }]));
    expect(await collectDiskDraft(dir)).toBeUndefined();
  });

  it("returns draft when .undo present but disk differs", async () => {
    await fs.writeFile(path.join(dir, "App.jsx"), "function App(){ return 1; }");
    await fs.writeFile(path.join(dir, ".undo"), JSON.stringify([{ filename: "App.jsx", content: "function App(){}" }]));
    const r = await collectDiskDraft(dir);
    expect(r).not.toBeUndefined();
  });

  it("returns undefined when dir is empty", async () => {
    expect(await collectDiskDraft(dir)).toBeUndefined();
  });
});
