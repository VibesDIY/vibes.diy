import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Segment } from "call-ai";

/**
 * Tests for callVibes generator behavior, specifically around final yield
 * after stream finalization.
 *
 * Key issue being tested: After finalize(), any new content should be yielded,
 * not just returned. for-await loops don't capture generator return values,
 * so if finalize() produces new content that's only returned, consumers won't see it.
 */

// Mock fetch to simulate SSE stream
function createMockSSEResponse(chunks: string[]): Response {
  let chunkIndex = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (chunkIndex < chunks.length) {
        controller.enqueue(new TextEncoder().encode(chunks[chunkIndex]));
        chunkIndex++;
      } else {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("callVibes final yield behavior", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should yield final state after finalize when content is flushed", async () => {
    // SSE stream where final content only appears after decoder flush
    // Simulates UTF-8 character split across chunks or buffered parser content
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Here is code:\\n```js\\nconst x = 1;"}}]}\n\n',
      // Stream ends - no closing ``` so finalize() will close the code block
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(sseChunks));

    const { callVibes } = await import("../../pkg/call-vibes.js");

    const results: Array<{ text: string; segments: Segment[] }> = [];

    // Collect all yielded results using for-await
    for await (const result of callVibes("test prompt", { apiKey: "test-key" })) {
      results.push({ text: result.text, segments: [...result.segments] });
    }

    // Should have at least one yielded result
    expect(results.length).toBeGreaterThan(0);

    // The last yielded result should include the finalized code block
    const lastYielded = results[results.length - 1];
    expect(lastYielded.segments.length).toBeGreaterThan(0);

    // Check that the code segment is present and properly closed
    const codeSegment = lastYielded.segments.find((s) => s.type === "code");
    expect(codeSegment).toBeDefined();
  });

  it("for-await should capture final state from generator return value", async () => {
    // SSE stream with incomplete code block
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"```js\\nfunction test() {\\n  return 42;\\n}"}}]}\n\n',
      // No closing fence - finalize should close it
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(createMockSSEResponse(sseChunks));

    const { callVibes } = await import("../../pkg/call-vibes.js");

    let lastResult: { text: string; segments: readonly Segment[] } | null = null;

    // Use for-await - the return value is NOT captured by for-await
    for await (const result of callVibes("test", { apiKey: "test-key" })) {
      lastResult = result;
    }

    // The issue: for-await doesn't see the return value, only yields
    // If finalize() produces new content that's only returned (not yielded),
    // consumers won't see it
    expect(lastResult).not.toBeNull();
    if (lastResult) {
      // After finalize, the code block should be closed
      const codeSegment = lastResult.segments.find((s) => s.type === "code");
      expect(codeSegment).toBeDefined();
    }
  });
});
