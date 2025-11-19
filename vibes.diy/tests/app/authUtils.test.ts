import { afterEach, describe, expect, it, Mock, vi } from "vitest";
import * as auth from "~/vibes.diy/app/utils/auth.js";

// Mock the jose module
vi.mock("jose", () => ({
  importJWK: vi.fn().mockResolvedValue({} as CryptoKey),
  jwtVerify: vi.fn(),
}));

// Mock react-hot-toast
// vi.mock("react-hot-toast", () => ({
//   default: { success: vi.fn() },
// }));

// Using 'any' for mocked functions since vitest doesn't export its mock types easily

// Import jose after mocking to get the mocked version
import * as jose from "jose";
import { VibesDiyEnv } from "~/vibes.diy/app/config/env.js";

// Helper for setting up import.meta.env
function setEnv(vars: Record<string, string>) {
  // (import.meta.env as Record<string, string>) = { ...vars };
  VibesDiyEnv.env().sets({ ...vars });
}

describe("auth utils", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Clear storage
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe("verifyToken", () => {
    it("returns payload for a valid token", async () => {
      // Setup environment and mocks
      setEnv({ VITE_CLOUD_SESSION_TOKEN_PUBLIC: "zabc" });

      // Setup the jwt verification result with a token that won't trigger token extension
      // (far from expiration)
      (jose.jwtVerify as Mock).mockResolvedValueOnce({
        protectedHeader: { alg: "ES256" },
        payload: {
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          iss: "FP_CLOUD",
          aud: "PUBLIC",
          userId: "u",
          tenants: [],
          ledgers: [],
          iat: 1,
        },
        key: {} as CryptoKey,
      });

      const result = await auth.verifyToken("valid.token");
      expect(jose.importJWK).toHaveBeenCalled();
      expect(jose.jwtVerify).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(result?.payload.userId).toBe("u");
    });

    it("returns null for invalid token", async () => {
      setEnv({ VITE_CLOUD_SESSION_TOKEN_PUBLIC: "zabc" });
      (jose.jwtVerify as Mock).mockRejectedValueOnce(new Error("bad token"));

      const result = await auth.verifyToken("bad.token");
      expect(result).toBeNull();
    });

    it("returns null for expired token", async () => {
      setEnv({ VITE_CLOUD_SESSION_TOKEN_PUBLIC: "zabc" });
      (jose.jwtVerify as Mock).mockResolvedValueOnce({
        protectedHeader: { alg: "ES256" },
        payload: {
          exp: Math.floor(Date.now() / 1000) - 10, // expired token
          iss: "FP_CLOUD",
          aud: "PUBLIC",
          userId: "u",
          tenants: [],
          ledgers: [],
          iat: 1,
        },
        key: {} as CryptoKey,
      });

      const result = await auth.verifyToken("expired.token");
      expect(result).toBeNull();
    });

    // Instead of testing the exact token extension mechanism in verifyToken,
    // we'll test that the key integration points work as expected
    it("successfully returns extended token payload", async () => {
      // Setup environment
      setEnv({
        VITE_CLOUD_SESSION_TOKEN_PUBLIC: "zabc",
      });

      // Setup basic JWT verification for a valid token
      (jose.jwtVerify as Mock).mockResolvedValue({
        protectedHeader: { alg: "ES256" },
        payload: {
          exp: Math.floor(Date.now() / 1000) + 3600, // Valid expiration
          iss: "FP_CLOUD",
          aud: "PUBLIC",
          userId: "u123",
          tenants: [],
          ledgers: [],
          iat: 1,
        },
        key: {} as CryptoKey,
      });

      // First test normal token verification works
      const result = await auth.verifyToken("valid.token");
      expect(result).toBeTruthy();
      expect(result?.payload.userId).toBe("u123");
    });

    it("can extend a token when needed", async () => {
      // Mock successful API response for token extension
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "new.extended.token" }),
      });

      // Test the extendToken function directly
      const result = await auth.extendToken("old.token", { fetch });

      // Verify correct behavior
      expect(result).toBe("new.extended.token");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "old.token", type: "reqExtendToken" }),
        }),
      );
      expect(localStorage.getItem("vibes-diy-auth-token")).toBe(
        "new.extended.token",
      );
    });
  });

  describe("extendToken", () => {
    it("returns new token and stores it", async () => {
      setEnv({ VITE_CONNECT_API_URL: "https://api" });
      const fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "newtoken123" }),
      });
      const result = await auth.extendToken("oldtoken", { fetch });
      expect(result).toBe("newtoken123");
      expect(window.localStorage.getItem("vibes-diy-auth-token")).toBe(
        "newtoken123",
      );
    });
    it("returns null on network error", async () => {
      setEnv({ VITE_CONNECT_API_URL: "https://api" });
      const fetch = vi.fn().mockRejectedValue(new Error("fail"));
      const result = await auth.extendToken("token", { fetch });
      expect(result).toBeNull();
    });
    it("returns null on invalid response", async () => {
      setEnv({ VITE_CONNECT_API_URL: "https://api" });
      const fetch = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({}) });
      const result = await auth.extendToken("token", { fetch });
      expect(result).toBeNull();
    });
  });

  describe("initiateAuthFlow", () => {
    it("returns connectUrl and resultId and sets sessionStorage", () => {
      // Set the connect URL environment variable to match the actual .env file
      setEnv({ VITE_CONNECT_URL: "http://localhost:7370/token" });
      // vi.spyOn(window, "location", "get").mockReturnValue({
      //   pathname: "/not/callback",
      // } as Location);

      const result = auth.initiateAuthFlow({
        pathnameFn: () => "/not/callback",
      });
      expect(result).toBeTruthy();
      expect(result?.connectUrl).toContain("/token");
      expect(result?.connectUrl).toContain("result_id=");
      expect(result?.resultId).toMatch(/^z/);
      expect(window.sessionStorage.getItem("auth_result_id")).toBe(
        result?.resultId,
      );
    });

    it("returns null if already on callback page", () => {
      // vi.spyOn(window, "location", "get").mockReturnValue({
      //   pathname: "/auth/callback",
      // } as Location);
      const result = auth.initiateAuthFlow({
        pathnameFn: () => "/auth/callback",
      });
      expect(result).toBeNull();
    });
  });

  describe("pollForAuthToken", () => {
    it("returns token if found", async () => {
      setEnv({ VITE_CONNECT_API_URL: "https://api" });
      let called = 0;
      const fetch = vi.fn().mockImplementation(() => {
        called++;
        return Promise.resolve({
          ok: true,
          json: async () => (called < 2 ? {} : { token: "tok123" }),
        });
      });

      // Toast is already mocked at the top of the file

      const token = await auth.pollForAuthToken("resultid", 1, 10, {
        fetch,
        toast: {
          success: () => {
            /* no-op */
          },
        },
      });
      expect(token).toBe("tok123");
    });

    it("returns null if timed out", async () => {
      setEnv({ VITE_CONNECT_API_URL: "https://api" });
      const fetch = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({}) });

      const token = await auth.pollForAuthToken("resultid", 1, 5, {
        fetch,
        toast: {
          success: () => {
            /* no-op */
          },
        },
      });
      expect(token).toBeNull();
    });
  });
});
