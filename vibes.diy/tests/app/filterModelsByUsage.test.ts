import { describe, expect, it } from "vitest";
import { filterModelsByUsage } from "~/vibes.diy/app/components/filterModelsByUsage.js";
import type { Model } from "@vibes.diy/api-types";

const CHAT_ONLY: Model = {
  id: "anthropic/claude-sonnet-4.6",
  name: "Sonnet 4.6",
  description: "chat",
  supports: ["chat", "app"],
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
  description: "supports chat and img",
  supports: ["chat", "img"],
};

describe("filterModelsByUsage", () => {
  it("returns only models that list the usage in supports", () => {
    const result = filterModelsByUsage([CHAT_ONLY, IMG_ONLY], "img");
    expect(result).toEqual([IMG_ONLY]);
  });

  it("includes a model in multiple usage dropdowns when supports has multiple entries", () => {
    const chat = filterModelsByUsage([MULTI], "chat");
    const img = filterModelsByUsage([MULTI], "img");
    const app = filterModelsByUsage([MULTI], "app");
    expect(chat).toEqual([MULTI]);
    expect(img).toEqual([MULTI]);
    expect(app).toEqual([]);
  });

  it("treats missing supports as ['chat','app'] — never image", () => {
    expect(filterModelsByUsage([UNTAGGED], "chat")).toEqual([UNTAGGED]);
    expect(filterModelsByUsage([UNTAGGED], "app")).toEqual([UNTAGGED]);
    expect(filterModelsByUsage([UNTAGGED], "img")).toEqual([]);
  });

  it("preserves input order", () => {
    const input = [IMG_ONLY, CHAT_ONLY, MULTI];
    const result = filterModelsByUsage(input, "chat");
    expect(result).toEqual([CHAT_ONLY, MULTI]);
  });
});
