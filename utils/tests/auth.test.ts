import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import {
  verifyToken,
  extendToken,
  isTokenAboutToExpire,
  getUserId,
  hasTenantRole,
  hasLedgerAccess,
  type TokenPayload,
} from "@vibes.diy/utils";

// Mock the jose module
vi.mock("jose", () => ({
  importJWK: vi.fn().mockResolvedValue({} as CryptoKey),
  jwtVerify: vi.fn(),
}));

// Mock multiformats/bases/base58
vi.mock("multiformats/bases/base58", () => ({
  base58btc: {
    decode: vi.fn().mockReturnValue(
      new TextEncoder().encode(
        JSON.stringify({
          kty: "EC",
          crv: "P-256",
          x: "test-x-value",
          y: "test-y-value",
        }),
      ),
    ),
  },
}));

// Import jose after mocking
import * as jose from "jose";
import { base58btc } from "multiformats/bases/base58";

describe("@vibes.diy/utils auth utilities", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("verifyToken", () => {
    const mockPublicKey = "test-base58-encoded-jwk";
    const validPayload: TokenPayload = {
      userId: "user123",
      email: "test@example.com",
      tenants: [{ id: "tenant1", role: "admin" }],
      ledgers: [{ id: "ledger1", role: "owner", right: "rw" }],
      iat: Math.floor(Date.now() / 1000),
      iss: "FP_CLOUD",
      aud: "PUBLIC",
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    };

    it("returns payload for a valid token", async () => {
      (jose.jwtVerify as Mock).mockResolvedValueOnce({
        payload: validPayload,
      });

      const result = await verifyToken("valid.jwt.token", mockPublicKey);

      expect(result).toBeTruthy();
      expect(result?.payload).toEqual(validPayload);
      expect(base58btc.decode).toHaveBeenCalledWith(mockPublicKey);
      expect(jose.importJWK).toHaveBeenCalledWith(
        expect.objectContaining({
          kty: "EC",
          crv: "P-256",
          x: "test-x-value",
          y: "test-y-value",
        }),
        "ES256",
      );
      expect(jose.jwtVerify).toHaveBeenCalledWith(
        "valid.jwt.token",
        expect.any(Object),
        {
          issuer: "FP_CLOUD",
          audience: "PUBLIC",
        },
      );
    });

    it("returns null for invalid token signature", async () => {
      (jose.jwtVerify as Mock).mockRejectedValueOnce(
        new Error("Invalid signature"),
      );

      const result = await verifyToken("invalid.jwt.token", mockPublicKey);

      expect(result).toBeNull();
      expect(jose.jwtVerify).toHaveBeenCalled();
    });

    it("returns null for expired token", async () => {
      const expiredPayload = {
        ...validPayload,
        exp: Math.floor(Date.now() / 1000) - 10, // expired 10 seconds ago
      };

      (jose.jwtVerify as Mock).mockResolvedValueOnce({
        payload: expiredPayload,
      });

      const result = await verifyToken("expired.jwt.token", mockPublicKey);

      expect(result).toBeNull();
    });

    it("returns null for token missing expiration", async () => {
      const noExpPayload = { ...validPayload };
      delete (noExpPayload as Partial<TokenPayload>).exp;

      (jose.jwtVerify as Mock).mockResolvedValueOnce({
        payload: noExpPayload,
      });

      const result = await verifyToken("no.exp.token", mockPublicKey);

      expect(result).toBeNull();
    });

    it("handles malformed base58 public key gracefully", async () => {
      (base58btc.decode as Mock).mockImplementation(() => {
        throw new Error("Invalid base58");
      });

      (jose.jwtVerify as Mock).mockResolvedValueOnce({
        payload: validPayload,
      });

      const result = await verifyToken("valid.jwt.token", "invalid-base58");

      expect(result).toBeTruthy(); // Should still work with fallback JWK
      expect(jose.importJWK).toHaveBeenCalledWith(
        expect.objectContaining({
          kty: "EC",
          crv: "P-256",
          x: "",
          y: "",
        }),
        "ES256",
      );
    });

    it("returns null when JWK import fails", async () => {
      (jose.importJWK as Mock).mockRejectedValueOnce(new Error("Invalid JWK"));

      const result = await verifyToken("valid.jwt.token", mockPublicKey);

      expect(result).toBeNull();
    });
  });

  describe("extendToken", () => {
    const mockConnectApiUrl = "https://connect.example.com/api";
    const currentToken = "current.jwt.token";

    it("returns new token on successful extension", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "new.extended.token" }),
      });

      const result = await extendToken(
        currentToken,
        mockConnectApiUrl,
        mockFetch,
      );

      expect(result).toBe("new.extended.token");
      expect(mockFetch).toHaveBeenCalledWith(mockConnectApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: currentToken,
          type: "reqExtendToken",
        }),
      });
    });

    it("returns null on network error", async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"));

      const result = await extendToken(
        currentToken,
        mockConnectApiUrl,
        mockFetch,
      );

      expect(result).toBeNull();
    });

    it("returns null on HTTP error response", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const result = await extendToken(
        currentToken,
        mockConnectApiUrl,
        mockFetch,
      );

      expect(result).toBeNull();
    });

    it("returns null when response has no token", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }), // No token field
      });

      const result = await extendToken(
        currentToken,
        mockConnectApiUrl,
        mockFetch,
      );

      expect(result).toBeNull();
    });

    it("returns null when response has empty token", async () => {
      const mockFetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "" }), // Empty token
      });

      const result = await extendToken(
        currentToken,
        mockConnectApiUrl,
        mockFetch,
      );

      expect(result).toBeNull();
    });

    it("uses default fetch when no fetchImpl provided", async () => {
      // Mock global fetch
      const mockGlobalFetch = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "global.fetch.token" }),
      } as Response);

      const result = await extendToken(currentToken, mockConnectApiUrl);

      expect(result).toBe("global.fetch.token");
      expect(mockGlobalFetch).toHaveBeenCalled();

      mockGlobalFetch.mockRestore();
    });
  });

  describe("isTokenAboutToExpire", () => {
    it("returns true when token expires within default threshold (1 hour)", () => {
      const payload: TokenPayload = {
        userId: "user123",
        tenants: [],
        ledgers: [],
        iat: Math.floor(Date.now() / 1000),
        iss: "FP_CLOUD",
        aud: "PUBLIC",
        exp: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes from now
      };

      const result = isTokenAboutToExpire(payload);

      expect(result).toBe(true);
    });

    it("returns false when token expires beyond default threshold", () => {
      const payload: TokenPayload = {
        userId: "user123",
        tenants: [],
        ledgers: [],
        iat: Math.floor(Date.now() / 1000),
        iss: "FP_CLOUD",
        aud: "PUBLIC",
        exp: Math.floor(Date.now() / 1000) + 2 * 60 * 60, // 2 hours from now
      };

      const result = isTokenAboutToExpire(payload);

      expect(result).toBe(false);
    });

    it("respects custom threshold", () => {
      const payload: TokenPayload = {
        userId: "user123",
        tenants: [],
        ledgers: [],
        iat: Math.floor(Date.now() / 1000),
        iss: "FP_CLOUD",
        aud: "PUBLIC",
        exp: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now
      };

      // Custom threshold of 10 minutes
      const result = isTokenAboutToExpire(payload, 10 * 60 * 1000);

      expect(result).toBe(true);
    });

    it("returns true for already expired token", () => {
      const payload: TokenPayload = {
        userId: "user123",
        tenants: [],
        ledgers: [],
        iat: Math.floor(Date.now() / 1000),
        iss: "FP_CLOUD",
        aud: "PUBLIC",
        exp: Math.floor(Date.now() / 1000) - 60, // expired 1 minute ago
      };

      const result = isTokenAboutToExpire(payload);

      expect(result).toBe(true);
    });
  });

  describe("getUserId", () => {
    it("returns userId from payload", () => {
      const payload: TokenPayload = {
        userId: "user123",
        tenants: [],
        ledgers: [],
        iat: Math.floor(Date.now() / 1000),
        iss: "FP_CLOUD",
        aud: "PUBLIC",
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = getUserId(payload);

      expect(result).toBe("user123");
    });

    it("returns null when userId is missing", () => {
      const payload = {
        tenants: [],
        ledgers: [],
        iat: Math.floor(Date.now() / 1000),
        iss: "FP_CLOUD",
        aud: "PUBLIC",
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as unknown as TokenPayload;

      const result = getUserId(payload);

      expect(result).toBeNull();
    });
  });

  describe("hasTenantRole", () => {
    const payload: TokenPayload = {
      userId: "user123",
      tenants: [
        { id: "tenant1", role: "admin" },
        { id: "tenant2", role: "member" },
        { id: "tenant3", role: "viewer" },
      ],
      ledgers: [],
      iat: Math.floor(Date.now() / 1000),
      iss: "FP_CLOUD",
      aud: "PUBLIC",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it("returns true when user has the required role in tenant", () => {
      const result = hasTenantRole(payload, "tenant1", "admin");

      expect(result).toBe(true);
    });

    it("returns false when user has different role in tenant", () => {
      const result = hasTenantRole(payload, "tenant1", "member");

      expect(result).toBe(false);
    });

    it("returns false when tenant does not exist", () => {
      const result = hasTenantRole(payload, "nonexistent", "admin");

      expect(result).toBe(false);
    });

    it("returns false when tenants array is empty", () => {
      const emptyPayload: TokenPayload = {
        ...payload,
        tenants: [],
      };

      const result = hasTenantRole(emptyPayload, "tenant1", "admin");

      expect(result).toBe(false);
    });
  });

  describe("hasLedgerAccess", () => {
    const payload: TokenPayload = {
      userId: "user123",
      tenants: [],
      ledgers: [
        { id: "ledger1", role: "owner", right: "rw" },
        { id: "ledger2", role: "member", right: "read" },
        { id: "ledger3", role: "viewer", right: "write" },
      ],
      iat: Math.floor(Date.now() / 1000),
      iss: "FP_CLOUD",
      aud: "PUBLIC",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it("returns true when user has rw access (read request)", () => {
      const result = hasLedgerAccess(payload, "ledger1", "read");

      expect(result).toBe(true);
    });

    it("returns true when user has rw access (write request)", () => {
      const result = hasLedgerAccess(payload, "ledger1", "write");

      expect(result).toBe(true);
    });

    it("returns true when user has exact read access", () => {
      const result = hasLedgerAccess(payload, "ledger2", "read");

      expect(result).toBe(true);
    });

    it("returns false when user has read access but write is required", () => {
      const result = hasLedgerAccess(payload, "ledger2", "write");

      expect(result).toBe(false);
    });

    it("returns true when user has exact write access", () => {
      const result = hasLedgerAccess(payload, "ledger3", "write");

      expect(result).toBe(true);
    });

    it("returns false when user has write access but read is required", () => {
      const result = hasLedgerAccess(payload, "ledger3", "read");

      expect(result).toBe(false);
    });

    it("defaults to read access when no right specified", () => {
      const result = hasLedgerAccess(payload, "ledger2");

      expect(result).toBe(true);
    });

    it("returns false when ledger does not exist", () => {
      const result = hasLedgerAccess(payload, "nonexistent", "read");

      expect(result).toBe(false);
    });

    it("returns false when ledgers array is empty", () => {
      const emptyPayload: TokenPayload = {
        ...payload,
        ledgers: [],
      };

      const result = hasLedgerAccess(emptyPayload, "ledger1", "read");

      expect(result).toBe(false);
    });
  });
});
