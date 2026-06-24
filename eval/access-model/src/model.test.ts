import { describe, it, expect } from "vitest";
import { pickPreSelected, resolveDefaultModel, type CatalogModel } from "./model.js";
import type { AccessMatrix } from "./config.js";

// Canonical #2619 usage names: codegen default is opus-4.8 (#2609), runtime is opus-4.6-fast.
const catalog: readonly CatalogModel[] = [
  { id: "anthropic/claude-opus-4.8", preSelected: ["codegen"] },
  { id: "anthropic/claude-opus-4.6-fast", preSelected: ["runtime"] },
  { id: "prodia/flux", preSelected: ["img"] },
];

const baseMatrix: AccessMatrix = {
  cliCommand: "npx vibes-diy@latest",
  apiUrl: "https://x/api",
  runtimeHostBase: "https://vibes.diy",
  handle: "eval",
  model: "",
  judgeModel: "judge-model",
  reps: 8,
  concurrency: 32,
  scoreConcurrency: 8,
  screenshotTimeoutMs: 120000,
};

describe("pickPreSelected", () => {
  it("picks the catalog model flagged for the codegen capability", () => {
    expect(pickPreSelected(catalog, "codegen")).toBe("anthropic/claude-opus-4.8");
  });
  it("throws if no model declares the capability", () => {
    expect(() => pickPreSelected([{ id: "x", preSelected: ["runtime"] }], "codegen")).toThrow(/codegen/);
  });
});

describe("resolveDefaultModel", () => {
  it("uses an explicit matrix.model pin verbatim when set (no fetch)", async () => {
    const r = await resolveDefaultModel(
      { ...baseMatrix, model: "anthropic/claude-opus-4.7" },
      {
        fetchDefault: async () => "SHOULD_NOT_BE_CALLED",
      }
    );
    expect(r).toBe("anthropic/claude-opus-4.7");
  });
  it("falls back to the env's resolved default for the handle when matrix.model is empty", async () => {
    const r = await resolveDefaultModel(
      { ...baseMatrix, model: "" },
      {
        fetchDefault: async () => "anthropic/claude-opus-4.6-fast",
      }
    );
    expect(r).toBe("anthropic/claude-opus-4.6-fast");
  });
});
