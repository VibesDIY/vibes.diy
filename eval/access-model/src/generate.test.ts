import { describe, it, expect } from "vitest";
import { buildAccessGenerateArgs } from "./generate.js";

describe("buildAccessGenerateArgs", () => {
  it("pins the resolved default model and passes handle/apiUrl/app-slug/prompt", () => {
    expect(
      buildAccessGenerateArgs({
        model: "anthropic/claude-opus-4.8",
        handle: "eval",
        apiUrl: "https://x/api",
        appSlug: "eval-am-todo-r0-abc123",
        prompt: "A todo list app",
      })
    ).toEqual([
      "generate",
      "--model",
      "anthropic/claude-opus-4.8",
      "--handle",
      "eval",
      "--api-url",
      "https://x/api",
      "--app-slug",
      "eval-am-todo-r0-abc123",
      "A todo list app",
    ]);
  });
});
