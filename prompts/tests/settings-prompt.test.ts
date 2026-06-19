import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { makeBaseSystemPrompt, defaultStylePrompt } from "@vibes.diy/prompts";
import { Result } from "@adviser/cement";
import { createMockFetchFromPkgFiles } from "./helpers/load-mock-data.js";

// Test the REAL makeBaseSystemPrompt (no module mock) so this file is safe under
// isolate:false — a per-file vi.mock("@vibes.diy/prompts") bleeds across files
// in a shared worker. Asset loading is fed by the same pkg-files fetch helper
// prompt-builder.test.ts uses; this file focuses on how settings-doc values
// (stylePrompt / userPrompt) flow into the generated prompt.
const mockFetchImpl = createMockFetchFromPkgFiles();
function mockFetchText(_pkg: string, path: string): Promise<Result<string>> {
  return mockFetchImpl(path).then(async (res) => {
    if (res.ok) return Result.Ok(await res.text());
    return Result.Err(new Error(`fetch failed for path: ${path}`));
  });
}
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;
const opts = { fetchText: mockFetchText };

beforeAll(() => {
  mockFetch.mockImplementation(mockFetchImpl);
});

beforeEach(() => {
  mockFetch.mockClear();
});

describe("Settings and Prompt Integration", () => {
  it("uses the default style prompt when no settings provided", async () => {
    const result = await makeBaseSystemPrompt("test-model", { stylePrompt: undefined, userPrompt: undefined, ...opts });

    expect(result.systemPrompt).toContain(defaultStylePrompt);
  });

  it("uses the style prompt from the settings document when provided", async () => {
    const stylePrompt = "synthwave (80s digital aesthetic)";
    const result = await makeBaseSystemPrompt("test-model", { stylePrompt, ...opts });

    expect(result.systemPrompt).toContain(stylePrompt);
    expect(result.systemPrompt).not.toContain(defaultStylePrompt);
  });

  it("includes the user prompt from the settings document when provided", async () => {
    const userPrompt = "Always include a dark mode toggle in your components";
    const result = await makeBaseSystemPrompt("test-model", { userPrompt, ...opts });

    expect(result.systemPrompt).toContain(userPrompt);
  });

  it("combines both style and user prompts when both are provided", async () => {
    const stylePrompt = "brutalist web (raw, grid-heavy)";
    const userPrompt = "Include accessibility features in all components";
    const result = await makeBaseSystemPrompt("test-model", { stylePrompt, userPrompt, ...opts });

    expect(result.systemPrompt).toContain(stylePrompt);
    expect(result.systemPrompt).toContain(userPrompt);
    expect(result.systemPrompt).not.toContain(defaultStylePrompt);
  });
});
