import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { increaseKeyLimitBy } from "../src/endpoints/keyLib";

describe("increaseKeyLimitBy function", () => {
  let originalFetch: typeof global.fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save originals
    originalFetch = global.fetch;
    originalEnv = { ...process.env };

    // Set test environment
    process.env.SERVER_OPENROUTER_PROV_KEY = "test-provisioning-key";

    // Mock fetch
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore originals
    global.fetch = originalFetch;
    process.env = originalEnv;

    // Clear mocks
    vi.clearAllMocks();
  });

  it("should increase key limit when available balance is less than $1", async () => {
    // Mock the fetch responses
    (global.fetch as any).mockImplementation(
      async (url: string, options: RequestInit) => {
        // Mock key metadata endpoint (needed to get the API key first)
        if (
          url === "https://openrouter.ai/api/v1/keys/test-hash" &&
          options.method === "GET"
        ) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              data: {
                hash: "test-hash",
                name: "Test Key",
                label: "test-label",
                disabled: false,
                limit: 2.5,
                usage: 2.0, // Usage set to $2.00, so available balance is $0.50 (< $1)
                created_at: "2025-04-16T20:06:11.244276+00:00",
                updated_at: "2025-04-16T20:06:11.244276+00:00",
              },
              key: "test-api-key-12345", // The actual API key at this level
            }),
            text: async () =>
              JSON.stringify({
                data: {
                  hash: "test-hash",
                  name: "Test Key",
                  usage: 2.0,
                  /* ... other fields omitted for brevity ... */
                },
                key: "test-api-key-12345",
              }),
          };
        }
        // Mock key update endpoint
        else if (
          url === "https://openrouter.ai/api/v1/keys/test-hash" &&
          options.method === "PATCH"
        ) {
          const body = JSON.parse(options.body as string);
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              data: {
                hash: "test-hash",
                name: "Test Key",
                label: "test-label",
                disabled: false,
                limit: body.limit, // Updated limit from request
                created_at: "2025-04-16T20:06:11.244276+00:00",
                updated_at: "2025-05-31T13:30:00.000000+00:00",
              },
            }),
            text: async () =>
              JSON.stringify({
                data: {
                  hash: "test-hash",
                  name: "Test Key",
                  limit: body.limit,
                  /* ... other fields omitted for brevity ... */
                },
              }),
          };
        }
        return {
          ok: false,
          status: 400,
          statusText: "Mock not implemented",
          json: async () => ({ error: "Mock not implemented" }),
          text: async () => "Mock not implemented error message",
        };
      },
    );

    // Call function with test parameters
    const result = await increaseKeyLimitBy({
      hash: "test-hash",
      amount: 2.5,
      provisioningKey: "test-provisioning-key",
    });

    // Verify success
    expect(result.success).toBe(true);
    expect(result.key).toBeDefined();
    expect(result.key?.limit).toBe(5.0); // 2.5 + 2.5 = 5.0

    // Verify the fetch calls
    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Check first call (GET for key metadata)
    const [getKeyUrl, getKeyOptions] = (global.fetch as any).mock.calls[0];
    expect(getKeyUrl).toBe("https://openrouter.ai/api/v1/keys/test-hash");
    expect(getKeyOptions.method).toBe("GET");
    expect(getKeyOptions.headers.Authorization).toBe(
      "Bearer test-provisioning-key",
    );

    // Check second call (PATCH to update key limit)
    const [patchUrl, patchOptions] = (global.fetch as any).mock.calls[1];
    expect(patchUrl).toBe("https://openrouter.ai/api/v1/keys/test-hash");
    expect(patchOptions.method).toBe("PATCH");
    expect(patchOptions.headers.Authorization).toBe(
      "Bearer test-provisioning-key",
    );
    expect(JSON.parse(patchOptions.body)).toEqual({ limit: 5.0 });
  });

  it("should not increase key limit when available balance is $1 or more", async () => {
    // Mock the fetch for a key with HIGH available balance (>= $1)
    (global.fetch as any).mockImplementation(
      async (url: string, options: RequestInit) => {
        // Mock key metadata endpoint to get the API key
        if (
          url === "https://openrouter.ai/api/v1/keys/test-hash-high-balance" &&
          options.method === "GET"
        ) {
          return {
            ok: true,
            json: async () => ({
              data: {
                hash: "test-hash-high-balance",
                name: "High Balance Key",
                label: "high-balance-label",
                disabled: false,
                limit: 2.5,
                usage: 1.0, // Usage is $1.00, so available balance is $1.50 (>= $1)
                created_at: "2025-04-16T20:06:11.244276+00:00",
                updated_at: "2025-04-16T20:06:11.244276+00:00",
              },
              key: "test-api-key-high-balance", // The API key needs to be at this level
            }),
          };
        }
        return {
          ok: false,
          status: 400,
          statusText: "Mock not implemented",
          json: async () => ({ error: "Mock not implemented" }),
          text: async () => "Mock not implemented error message",
        };
      },
    );

    // Call function with test parameters
    const result = await increaseKeyLimitBy({
      hash: "test-hash-high-balance",
      amount: 2.5,
      provisioningKey: "test-provisioning-key",
    });

    // Verify success with existing key returned (no update needed)
    expect(result.success).toBe(true);
    expect(result.key).toBeDefined();
    expect(result.key?.limit).toBe(2.5); // Limit not increased

    // Verify only one GET call was made (no PATCH)
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Check the GET call for key metadata endpoint
    const [getKeyUrl, getKeyOptions] = (global.fetch as any).mock.calls[0];
    expect(getKeyUrl).toBe(
      "https://openrouter.ai/api/v1/keys/test-hash-high-balance",
    );
    expect(getKeyOptions.method).toBe("GET");
    expect(getKeyOptions.headers.Authorization).toBe(
      "Bearer test-provisioning-key",
    );
  });

  it("should handle missing hash parameter", async () => {
    const result = await increaseKeyLimitBy({
      hash: "", // Empty hash
      amount: 2.5,
      provisioningKey: "test-provisioning-key",
    });

    // Verify failure with correct error
    expect(result.success).toBe(false);
    expect(result.error).toBe("Hash is required to increase key limit");

    // Verify no fetch calls were made
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should handle missing provisioning key", async () => {
    const result = await increaseKeyLimitBy({
      hash: "test-hash",
      amount: 2.5,
      provisioningKey: "", // Empty provisioning key
    });

    // Verify failure with correct error
    expect(result.success).toBe(false);
    expect(result.error).toBe("Server configuration error: Missing API key");

    // Verify no fetch calls were made
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
