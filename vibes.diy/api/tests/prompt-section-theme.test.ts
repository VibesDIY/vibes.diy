import { describe, expect, it } from "vitest";
import { type } from "arktype";
import { PromptMsgs, PromptSectionTheme } from "../types/prompt.js";

describe("PromptSectionTheme", () => {
  const base = { streamId: "s1", chatId: "c1", seq: 0, timestamp: new Date().toISOString() };

  it("accepts a theme-only section-theme event", () => {
    const evt = { type: "prompt.section-theme", theme: "aether", ...base };
    expect(PromptSectionTheme(evt) instanceof type.errors).toBe(false);
    expect(PromptMsgs(evt) instanceof type.errors).toBe(false);
  });

  it("accepts an optional colorTheme", () => {
    const evt = { type: "prompt.section-theme", theme: "aether", colorTheme: "acid-pop", ...base };
    expect(PromptMsgs(evt) instanceof type.errors).toBe(false);
  });

  it("rejects a missing theme slug", () => {
    const evt = { type: "prompt.section-theme", ...base };
    expect(PromptMsgs(evt) instanceof type.errors).toBe(true);
  });
});
