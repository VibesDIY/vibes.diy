import { describe, it, expect } from "vitest";
import { pickPreSelected, resolveDefaultModel, type CatalogModel } from "./model.js";
import type { AccessMatrix } from "./config.js";

const catalog: readonly CatalogModel[] = [
  { id: "anthropic/claude-opus-4.6-fast", preSelected: ["app"] },
  { id: "anthropic/claude-sonnet-4.6", preSelected: ["chat"] },
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
  it("picks the catalog model flagged for the app (codegen) capability", () => {
    expect(pickPreSelected(catalog, "app")).toBe("anthropic/claude-opus-4.6-fast");
  });
  it("throws if no model declares the capability", () => {
    expect(() => pickPreSelected([{ id: "x", preSelected: ["chat"] }], "app")).toThrow(/app/);
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
