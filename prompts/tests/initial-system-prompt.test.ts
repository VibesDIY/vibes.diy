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
  const CSS_IMPORT_GUIDANCE_SNIPPETS = [
    "raw ES modules",
    "local `.css` file imports are unsupported",
    "Tailwind utility classes",
    "`classNames` object",
    "inline `style={{ ... }}` or a `<style>` tag",
  ];

  it("both templates contain every placeholder", () => {
    for (const p of PLACEHOLDERS) {
      expect(systemPromptTemplate).toContain(p);
      expect(systemPromptInitialTemplate).toContain(p);
    }
  });

  it("both templates include CSS import mitigation guidance and alternatives", () => {
    for (const template of [systemPromptTemplate, systemPromptInitialTemplate]) {
      for (const snippet of CSS_IMPORT_GUIDANCE_SNIPPETS) {
        expect(template).toContain(snippet);
      }
    }
  });

  it("initial template has colored-shell + wire-each-feature markers", () => {
    // First-turn variant: one full-file colored shell (no SEARCH/REPLACE)
    // then access.js, then SEARCH/REPLACE feature edits with prose between.
    expect(systemPromptInitialTemplate).toMatch(/(?:colored shell|scaffold)/i);
    expect(systemPromptInitialTemplate).toMatch(/feature edits/i);
    expect(systemPromptInitialTemplate).toMatch(/wire each feature/i);
    expect(systemPromptInitialTemplate).toMatch(/SEARCH\/REPLACE/);
    expect(systemPromptInitialTemplate).toMatch(/first turn/i);
    // Real-colors-in-shell rule (colors land in the create block, not later).
    expect(systemPromptInitialTemplate).toMatch(/real Tailwind colors[\s\S]*final-ish/i);
  });

  it("continuation template lacks first-turn-only markers", () => {
    // `feature edits` / `wire each feature` appear in both templates, so the
    // discriminators are the genuinely initial-only phrases.
    expect(systemPromptTemplate).not.toMatch(/first turn/i);
    expect(systemPromptTemplate).not.toMatch(/final-ish/i);
  });

  it("continuation template carries the small-chunk guidance", () => {
    // Continuation mode keeps feature edits small — one prose line (≤25 words)
    // before each SEARCH/REPLACE pair.
    expect(systemPromptTemplate).toMatch(/25 words/);
  });
});

describe("makeBaseSystemPrompt variant routing", () => {
  const mockFetch = createMockFetchFromPkgFiles();
  const baseOpts = {
    skills: ["fireproof", "callai"],
    fetch: mockFetch as unknown as typeof fetch,
    pkgBaseUrl: "https://example.test/@vibes.diy/prompts/",
  };

  it("variant=initial → output contains first-turn colored-shell + wire-each-feature markers", async () => {
    const result = await makeBaseSystemPrompt("test-model", { ...baseOpts, variant: "initial" });
    expect(result.systemPrompt).toMatch(/first turn/i);
    expect(result.systemPrompt).toMatch(/feature edits/i);
    expect(result.systemPrompt).toMatch(/wire each feature/i);
    expect(result.systemPrompt).toMatch(/real Tailwind colors[\s\S]*final-ish/i);
  });

  it("variant=continuation → does not", async () => {
    const result = await makeBaseSystemPrompt("test-model", { ...baseOpts, variant: "continuation" });
    expect(result.systemPrompt).not.toMatch(/first turn/i);
    expect(result.systemPrompt).not.toMatch(/final-ish/i);
  });

  it("no variant → defaults to continuation", async () => {
    const result = await makeBaseSystemPrompt("test-model", baseOpts);
    expect(result.systemPrompt).not.toMatch(/first turn/i);
    expect(result.systemPrompt).not.toMatch(/final-ish/i);
  });

  it("image-gen skill picks up the ImgGen docs (not legacy ImgVibes)", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      ...baseOpts,
      skills: ["fireproof", "callai", "image-gen"],
    });
    expect(result.systemPrompt).toMatch(/ImgGen/);
    expect(result.systemPrompt).not.toMatch(/ImgVibes/);
  });

  it("use-viewer skill picks up the useViewer docs", async () => {
    const result = await makeBaseSystemPrompt("test-model", {
      ...baseOpts,
      skills: ["fireproof", "callai", "use-viewer"],
    });
    expect(result.systemPrompt).toMatch(/useViewer/);
    expect(result.systemPrompt).toMatch(/avatarUrl/);
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
