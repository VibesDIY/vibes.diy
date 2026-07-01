import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from "vitest";
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
// stubGlobal (not a bare assignment) so unstubAllGlobals can restore the real
// fetch after this file — under isolate:false a leaked fetch mock would corrupt
// later files that fetch real fixtures (e.g. segmentParser.test.ts).
vi.stubGlobal("fetch", mockFetch);
const opts = { fetchText: mockFetchText };

beforeAll(() => {
  mockFetch.mockImplementation(mockFetchImpl);
});

beforeEach(() => {
  mockFetch.mockClear();
});

afterAll(() => {
  vi.unstubAllGlobals();
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

  it("omits the default style fallback when suppressDefaultStylePrompt is set", async () => {
    // No theme + no explicit stylePrompt would normally fall back to the default;
    // suppression yields an empty style section instead (used when a themed app's
    // theme is intentionally withheld on a follow-up).
    const result = await makeBaseSystemPrompt("test-model", {
      stylePrompt: undefined,
      suppressDefaultStylePrompt: true,
      ...opts,
    });

    expect(result.systemPrompt).not.toContain(defaultStylePrompt);
  });

  it("lets an explicit style prompt win over suppressDefaultStylePrompt", async () => {
    const stylePrompt = "synthwave (80s digital aesthetic)";
    const result = await makeBaseSystemPrompt("test-model", { stylePrompt, suppressDefaultStylePrompt: true, ...opts });

    expect(result.systemPrompt).toContain(stylePrompt);
    expect(result.systemPrompt).not.toContain(defaultStylePrompt);
  });
});
