import * as mod from "@vibes.diy/prompts";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";

// Mock global fetch for the integration tests
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeAll(() => {
  // noop — kept for test lifecycle symmetry
});

beforeEach(() => {
  mockFetch.mockClear();

  // Set up mock using real files from pkg directory
  mockFetch.mockImplementation(createMockFetchFromPkgFiles());
});

describe("makeBaseSystemPrompt dependency selection", () => {
  it("includes specified dependencies in the system prompt", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      dependencies: ["fireproof", "callai"],
    });
    // Should include the core libs
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).toMatch(/<callAI-docs>/);
    // Should include corresponding import lines
    expect(result.systemPrompt).toMatch(/import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/);
    expect(result.systemPrompt).toMatch(/import\s+\{\s*callAI\s*\}\s+from\s+"call-ai"/);
  });

  it("only includes explicitly listed dependencies", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      dependencies: ["fireproof"],
    });
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).not.toMatch(/<callAI-docs>/);
    // Import statements reflect chosen modules only
    expect(result.systemPrompt).toMatch(/import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/);
    expect(result.systemPrompt).not.toMatch(/from\s+"call-ai"/);
  });

  it("falls back to the default dependency set when dependencies are empty", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      dependencies: [],
    });
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).toMatch(/<callAI-docs>/);
    expect(result.systemPrompt).toMatch(/<Web Audio API-docs>/);
  });
});
