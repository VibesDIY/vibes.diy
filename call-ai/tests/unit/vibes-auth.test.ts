import { callAi, CallAIOptions } from "call-ai";
import { describe, expect, it, beforeEach, vi, Mock } from "vitest";

// Storage key constants (matching call-ai/pkg/api.ts)
const VIBES_AUTH_TOKEN_KEY = "vibes-diy-auth-token" as const;
const LEGACY_AUTH_TOKEN_KEY = "auth_token" as const;

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

  it("should add X-VIBES-Token header when vibes-diy-auth-token is available", async () => {
    mockLocalStorage.getItem.mockImplementation((key) => (key === VIBES_AUTH_TOKEN_KEY ? "test-vibes-token" : null));
    await callAi("Hello", { apiKey: "test-key" });

    // Check that fetch was called with the enhanced headers
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("test-vibes-token");
  });

  it("should add X-VIBES-Token header when legacy auth_token is available", async () => {
    mockLocalStorage.getItem.mockImplementation((key) => (key === LEGACY_AUTH_TOKEN_KEY ? "legacy-vibes-token" : null));
    await callAi("Hello", { apiKey: "test-key" });

    // Check that fetch was called with the enhanced headers
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("legacy-vibes-token");
  });

  it("should prefer vibes-diy-auth-token over legacy auth_token", async () => {
    mockLocalStorage.getItem.mockImplementation((key) => {
      if (key === VIBES_AUTH_TOKEN_KEY) return "new-token";
      if (key === LEGACY_AUTH_TOKEN_KEY) return "legacy-token";
      return null;
    });
    await callAi("Hello", { apiKey: "test-key" });

    // Check that the new token is used, not the legacy one
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("new-token");
  });

  it("should not add X-VIBES-Token header when no auth token is available", async () => {
    mockLocalStorage.getItem.mockReturnValue(null);
    await callAi("Hello", { apiKey: "test-key" });

    // Check that fetch was called without the Vibes token
    const fetchCall = globalFetch.mock.calls[0];
    const requestOptions = fetchCall?.[1] as RequestInit;
    const headers = new Headers(requestOptions?.headers);
    expect(headers.has("X-VIBES-Token")).toBe(false);
  });

  it("should preserve existing X-VIBES-Token header if provided by caller", async () => {
    mockLocalStorage.getItem.mockImplementation((key) => (key === "vibes-diy-auth-token" ? "storage-token" : null));

    const options: CallAIOptions = {
      apiKey: "test-key",
      headers: { "X-VIBES-Token": "caller-provided-token" },
    };

    await callAi("Hello", options);

    // Check that the caller's token is preserved, not the storage token
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("caller-provided-token");
  });

  it("should preserve existing headers when adding auth token", async () => {
    mockLocalStorage.getItem.mockImplementation((key) => (key === "vibes-diy-auth-token" ? "test-vibes-token" : null));

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
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error("localStorage not available");
    });

    await expect(callAi("Hello", { apiKey: "test-key" })).resolves.toBeDefined();

    // Check that fetch was called without the Vibes token
    const fetchCall = globalFetch.mock.calls[0];
    const requestOptions = fetchCall?.[1] as RequestInit;
    const headers = new Headers(requestOptions?.headers);
    expect(headers.has("X-VIBES-Token")).toBe(false);
  });

  it("should work in non-browser environments without localStorage", async () => {
    const originalLocalStorage = (globalThis as { localStorage?: Storage }).localStorage;
    // Simulate absence by setting to undefined (property is writable in this test harness)
    (globalThis as { localStorage?: Storage }).localStorage = undefined as unknown as Storage;

    await expect(callAi("Hello", { apiKey: "test-key" })).resolves.toBeDefined();

    // Check that fetch was called without the Vibes token
    const fetchCall = globalFetch.mock.calls[0];
    const requestOptions = fetchCall?.[1] as RequestInit;
    const headers = new Headers(requestOptions?.headers);
    expect(headers.has("X-VIBES-Token")).toBe(false);

    // Restore localStorage
    (globalThis as { localStorage?: Storage }).localStorage = originalLocalStorage;
  });

  it("should handle empty string token correctly", async () => {
    mockLocalStorage.getItem.mockReturnValue("");
    await callAi("Hello", { apiKey: "test-key" });

    // Check that fetch was called without the Vibes token (empty string is falsy)
    const fetchCall = globalFetch.mock.calls[0];
    const requestOptions = fetchCall?.[1] as RequestInit;
    const headers = new Headers(requestOptions?.headers);
    expect(headers.has("X-VIBES-Token")).toBe(false);
  });

  it("should work with streaming requests", async () => {
    mockLocalStorage.getItem.mockImplementation((key) => (key === "vibes-diy-auth-token" ? "test-vibes-token" : null));

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
            .mockResolvedValueOnce({ done: true }),
        }),
      },
    };
    globalFetch.mockResolvedValue(streamingResponse as unknown as Response);

    const stream = await callAi("Hello", { apiKey: "test-key", stream: true });

    const generator = stream as AsyncGenerator<string>;
    const result = await generator.next();
    expect(result.value).toBeDefined();

    // Check that fetch was called with the enhanced headers
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("test-vibes-token");
  });

  it("should enhance options in bufferStreamingResults path", async () => {
    mockLocalStorage.getItem.mockImplementation((key) => (key === "vibes-diy-auth-token" ? "test-vibes-token" : null));

    // Use a model that forces streaming (Claude with schema)
    // Ensure the streaming reader completes cleanly
    mockReader.read.mockResolvedValueOnce({ done: true });
    await callAi("Hello", {
      apiKey: "test-key",
      model: "anthropic/claude-3.5-sonnet",
      schema: { type: "object", properties: {} },
      stream: false,
    });

    // Check that fetch was called with the enhanced headers
    const init = globalFetch.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init?.headers);
    expect(headers.get("X-VIBES-Token")).toBe("test-vibes-token");
  });

  it("should include X-VIBES-Token in actual HTTP request headers", async () => {
    // This integration test verifies the header is actually sent
    const testToken = "integration-test-vibes-token-12345";
    mockLocalStorage.getItem.mockImplementation((key) => (key === "vibes-diy-auth-token" ? testToken : null));

    // Clear previous mocks
    vi.clearAllMocks();
    globalFetch.mockResolvedValue(mockResponse);

    await callAi("Test integration call", { apiKey: "test-key" });

    // Verify fetch was called exactly once
    expect(globalFetch).toHaveBeenCalledTimes(1);

    // Extract and verify the actual request headers that would be sent
    const [url, requestInit] = globalFetch.mock.calls[0];
    expect(url).toBeDefined();
    expect(requestInit).toBeDefined();

    // Verify the X-VIBES-Token header is present in the request
    const actualHeaders = new Headers(requestInit?.headers);
    expect(actualHeaders.has("X-VIBES-Token")).toBe(true);
    expect(actualHeaders.get("X-VIBES-Token")).toBe(testToken);

    // Verify other essential headers are also present
    expect(actualHeaders.has("Authorization")).toBe(true);
    expect(actualHeaders.has("Content-Type")).toBe(true);

    // Log headers for debugging (useful when running tests manually)
    console.log("Integration test - Request headers:");
    for (const [key, value] of actualHeaders.entries()) {
      console.log(`  ${key}: ${value}`);
    }
  });
});
