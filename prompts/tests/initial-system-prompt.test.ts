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

  it("initial template has three-pass markers", () => {
    expect(systemPromptInitialTemplate).toMatch(/three passes/i);
    expect(systemPromptInitialTemplate).toContain("Pass 1");
    expect(systemPromptInitialTemplate).toContain("Pass 2");
    expect(systemPromptInitialTemplate).toContain("Pass 3");
    expect(systemPromptInitialTemplate).toMatch(/exactly three.*code blocks/i);
  });

  it("continuation template lacks three-pass markers", () => {
    expect(systemPromptTemplate).not.toMatch(/exactly three.*code blocks/i);
    expect(systemPromptTemplate).not.toMatch(/Pass 1 — UI scaffold/);
  });

  it("continuation has 25-line chunk guidance; initial does not", () => {
    expect(systemPromptTemplate).toMatch(/25 lines/);
    // Initial may explicitly override; ensure the small-chunk guidance is not active there.
    if (systemPromptInitialTemplate.includes("25 lines")) {
      expect(systemPromptInitialTemplate).toMatch(/Override|does NOT apply|override/);
    }
  });
});

describe("makeBaseSystemPrompt variant routing", () => {
  const mockFetch = createMockFetchFromPkgFiles();
  const baseOpts = {
    skills: ["fireproof", "callai"],
    fetch: mockFetch as unknown as typeof fetch,
    pkgBaseUrl: "https://example.test/@vibes.diy/prompts/",
  };

  it("variant=initial → output contains three-pass markers", async () => {
    const result = await makeBaseSystemPrompt("test-model", { ...baseOpts, variant: "initial" });
    expect(result.systemPrompt).toContain("Pass 1");
    expect(result.systemPrompt).toMatch(/exactly three.*code blocks/i);
  });

  it("variant=continuation → does not", async () => {
    const result = await makeBaseSystemPrompt("test-model", { ...baseOpts, variant: "continuation" });
    expect(result.systemPrompt).not.toMatch(/exactly three.*code blocks/i);
  });

  it("no variant → defaults to continuation", async () => {
    const result = await makeBaseSystemPrompt("test-model", baseOpts);
    expect(result.systemPrompt).not.toMatch(/exactly three.*code blocks/i);
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
