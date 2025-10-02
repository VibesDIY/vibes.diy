import * as mod from "@vibes.diy/prompts";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";

// Mock global fetch for the integration tests
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Ensure real implementation
// (vi as any).doUnmock?.("~/vibes.diy/app/prompts");
//vi.unmock("~/vibes.diy/app/prompts.js");
// vi.resetModules();

// let makeBaseSystemPrompt: typeof mod.makeBaseSystemPrompt;
// let preloadLlmsText: () => Promise<void>;

beforeAll(async () => {
  // const mod = await import("~/vibes.diy/app/prompts.js");
  // makeBaseSystemPrompt = mod.makeBaseSystemPrompt;
  // preloadLlmsText = mod.preloadLlmsText;
});

beforeEach(() => {
  mockFetch.mockClear();

  // Set up mock using real files from pkg directory
  mockFetch.mockImplementation(createMockFetchFromPkgFiles());
});

const opts = {
  fallBackUrl: new URL("https://example.com/fallback"),
  callAiEndpoint: "https://example.com/call-ai",
  mock: {
    callAI: vi.fn().mockResolvedValue(
      JSON.stringify({
        choices: [{ message: { content: "Mocked response" } }],
      }),
    ),
  },
};

describe("makeBaseSystemPrompt dependency selection", () => {
  it("when override is false/absent, uses schema-driven selection (test mode => all); includes core libs", async () => {
    // await preloadLlmsText();
    const result = await mod.makeBaseSystemPrompt(
      "anthropic/claude-sonnet-4.5",
      {
        ...opts,
        _id: "user_settings",
      },
    );
    // Should include at least the core libs
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).toMatch(/<callAI-docs>/);
    // Should include corresponding import lines
    expect(result.systemPrompt).toMatch(
      /import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/,
    );
    expect(result.systemPrompt).toMatch(
      /import\s+\{\s*callAI\s*\}\s+from\s+"call-ai"/,
    );
  });

  it("honors explicit dependencies only when override=true", async () => {
    // await preloadLlmsText();
    const result = await mod.makeBaseSystemPrompt(
      "anthropic/claude-sonnet-4.5",
      {
        _id: "user_settings",
        dependencies: ["fireproof"],
        dependenciesUserOverride: true,
        ...opts,
      },
    );
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).not.toMatch(/<callAI-docs>/);
    // Import statements reflect chosen modules only
    expect(result.systemPrompt).toMatch(
      /import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/,
    );
    expect(result.systemPrompt).not.toMatch(/from\s+"call-ai"/);
  });

  it("ignores explicit dependencies when override=false (still schema-driven)", async () => {
    // await preloadLlmsText();
    const result = await mod.makeBaseSystemPrompt(
      "anthropic/claude-sonnet-4.5",
      {
        _id: "user_settings",
        dependencies: ["fireproof"],
        dependenciesUserOverride: false,
        ...opts,
      },
    );
    // Should include at least both core libs
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).toMatch(/<callAI-docs>/);
  });
});
