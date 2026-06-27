import * as mod from "@vibes.diy/prompts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Result } from "@adviser/cement";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";

// Create a fetchText mock that delegates to the mock fetch helper
const mockFetchImpl = createMockFetchFromPkgFiles();
function mockFetchText(_pkg: string, path: string): Promise<Result<string>> {
  console.log(`mockFetchText called with pkg: ${_pkg}, path: ${path}`);
  return mockFetchImpl(path).then(async (res) => {
    if (res.ok) return Result.Ok(await res.text());
    return Result.Err(new Error(`fetch failed for path: ${path}`));
  });
}

// Mock global fetch for the integration tests. stubGlobal (not a bare
// assignment) so unstubAllGlobals restores the real fetch after this file —
// under isolate:false a leaked fetch mock corrupts later files that fetch real
// fixtures (e.g. segmentParser.test.ts).
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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

afterAll(() => {
  vi.unstubAllGlobals();
});

const opts = {
  fetchText: mockFetchText,
};

describe("makeBaseSystemPrompt skill selection", () => {
  it("no skills provided: uses defaults (fireproof + callai + ...) ", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      ...opts,
      _id: "user_settings",
    });
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).toMatch(/<callAI-docs>/);
    expect(result.systemPrompt).toMatch(/import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/);
    expect(result.systemPrompt).toMatch(/import\s+\{\s*callAI\s*\}\s+from\s+"call-ai"/);
  });

  it("honors explicit skills", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      _id: "user_settings",
      skills: ["fireproof"],
      ...opts,
    });
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).not.toMatch(/<callAI-docs>/);
    expect(result.systemPrompt).toMatch(/import\s+\{\s*useFireproof\s*\}\s+from\s+"use-fireproof"/);
    expect(result.systemPrompt).not.toMatch(/from\s+"call-ai"/);
  });

  it("create-vibe is selectable and injects the use-vibes import", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      _id: "user_settings",
      skills: ["fireproof", "create-vibe"],
      ...opts,
    });
    expect(result.systemPrompt).toMatch(/<createVibe-docs>/);
    expect(result.systemPrompt).toMatch(/import\s+\{\s*createVibe\s*\}\s+from\s+"use-vibes"/);
    expect(result.skills).toContain("create-vibe");
  });

  it("create-vibe is NOT a default skill", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      ...opts,
      _id: "user_settings",
    });
    expect(result.systemPrompt).not.toMatch(/<createVibe-docs>/);
    expect(result.skills).not.toContain("create-vibe");
  });

  it("empty skills array falls back to defaults", async () => {
    const result = await mod.makeBaseSystemPrompt("anthropic/claude-sonnet-4.5", {
      _id: "user_settings",
      skills: [],
      ...opts,
    });
    expect(result.systemPrompt).toMatch(/<useFireproof-docs>/);
    expect(result.systemPrompt).toMatch(/<callAI-docs>/);
  });
});
