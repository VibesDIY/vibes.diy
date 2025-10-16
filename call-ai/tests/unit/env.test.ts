import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { CallAIEnv } from "../../pkg/env.js";

// Extend Window interface for our custom properties
declare global {
  interface Window {
    CALLAI_CHAT_URL?: string;
    CALLAI_IMG_URL?: string;
    callAi?: { CHAT_URL?: string; IMG_URL?: string };
  }
}

describe("CallAIEnv window variable fallback", () => {
  let env: CallAIEnv;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    // Create a fresh CallAIEnv instance for each test
    env = new CallAIEnv();

    // Store original window reference
    originalWindow = globalThis.window;

    // Mock a clean window object
    globalThis.window = {
      ...originalWindow,
      CALLAI_CHAT_URL: undefined,
      CALLAI_IMG_URL: undefined,
      callAi: undefined,
    } as Window & typeof globalThis;
  });

  afterEach(() => {
    // Restore original window
    globalThis.window = originalWindow;

    // Clear any mocks
    vi.clearAllMocks();
  });

  describe("CALLAI_CHAT_URL fallback chain", () => {
    it("should use hardcoded default when no env var and no window var", () => {
      // Test the def getter which is used by api.ts
      expect(env.def.CALLAI_CHAT_URL).toBe("https://vibes-diy-api.com");

      // Test the direct getter
      expect(env.CALLAI_CHAT_URL).toBeUndefined();
    });

    it("should use window.CALLAI_CHAT_URL when set", () => {
      globalThis.window.CALLAI_CHAT_URL = "https://vibesdiy.net";

      expect(env.CALLAI_CHAT_URL).toBe("https://vibesdiy.net");
      expect(env.def.CALLAI_CHAT_URL).toBe("https://vibesdiy.net");
    });

    it("should use window.callAi.CHAT_URL when set", () => {
      globalThis.window.callAi = { CHAT_URL: "https://custom.api.com" };

      expect(env.CALLAI_CHAT_URL).toBe("https://custom.api.com");
      expect(env.def.CALLAI_CHAT_URL).toBe("https://custom.api.com");
    });

    it("should prefer window.CALLAI_CHAT_URL over window.callAi.CHAT_URL", () => {
      globalThis.window.CALLAI_CHAT_URL = "https://priority.api.com";
      globalThis.window.callAi = { CHAT_URL: "https://secondary.api.com" };

      expect(env.CALLAI_CHAT_URL).toBe("https://priority.api.com");
      expect(env.def.CALLAI_CHAT_URL).toBe("https://priority.api.com");
    });

    it("should prefer env var over window vars", () => {
      // Mock the env to return a value
      const mockEnv = vi.spyOn(env.env(), "get");
      mockEnv.mockImplementation((key) => {
        if (key === "CALLAI_CHAT_URL") return "https://env.api.com";
        return undefined;
      });

      globalThis.window.CALLAI_CHAT_URL = "https://window.api.com";

      expect(env.CALLAI_CHAT_URL).toBe("https://env.api.com");
      expect(env.def.CALLAI_CHAT_URL).toBe("https://env.api.com");
    });
  });

  describe("CALLAI_IMG_URL fallback chain (existing functionality)", () => {
    it("should use window.CALLAI_IMG_URL when set", () => {
      globalThis.window.CALLAI_IMG_URL = "https://vibesdiy.net";

      expect(env.CALLAI_IMG_URL).toBe("https://vibesdiy.net");
    });

    it("should use window.callAi.IMG_URL when set", () => {
      globalThis.window.callAi = { IMG_URL: "https://custom.img.com" };

      expect(env.CALLAI_IMG_URL).toBe("https://custom.img.com");
    });

    it("should prefer window.CALLAI_IMG_URL over window.callAi.IMG_URL", () => {
      globalThis.window.CALLAI_IMG_URL = "https://priority.img.com";
      globalThis.window.callAi = { IMG_URL: "https://secondary.img.com" };

      expect(env.CALLAI_IMG_URL).toBe("https://priority.img.com");
    });

    it("should return undefined when no window vars are set", () => {
      expect(env.CALLAI_IMG_URL).toBeUndefined();
    });

    it("should prefer env var over window vars for IMG_URL", () => {
      // Mock the env to return a value
      const mockEnv = vi.spyOn(env.env(), "get");
      mockEnv.mockImplementation((key) => {
        if (key === "CALLAI_IMG_URL") return "https://env.img.com";
        return undefined;
      });

      globalThis.window.CALLAI_IMG_URL = "https://window.img.com";

      expect(env.CALLAI_IMG_URL).toBe("https://env.img.com");
    });
  });

  describe("getWindowCALLAI_CHAT_URL helper", () => {
    it("should return undefined when no window vars are set", () => {
      expect(env.getWindowCALLAI_CHAT_URL()).toBeUndefined();
    });

    it("should return CALLAI_CHAT_URL when set", () => {
      globalThis.window.CALLAI_CHAT_URL = "https://test.com";
      expect(env.getWindowCALLAI_CHAT_URL()).toBe("https://test.com");
    });

    it("should return callAi.CHAT_URL when set", () => {
      globalThis.window.callAi = { CHAT_URL: "https://nested.com" };
      expect(env.getWindowCALLAI_CHAT_URL()).toBe("https://nested.com");
    });

    it("should handle undefined window gracefully", () => {
      globalThis.window = undefined as unknown as typeof globalThis.window;
      expect(env.getWindowCALLAI_CHAT_URL()).toBeUndefined();
    });

    it("should handle undefined callAi gracefully", () => {
      globalThis.window.callAi = undefined;
      expect(env.getWindowCALLAI_CHAT_URL()).toBeUndefined();
    });
  });

  describe("backward compatibility for existing deployments", () => {
    it("should maintain exact same behavior when no window vars are set", () => {
      // This is the critical test for existing deployments
      // No env vars, no window vars = should use hardcoded defaults

      expect(env.CALLAI_CHAT_URL).toBeUndefined(); // No env var, no window var
      expect(env.def.CALLAI_CHAT_URL).toBe("https://vibes-diy-api.com"); // Falls back to hardcoded

      expect(env.CALLAI_IMG_URL).toBeUndefined(); // No env var, no window var
    });

    it("should not break when window is undefined", () => {
      globalThis.window = undefined as unknown as typeof globalThis.window;

      expect(() => env.getWindowCALLAI_CHAT_URL()).not.toThrow();
      expect(() => env.getWindowCALLAI_IMG_URL()).not.toThrow();
      expect(() => env.CALLAI_CHAT_URL).not.toThrow();
      expect(() => env.CALLAI_IMG_URL).not.toThrow();

      expect(env.def.CALLAI_CHAT_URL).toBe("https://vibes-diy-api.com");
    });
  });
});
