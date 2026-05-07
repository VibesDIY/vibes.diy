import { describe, it, expect } from "vitest";
import { getRecoveryAddendum, getRecoveryStitchAddendum, makeBaseSystemPrompt } from "@vibes.diy/prompts";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";
import systemPromptTemplate from "../pkg/system-prompt.md?raw";
import systemPromptInitialTemplate from "../pkg/system-prompt-initial.md?raw";

const PLACEHOLDERS = [
  "{{STYLE_PROMPT}}",
  "{{DEMO_DATA}}",
  "{{CONCATENATED_LLMS}}",
  "{{TITLE_SECTION}}",
  "{{USER_PROMPT}}",
  "{{IMPORT_STATEMENTS}}",
];

describe("system prompt templates", () => {
  it("both templates contain every placeholder", () => {
    for (const p of PLACEHOLDERS) {
      expect(systemPromptTemplate).toContain(p);
      expect(systemPromptInitialTemplate).toContain(p);
    }
  });

  it("initial template has scaffold + tiny-edits markers", () => {
    // First-turn variant: one full-file scaffold (no SEARCH/REPLACE) then
    // a long stream of small SEARCH/REPLACE edits with prose between.
    expect(systemPromptInitialTemplate).toMatch(/scaffold/i);
    expect(systemPromptInitialTemplate).toMatch(/tiny edits/i);
    expect(systemPromptInitialTemplate).toMatch(/SEARCH\/REPLACE/);
    expect(systemPromptInitialTemplate).toMatch(/first turn/i);
    // Color-only-after-scaffold rule (zero color tokens in the create block).
    expect(systemPromptInitialTemplate).toMatch(/ZERO color tokens/i);
  });

  it("continuation template lacks first-turn-only markers", () => {
    expect(systemPromptTemplate).not.toMatch(/first turn/i);
    expect(systemPromptTemplate).not.toMatch(/tiny edits/i);
  });

  it("both templates carry the small-chunk guidance", () => {
    // Both modes recommend small SEARCH/REPLACE pairs (continuation always,
    // initial after the scaffold). The "≤25 line" / "under ~25 lines"
    // wording shows up in both.
    expect(systemPromptTemplate).toMatch(/25 lines/);
    expect(systemPromptInitialTemplate).toMatch(/25 lines/);
  });
});

describe("makeBaseSystemPrompt variant routing", () => {
  const mockFetch = createMockFetchFromPkgFiles();
  const baseOpts = {
    skills: ["fireproof", "callai"],
    fetch: mockFetch as unknown as typeof fetch,
    pkgBaseUrl: "https://example.test/@vibes.diy/prompts/",
  };

  it("variant=initial → output contains first-turn scaffold + tiny-edits markers", async () => {
    const result = await makeBaseSystemPrompt("test-model", { ...baseOpts, variant: "initial" });
    expect(result.systemPrompt).toMatch(/first turn/i);
    expect(result.systemPrompt).toMatch(/tiny edits/i);
    expect(result.systemPrompt).toMatch(/ZERO color tokens/i);
  });

  it("variant=continuation → does not", async () => {
    const result = await makeBaseSystemPrompt("test-model", { ...baseOpts, variant: "continuation" });
    expect(result.systemPrompt).not.toMatch(/first turn/i);
    expect(result.systemPrompt).not.toMatch(/tiny edits/i);
  });

  it("no variant → defaults to continuation", async () => {
    const result = await makeBaseSystemPrompt("test-model", baseOpts);
    expect(result.systemPrompt).not.toMatch(/first turn/i);
    expect(result.systemPrompt).not.toMatch(/tiny edits/i);
  });
});

describe("recovery addenda", () => {
  const mockFetch = createMockFetchFromPkgFiles();
  const fetchFn = mockFetch as unknown as typeof fetch;
  const pkgBaseUrl = "https://example.test/@vibes.diy/prompts/";

  it("getRecoveryAddendum returns continue-mode text", async () => {
    const text = await getRecoveryAddendum(pkgBaseUrl, fetchFn);
    expect(text.toLowerCase()).toContain("current files");
    expect(text.toLowerCase()).not.toContain("leave nothing out");
  });

  it("getRecoveryStitchAddendum returns stitch-mode text", async () => {
    const text = await getRecoveryStitchAddendum(pkgBaseUrl, fetchFn);
    expect(text.toLowerCase()).toContain("leave nothing out");
    expect(text.toLowerCase()).toContain("one single code block");
  });
});
