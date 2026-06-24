import { describe, it, expect } from "vitest";
import { pickPreSelected, resolveDefaultModel } from "./model.js";

const catalog = [
  { id: "anthropic/claude-opus-4.6-fast", preSelected: ["app"] },
  { id: "anthropic/claude-sonnet-4.6", preSelected: ["chat"] },
  { id: "prodia/flux", preSelected: ["img"] },
];

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
    const r = await resolveDefaultModel({ apiUrl: "https://x/api", handle: "eval", model: "anthropic/claude-opus-4.7" } as any, {
      fetchDefault: async () => "SHOULD_NOT_BE_CALLED",
    });
    expect(r).toBe("anthropic/claude-opus-4.7");
  });
  it("falls back to the env's resolved default for the handle when matrix.model is empty", async () => {
    const r = await resolveDefaultModel({ apiUrl: "https://x/api", handle: "eval", model: "" } as any, {
      fetchDefault: async () => "anthropic/claude-opus-4.6-fast",
    });
    expect(r).toBe("anthropic/claude-opus-4.6-fast");
  });
});
