import { callAi, CallAIOptions } from "call-ai";
import { describe, expect, it, beforeEach, vi, Mock } from "vitest";

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn<(key: string) => string | null>(),
  setItem: vi.fn<(key: string, value: string) => void>(),
  removeItem: vi.fn<(key: string) => void>(),
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

// Mock global fetch
const globalFetch = vi.fn<typeof fetch>();
globalThis.fetch = globalFetch as typeof fetch;

// Mock ReadableStream
const mockReader = {
  read: vi.fn<() => Promise<{ done: boolean; value?: Uint8Array }>>(),
};

const mockResponse = {
  json: vi.fn<() => Promise<unknown>>(),
  body: {
    getReader: vi.fn().mockReturnValue(mockReader),
  },
  ok: true,
  status: 200,
  statusText: "OK",
  headers: new Headers(),
} as unknown as Response & { json: Mock<() => Promise<unknown>> };

describe("callAi Vibes Auth Enhancement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalFetch.mockResolvedValue(mockResponse);
    mockResponse.json.mockResolvedValue({
      choices: [{ message: { content: "Mock response" } }],
    });
  });

  it("should add X-VIBES-Token header when auth token is available", async () => {
    // Setup localStorage to return a token
    mockLocalStorage.getItem.mockReturnValue("test-vibes-token");

    await callAi("Hello", { apiKey: "test-key" });

    // Check that fetch was called with the enhanced headers
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("test-vibes-token");
  });

  it("should not add X-VIBES-Token header when no auth token is available", async () => {
    // Setup localStorage to return null
    mockLocalStorage.getItem.mockReturnValue(null);

    await callAi("Hello", { apiKey: "test-key" });

    // Check that fetch was called without the Vibes token
    const fetchCall = globalFetch.mock.calls[0];
    const requestOptions = fetchCall?.[1] as RequestInit;
    const headers = new Headers(requestOptions?.headers);
    expect(headers.has("X-VIBES-Token")).toBe(false);
  });

  it("should preserve existing X-VIBES-Token header if provided by caller", async () => {
    // Setup localStorage to return a token
    mockLocalStorage.getItem.mockReturnValue("storage-token");

    const options: CallAIOptions = {
      apiKey: "test-key",
      headers: {
        "X-VIBES-Token": "caller-provided-token",
      },
    };

    await callAi("Hello", options);

    // Check that the caller's token is preserved, not the storage token
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("caller-provided-token");
  });

  it("should preserve existing headers when adding auth token", async () => {
    // Setup localStorage to return a token
    mockLocalStorage.getItem.mockReturnValue("test-vibes-token");

    const options: CallAIOptions = {
      apiKey: "test-key",
      headers: {
        "Custom-Header": "custom-value",
        "Another-Header": "another-value",
      },
    };

    await callAi("Hello", options);

    // Check that both custom headers and auth token are present
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("Custom-Header")).toBe("custom-value");
    expect(headers.get("Another-Header")).toBe("another-value");
    expect(headers.get("X-VIBES-Token")).toBe("test-vibes-token");
  });

  it("should work when localStorage access throws an error", async () => {
    // Setup localStorage to throw an error
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error("localStorage not available");
    });

    // Should not throw an error and should work without the token
    await expect(callAi("Hello", { apiKey: "test-key" })).resolves.toBeDefined();

    // Check that fetch was called without the Vibes token
    const fetchCall = globalFetch.mock.calls[0];
    const requestOptions = fetchCall?.[1] as RequestInit;
    const headers = new Headers(requestOptions?.headers);
    expect(headers.has("X-VIBES-Token")).toBe(false);
  });

  it("should work in non-browser environments without localStorage", async () => {
    // Temporarily remove localStorage
    const originalLocalStorage = globalThis.localStorage;
    delete (globalThis as { localStorage?: typeof localStorage }).localStorage;

    // Should not throw an error and should work without the token
    await expect(callAi("Hello", { apiKey: "test-key" })).resolves.toBeDefined();

    // Check that fetch was called without the Vibes token
    const fetchCall = globalFetch.mock.calls[0];
    const requestOptions = fetchCall?.[1] as RequestInit;
    const headers = new Headers(requestOptions?.headers);
    expect(headers.has("X-VIBES-Token")).toBe(false);

    // Restore localStorage
    globalThis.localStorage = originalLocalStorage;
  });

  it("should handle empty string token correctly", async () => {
    // Setup localStorage to return empty string
    mockLocalStorage.getItem.mockReturnValue("");

    await callAi("Hello", { apiKey: "test-key" });

    // Check that fetch was called without the Vibes token (empty string is falsy)
    const fetchCall = globalFetch.mock.calls[0];
    const requestOptions = fetchCall?.[1] as RequestInit;
    const headers = new Headers(requestOptions?.headers);
    expect(headers.has("X-VIBES-Token")).toBe(false);
  });

  it("should work with streaming requests", async () => {
    // Setup localStorage to return a token
    mockLocalStorage.getItem.mockReturnValue("test-vibes-token");

    // Mock streaming response
    const streamingResponse = {
      ...mockResponse,
      body: {
        getReader: vi.fn().mockReturnValue({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'),
            })
            .mockResolvedValueOnce({
              done: true,
            }),
        }),
      },
    };
    globalFetch.mockResolvedValue(streamingResponse as unknown as Response);

    const stream = await callAi("Hello", { apiKey: "test-key", stream: true });

    // Consume the stream to trigger the fetch
    const generator = stream as AsyncGenerator<string>;
    const result = await generator.next();
    expect(result.value).toBeDefined();

    // Check that fetch was called with the enhanced headers
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("test-vibes-token");
  });

  it("should enhance options in bufferStreamingResults path", async () => {
    // Setup localStorage to return a token
    mockLocalStorage.getItem.mockReturnValue("test-vibes-token");

    // Use a model that forces streaming (Claude with schema)
    // Ensure the streaming reader completes cleanly
    mockReader.read.mockResolvedValueOnce({ done: true });
    await callAi("Hello", {
      apiKey: "test-key",
      model: "anthropic/claude-3.5-sonnet",
      schema: { type: "object", properties: {} },
      stream: false, // This will be forced to streaming by the strategy
    });

    // Check that fetch was called with the enhanced headers
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("test-vibes-token");
  });
});
