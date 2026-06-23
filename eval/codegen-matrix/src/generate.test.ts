import { describe, it, expect } from "vitest";
import { promptHash, buildGenerateArgs } from "./generate.js";

describe("promptHash", () => {
  it("is stable and hex", () => {
    expect(promptHash("build a todo")).toMatch(/^[0-9a-f]{64}$/);
    expect(promptHash("build a todo")).toBe(promptHash("build a todo"));
  });
});

describe("buildGenerateArgs", () => {
  it("assembles generate flags", () => {
    const args = buildGenerateArgs({
      model: "anthropic/claude-sonnet-4.6",
      handle: "eval",
      apiUrl: "https://vibes.diy/api",
      prompt: "build a todo",
    });
    expect(args).toEqual([
      "generate",
      "--model",
      "anthropic/claude-sonnet-4.6",
      "--handle",
      "eval",
      "--api-url",
      "https://vibes.diy/api",
      "build a todo",
    ]);
  });
});
