import { describe, it, expect } from "vitest";
import { makeBaseSystemPrompt } from "@vibes.diy/prompts";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";
import systemPromptAgenticTemplate from "../pkg/system-prompt-agentic.md?raw";

describe("makeBaseSystemPrompt agentic variant", () => {
  const mockFetch = createMockFetchFromPkgFiles();
  const baseOpts = {
    skills: ["fireproof", "callai"],
    fetch: mockFetch as unknown as typeof fetch,
    pkgBaseUrl: "https://example.test/@vibes.diy/prompts/",
  };

  it("loads the whole-file template and resolves placeholders", async () => {
    const result = await makeBaseSystemPrompt("test-model", { ...baseOpts, variant: "agentic-whole-file" });
    expect(result.systemPrompt).toMatch(/write_file/);
    // All {{PLACEHOLDER}} tokens (all-caps identifiers) should be substituted.
    expect(result.systemPrompt).not.toMatch(/\{\{[A-Z_]+\}\}/); // all placeholders resolved
  });

  it("agentic template contains write_file instruction", () => {
    expect(systemPromptAgenticTemplate).toMatch(/write_file/);
  });

  it("agentic template does not contain SEARCH/REPLACE edit markers", () => {
    expect(systemPromptAgenticTemplate).not.toMatch(/<<<<<<< SEARCH/);
    expect(systemPromptAgenticTemplate).not.toMatch(/>>>>>>> REPLACE/);
  });

  it("agentic template keeps all required placeholders", () => {
    const PLACEHOLDERS = ["{{STYLE_PROMPT}}", "{{DEMO_DATA}}", "{{CONCATENATED_LLMS}}", "{{TITLE_SECTION}}", "{{USER_PROMPT}}"];
    for (const p of PLACEHOLDERS) {
      expect(systemPromptAgenticTemplate).toContain(p);
    }
  });

  it("variant=agentic-whole-file does not use initial-only colored-shell markers", async () => {
    const result = await makeBaseSystemPrompt("test-model", { ...baseOpts, variant: "agentic-whole-file" });
    // Agentic template is whole-file writes, not the colored-shell/incremental-edits flow.
    expect(result.systemPrompt).not.toMatch(/final-ish/);
    expect(result.systemPrompt).not.toMatch(/first turn/i);
  });
});
