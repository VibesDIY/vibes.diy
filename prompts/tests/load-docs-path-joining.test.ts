import { describe, it, expect, beforeEach, vi } from "vitest";
// import { loadDocs } from "../pkg/load-docs.js";

// Mock global fetch for testing
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe("loadDocs simple fetch", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it("should construct URL correctly and fetch content", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("mock content"),
    });

    const localPath = "callai.json";
    const baseUrl = "https://esm.sh/@vibes.diy/prompts/llms";

    const result = await loadDocs(localPath, baseUrl);

    expect(mockFetch).toHaveBeenCalledWith("https://esm.sh/@vibes.diy/prompts/llms/callai.json");
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBe("mock content");
  });

  it("should handle fetch errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const localPath = "nonexistent.json";
    const baseUrl = "https://esm.sh/@vibes.diy/prompts/llms";

    const result = await loadDocs(localPath, baseUrl);

    expect(result.isErr()).toBe(true);
    const error = result.Err();
    const errorMessage = error.message;
    expect(errorMessage).toContain("Failed to fetch");
    expect(errorMessage).toContain("404 Not Found");
  });

  it("should handle network errors", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const localPath = "test.json";
    const baseUrl = "https://esm.sh/@vibes.diy/prompts/llms";

    const result = await loadDocs(localPath, baseUrl);

    expect(result.isErr()).toBe(true);
    const error = result.Err();
    const errorMessage = error.message;
    expect(errorMessage).toContain("Error fetching");
    expect(errorMessage).toContain("Network error");
  });

  it("should handle different base URLs", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("different content"),
    });

    const localPath = "test.json";
    const baseUrl = "https://example.com/custom";

    const result = await loadDocs(localPath, baseUrl);

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/custom/test.json");
    expect(result.isOk()).toBe(true);
    expect(result.Ok()).toBe("different content");
  });
});
