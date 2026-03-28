import { describe, it, expect, beforeEach } from "vitest";
import { initKeyStore, keyStore } from "../../pkg/key-management.js";

describe("key-management null handling", () => {
  beforeEach(() => {
    // Reset keyStore state
    keyStore().current = undefined;
    keyStore().refreshEndpoint = "https://vibecode.garden";
    keyStore().refreshToken = "use-vibes";
  });

  it("should handle null CALLAI_API_KEY without throwing", () => {
    // Create a test environment with null values
    const testEnv = {
      get CALLAI_API_KEY() {
        return null;
      },
      get CALLAI_REFRESH_ENDPOINT() {
        return null;
      },
      get CALL_AI_REFRESH_TOKEN() {
        return null;
      },
      get CALLAI_DEBUG() {
        return null;
      },
    };

    // This should not throw an error
    expect(() => {
      initKeyStore(testEnv);
    }).not.toThrow();

    // Verify that null values are handled properly (converted to undefined)
    expect(keyStore().current).toBeUndefined();
    expect(keyStore().refreshEndpoint).toBe("https://vibecode.garden"); // Should use fallback
    expect(keyStore().refreshToken).toBe("use-vibes"); // Should use fallback
  });

  it("should handle undefined CALLAI_API_KEY without throwing", () => {
    const testEnv = {
      get CALLAI_API_KEY() {
        return undefined;
      },
      get CALLAI_REFRESH_ENDPOINT() {
        return undefined;
      },
      get CALL_AI_REFRESH_TOKEN() {
        return undefined;
      },
      get CALLAI_DEBUG() {
        return undefined;
      },
    };

    // This should not throw an error
    expect(() => {
      initKeyStore(testEnv);
    }).not.toThrow();

    // Verify that undefined values are handled properly
    expect(keyStore().current).toBeUndefined();
    expect(keyStore().refreshEndpoint).toBe("https://vibecode.garden"); // Should use fallback
    expect(keyStore().refreshToken).toBe("use-vibes"); // Should use fallback
  });

  it("should properly handle non-string environment values", () => {
    const testEnv = {
      get CALLAI_API_KEY() {
        return {};
      }, // empty object
      get CALLAI_REFRESH_ENDPOINT() {
        return [];
      }, // array
      get CALL_AI_REFRESH_TOKEN() {
        return 123;
      }, // number
      get CALLAI_DEBUG() {
        return {};
      },
    };

    // This should not throw an error
    expect(() => {
      initKeyStore(testEnv);
    }).not.toThrow();

    // Verify that non-string values are handled - the type checking
    // properly handles non-string values by treating them as invalid
    expect(keyStore().current).toBeUndefined(); // Empty object should become undefined
    expect(keyStore().refreshEndpoint).toBe("https://vibecode.garden"); // Should use fallback for array
    expect(keyStore().refreshToken).toBe("use-vibes"); // Should use fallback for number
  });

  it("should demonstrate potential null access issues", () => {
    const testEnv = {
      get CALLAI_API_KEY() {
        return null;
      },
      get CALLAI_REFRESH_ENDPOINT() {
        return undefined;
      },
      get CALL_AI_REFRESH_TOKEN() {
        return undefined;
      },
      get CALLAI_DEBUG() {
        return undefined;
      },
    };

    initKeyStore(testEnv);

    // This demonstrates that keyStore().current could be null/undefined
    const currentKey = keyStore().current;

    // If code later tries to access properties on currentKey without null checking,
    // it could throw runtime errors
    expect(currentKey).toBeUndefined();

    // This would throw if not properly handled:
    // expect(() => currentKey.length).toThrow();
    // expect(() => currentKey.substring(0, 10)).toThrow();
  });

  it("should work normally with valid string values", () => {
    const testEnv = {
      get CALLAI_API_KEY() {
        return "test-api-key";
      },
      get CALLAI_REFRESH_ENDPOINT() {
        return "https://test-endpoint.com";
      },
      get CALL_AI_REFRESH_TOKEN() {
        return "test-token";
      },
      get CALLAI_DEBUG() {
        return true;
      },
    };

    initKeyStore(testEnv);

    expect(keyStore().current).toBe("test-api-key");
    expect(keyStore().refreshEndpoint).toBe("https://test-endpoint.com");
    expect(keyStore().refreshToken).toBe("test-token");
  });
});
