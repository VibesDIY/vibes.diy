import { describe, expect, it } from "vitest";
import type { Model } from "@vibes.diy/api-types";
import { modelSupportsImageInput } from "../svc/intern/model-vision.js";
import models from "../svc/models.json" with { type: "json" };

const catalog = models as Model[];

describe("modelSupportsImageInput", () => {
  it("returns true only when the catalog entry is tagged imageInput", () => {
    const list: Model[] = [
      { id: "vision/one", name: "v1", description: "", imageInput: true },
      { id: "text/one", name: "t1", description: "", imageInput: false },
      { id: "text/two", name: "t2", description: "" },
    ];
    expect(modelSupportsImageInput(list, "vision/one")).toBe(true);
    expect(modelSupportsImageInput(list, "text/one")).toBe(false);
    expect(modelSupportsImageInput(list, "text/two")).toBe(false);
  });

  it("default-denies models absent from the catalog", () => {
    expect(modelSupportsImageInput(catalog, "some/unknown-model")).toBe(false);
    expect(modelSupportsImageInput([], "anything")).toBe(false);
  });

  it("real catalog tags known vision families", () => {
    for (const id of [
      "anthropic/claude-opus-4.5",
      "anthropic/claude-sonnet-4.6",
      "google/gemini-3.1-pro-preview",
      "openai/gpt-5",
      "x-ai/grok-4-fast",
    ]) {
      expect(modelSupportsImageInput(catalog, id), id).toBe(true);
    }
  });

  it("real catalog leaves text-only models untagged", () => {
    for (const id of [
      "deepseek/deepseek-chat-v3.1",
      "qwen/qwen3-coder",
      "mistralai/mistral-nemo",
      "moonshotai/kimi-k2-0905",
      "openai/gpt-oss-120b",
      "openai/gpt-5-codex",
      "x-ai/grok-code-fast-1",
    ]) {
      expect(modelSupportsImageInput(catalog, id), id).toBe(false);
    }
  });
});
