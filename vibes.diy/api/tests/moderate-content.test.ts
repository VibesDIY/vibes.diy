import { describe, expect, it } from "vitest";
import { moderateContent } from "@vibes.diy/api-svc/intern/moderate-content.js";

function createMockFetch(content: string) {
  return async (): Promise<Response> => {
    const encoder = new TextEncoder();

    // Full OpenRouter SSE format matching SseChunk schema
    const chunk = {
      id: "gen-123",
      provider: "openai",
      model: "openai/gpt-4o-mini",
      object: "chat.completion.chunk",
      created: 1234567890,
      choices: [
        {
          index: 0,
          delta: { content },
          finish_reason: null,
          native_finish_reason: null,
          logprobs: null,
        },
      ],
    };

    const doneChunk = {
      id: "gen-123",
      provider: "openai",
      model: "openai/gpt-4o-mini",
      object: "chat.completion.chunk",
      created: 1234567890,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: "stop",
          native_finish_reason: "stop",
          logprobs: null,
        },
      ],
    };

    const chunks = [`data: ${JSON.stringify(chunk)}`, `data: ${JSON.stringify(doneChunk)}`, `data: [DONE]`];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) {
          controller.enqueue(encoder.encode(c + "\n\n"));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };
}

describe("moderateContent", () => {
  it("returns safe for appropriate content", async () => {
    const mockFetch = createMockFetch('{"safe": true, "reason": ""}');

    const result = await moderateContent(
      "test-api-key",
      { userSlug: "john-doe", name: "John Doe" },
      mockFetch
    );

    expect(result.isOk()).toBe(true);
    expect(result.Ok().safe).toBe(true);
  });

  it("returns unsafe for inappropriate content", async () => {
    const mockFetch = createMockFetch('{"safe": false, "reason": "Contains offensive language"}');

    const result = await moderateContent(
      "test-api-key",
      { userSlug: "bad-word-here", name: "Offensive Name" },
      mockFetch
    );

    expect(result.isOk()).toBe(true);
    expect(result.Ok().safe).toBe(false);
    expect(result.Ok().reason).toBe("Contains offensive language");
  });

  it("handles API errors", async () => {
    const mockFetch = async (): Promise<Response> => {
      return new Response("Internal Server Error", { status: 500 });
    };

    const result = await moderateContent("test-api-key", { userSlug: "test" }, mockFetch);

    expect(result.isErr()).toBe(true);
    expect(result.Err().message).toContain("500");
  });

  it("handles invalid JSON response", async () => {
    const mockFetch = createMockFetch("This is not JSON");

    const result = await moderateContent("test-api-key", { userSlug: "test" }, mockFetch);

    expect(result.isErr()).toBe(true);
    expect(result.Err().message).toContain("invalid JSON");
  });

  it("handles network errors", async () => {
    const mockFetch = async (): Promise<Response> => {
      throw new Error("Network failure");
    };

    const result = await moderateContent("test-api-key", { userSlug: "test" }, mockFetch);

    expect(result.isErr()).toBe(true);
    expect(result.Err().message).toContain("Network failure");
  });

  it("extracts JSON from markdown-wrapped response", async () => {
    const mockFetch = createMockFetch('```json\n{"safe": true, "reason": ""}\n```');

    const result = await moderateContent("test-api-key", { userSlug: "test" }, mockFetch);

    expect(result.isOk()).toBe(true);
    expect(result.Ok().safe).toBe(true);
  });
});
