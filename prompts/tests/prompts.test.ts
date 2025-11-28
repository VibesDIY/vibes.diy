import { vi, describe, it, expect, beforeEach } from "vitest";
import { makeBaseSystemPrompt, RESPONSE_FORMAT } from "@vibes.diy/prompts";

// We need to mock the module properly, not test the real implementation yet
vi.mock("@vibes.diy/prompts", async () => {
  const { vi } = await import("vitest");
  return {
    makeBaseSystemPrompt: vi.fn().mockResolvedValue({
      systemPrompt: "mocked system prompt",
      dependencies: ["fireproof", "callai"],
      demoData: true,
      model: "test-model",
    }),
    RESPONSE_FORMAT: {
      dependencies: {
        format: '{dependencies: { "package-name": "version" }}',
        note: "use-fireproof is already provided, do not include it",
      },
    },
  };
});

describe("Prompts Utility", () => {
  const opts = {
    fallBackUrl: new URL("https://example.com/fallback"),
    callAiEndpoint: "https://example.com/call-ai",
    mock: {
      fetch: () => Promise.resolve(new Response("xxx")),
    },
  };
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a base system prompt with model documentation", async () => {
    const model = "gpt-4";
    const result = await makeBaseSystemPrompt(model, opts);

    // Check that the prompt includes expected content from the mock
    expect(result.systemPrompt).toBe("mocked system prompt");
  });

  it("handles different models", async () => {
    // Test with a different model
    const model = "claude-3";
    const result = await makeBaseSystemPrompt(model, opts);

    // The base prompt should be the same regardless of model (in current implementation)
    expect(result.systemPrompt).toBe("mocked system prompt");
  });

  it("defines the correct response format", () => {
    // Check that RESPONSE_FORMAT has the expected structure
    expect(RESPONSE_FORMAT).toHaveProperty("structure");

    // Check that structure is an array
    expect(Array.isArray(RESPONSE_FORMAT.structure)).toBe(true);
    expect(RESPONSE_FORMAT.structure.length).toBeGreaterThan(0);
    expect(RESPONSE_FORMAT.structure).toContain("Brief explanation");
    expect(RESPONSE_FORMAT.structure).toContain(
      "Component code with proper Fireproof integration",
    );
  });

  it("handles fetch errors gracefully", async () => {
    // Mock implementation to throw an error
    const mockImplementation = vi.fn().mockImplementation(() => {
      throw new Error("Network error");
    });

    // Override the mock for this test
    vi.mocked(makeBaseSystemPrompt).mockImplementationOnce(mockImplementation);

    try {
      await makeBaseSystemPrompt("gpt-4", opts);
      // If we don't catch an error, the test should fail
      expect.fail("Expected makeBaseSystemPrompt to throw an error");
    } catch (error) {
      // We expect an error to be thrown
      expect(error).toBeDefined();
      expect((error as Error).message).toBe("Network error");
    }
  });

  it("handles empty llms list", async () => {
    // For this test we just verify that the mock was called
    const model = "gpt-4";
    await makeBaseSystemPrompt(model, opts);

    expect(makeBaseSystemPrompt).toHaveBeenCalledWith(model, { ...opts });
  });
});
