import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { modelSlug, cellDirName, screenshotUrl, discoverAppSlug, writeCellJson, readCellJson, type CellJson } from "./cell.js";

describe("modelSlug", () => {
  it("flattens provider/model ids to a filesystem-safe slug", () => {
    expect(modelSlug("anthropic/claude-opus-4.6-fast")).toBe("anthropic-claude-opus-4-6-fast");
  });
});

describe("cellDirName", () => {
  it("joins promptId, model slug, and rep", () => {
    expect(cellDirName("collab-lists", "google/gemini-2.5-flash-lite", 2)).toBe("collab-lists__google-gemini-2-5-flash-lite__r2");
  });
});

describe("screenshotUrl", () => {
  it("builds the runtime screenshot host from an explicit hostname base (prod)", () => {
    expect(screenshotUrl("vibes.diy", "my-app", "eval")).toBe("https://my-app--eval.vibes.diy/screenshot.jpg");
  });
  it("works for a preview host base", () => {
    expect(screenshotUrl("pr-42.vibespreview.dev", "my-app", "eval")).toBe(
      "https://my-app--eval.pr-42.vibespreview.dev/screenshot.jpg"
    );
  });
});

describe("discoverAppSlug", () => {
  it("returns the sole subdirectory name", () => {
    expect(discoverAppSlug(["happy-otter-1234"])).toBe("happy-otter-1234");
  });
  it("returns undefined when there is no single subdir", () => {
    expect(discoverAppSlug([])).toBeUndefined();
    expect(discoverAppSlug(["a", "b"])).toBeUndefined();
  });
});

describe("cell.json round-trip", () => {
  it("writes and reads back a cell", () => {
    const dir = mkdtempSync(join(tmpdir(), "cm-cell-"));
    const cell: CellJson = {
      promptId: "collab-lists",
      model: "anthropic/claude-sonnet-4.6",
      class: "anthropic",
      tier: "cheap",
      rep: 0,
      appSlug: "happy-otter-1234",
      ownerHandle: "eval",
      directory: "/some/dir",
      latencyMs: 4200,
      exitState: "ok",
      stderrTail: "",
      apiUrl: "https://vibes.diy/api",
      runtimeHostBase: "vibes.diy",
      cliVersion: "1.2.3",
      promptHash: "abc123",
    };
    writeCellJson(dir, cell);
    expect(readCellJson(dir)?.appSlug).toBe("happy-otter-1234");
  });
});
