import { describe, expect, it } from "vitest";
import { modelSupportsImageInput } from "../svc/intern/model-vision.js";

describe("modelSupportsImageInput", () => {
  it("accepts known vision-capable families", () => {
    for (const id of [
      "anthropic/claude-opus-4.5",
      "anthropic/claude-sonnet-4-6",
      "anthropic/claude-opus-4.7",
      "google/gemini-3.1-pro-preview",
      "google/gemini-2.5-flash",
      "google/gemma-3-12b-it",
      "openai/gpt-4o-mini",
      "openai/gpt-4.1",
      "openai/gpt-5",
      "openai/gpt-5.4",
      "x-ai/grok-4-fast",
      "x-ai/grok-4.20",
    ]) {
      expect(modelSupportsImageInput(id), id).toBe(true);
    }
  });

  it("denies text-only models and text-only variants of vision families", () => {
    for (const id of [
      "deepseek/deepseek-chat-v3.1",
      "deepseek/deepseek-v3.2",
      "qwen/qwen3-coder",
      "mistralai/mistral-nemo",
      "z-ai/glm-4.6",
      "moonshotai/kimi-k2-0905",
      "openai/gpt-oss-120b",
      "openai/gpt-5-codex",
      "openai/gpt-5.3-codex",
      "x-ai/grok-code-fast-1",
    ]) {
      expect(modelSupportsImageInput(id), id).toBe(false);
    }
  });

  it("denies unknown models (default-deny)", () => {
    expect(modelSupportsImageInput("some/brand-new-model")).toBe(false);
    expect(modelSupportsImageInput("")).toBe(false);
  });
});
