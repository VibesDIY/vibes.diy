import { describe, expect, it } from "vitest";
import { filterModelsByUsage } from "~/vibes.diy/app/components/filterModelsByUsage.js";
import type { Model } from "@vibes.diy/api-types";

const CODEGEN_ONLY: Model = {
  id: "anthropic/claude-sonnet-4.6",
  name: "Sonnet 4.6",
  description: "codegen",
  supports: ["codegen", "runtime"],
};

const IMG_ONLY: Model = {
  id: "openai/gpt-5.4-image-2",
  name: "GPT-5.4 Image 2",
  description: "image generator",
  supports: ["img"],
};

const UNTAGGED: Model = {
  id: "legacy/untagged",
  name: "Legacy",
  description: "no supports field",
};

const MULTI: Model = {
  id: "multi/model",
  name: "Multi",
  description: "supports codegen and img",
  supports: ["codegen", "img"],
};

describe("filterModelsByUsage", () => {
  it("returns only models that list the usage in supports", () => {
    const result = filterModelsByUsage([CODEGEN_ONLY, IMG_ONLY], "img");
    expect(result).toEqual([IMG_ONLY]);
  });

  it("includes a model in multiple usage dropdowns when supports has multiple entries", () => {
    const codegen = filterModelsByUsage([MULTI], "codegen");
    const img = filterModelsByUsage([MULTI], "img");
    const runtime = filterModelsByUsage([MULTI], "runtime");
    expect(codegen).toEqual([MULTI]);
    expect(img).toEqual([MULTI]);
    expect(runtime).toEqual([]);
  });

  it("treats missing supports as ['codegen','runtime'] — never image", () => {
    expect(filterModelsByUsage([UNTAGGED], "codegen")).toEqual([UNTAGGED]);
    expect(filterModelsByUsage([UNTAGGED], "runtime")).toEqual([UNTAGGED]);
    expect(filterModelsByUsage([UNTAGGED], "img")).toEqual([]);
  });

  it("preserves input order", () => {
    const input = [IMG_ONLY, CODEGEN_ONLY, MULTI];
    const result = filterModelsByUsage(input, "codegen");
    expect(result).toEqual([CODEGEN_ONLY, MULTI]);
  });
});
