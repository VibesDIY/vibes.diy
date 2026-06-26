import { describe, expect, it } from "vitest";
import { buildWholeFileSessionDoc } from "./whole-file-session-doc.js";

describe("buildWholeFileSessionDoc", () => {
  it("threads theme/skills/title/enrichedPrompt from persisted active settings", () => {
    const doc = buildWholeFileSessionDoc("a todo app", {
      skills: ["fireproof"],
      title: "Tasks",
      theme: "aether",
      enrichedPrompt: "a polished todo app",
    });
    expect(doc).toEqual({
      userPrompt: "a todo app",
      theme: "aether",
      skills: ["fireproof"],
      title: "Tasks",
      enrichedPrompt: "a polished todo app",
    });
  });

  it("falls back to userPrompt-only when active settings are absent", () => {
    expect(buildWholeFileSessionDoc("a todo app", undefined)).toEqual({ userPrompt: "a todo app" });
  });

  it("collapses an empty settings object to userPrompt-only (loadActiveSettings returns {})", () => {
    expect(buildWholeFileSessionDoc("a todo app", {})).toEqual({ userPrompt: "a todo app" });
  });

  it("threads only the fields that are present", () => {
    expect(buildWholeFileSessionDoc("a todo app", { theme: "aether" })).toEqual({
      userPrompt: "a todo app",
      theme: "aether",
    });
  });
});
