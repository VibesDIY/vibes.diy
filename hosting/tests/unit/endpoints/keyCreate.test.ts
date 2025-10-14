// Test for keyCreate endpoint functionality
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { fromHono } from "chanfana";
import { KeyCreate } from "../../src/endpoints/keyCreate";
import * as keyLib from "../../src/endpoints/keyLib";
import { KeyResult } from "../../src/endpoints/keyLib";
import { authMiddleware } from "../../src/middleware/auth";
import { TokenPayload } from "../../src/utils/auth";

// Mock the keyLib and authMiddleware modules
vi.mock("../../src/endpoints/keyLib");
vi.mock("../../src/middleware/auth", async () => {
  const original = await vi.importActual("../../src/middleware/auth");
  return {
    ...original,
    authMiddleware: vi.fn(),
  };
});

// Define a mock token payload for authenticated users
const mockTokenPayload: TokenPayload = {
  userId: "test-user",
  tenants: [{ id: "tenant-1", role: "admin" }],
  ledgers: [{ id: "ledger-1", role: "owner", right: "rw" }],
  iat: Math.floor(Date.now() / 1000),
  iss: "FP_CLOUD",
  aud: "PUBLIC",
  exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
};

describe("KeyCreate Endpoint Integration Test", () => {
  let app: Hono;
  const env = {
    SERVER_OPENROUTER_PROV_KEY: "test-provisioning-key",
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create a new Hono app for each test
    app = new Hono();
    const openapi = fromHono(app);

    // Mock middleware to set user context
    vi.mocked(authMiddleware).mockImplementation(async (c, next) => {
      const authHeader = c.req.header("Authorization");
      if (authHeader === "Bearer valid-token") {
        c.set("user", mockTokenPayload);
      } else {
        c.set("user", null);
      }
      await next();
    });

    // Register middleware and endpoint
    openapi.use("/api/keys", authMiddleware);
    openapi.post("/api/keys", KeyCreate);
  });

  // Test case for successful key creation
  it("should create a key for an authenticated user", async () => {
    // Arrange: Mock the result from keyLib.createKey
    const mockCreateKeyResult: KeyResult = {
      success: true,
      key: {
        hash: "test-hash",
        name: "Test Key",
        limit: 2.5,
        disabled: false,
        created_at: "",
        updated_at: null,
        label: "",
      },
    };
    vi.mocked(keyLib.createKey).mockResolvedValue(mockCreateKeyResult);

    // Act: Send a request to the endpoint
    const response = await app.request(
      "/api/keys",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token" },
        body: JSON.stringify({ name: "Test Session" }),
      },
      env
    );

    // Assert: Check the response and that createKey was called correctly
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(keyLib.createKey).toHaveBeenCalledWith(expect.objectContaining({ userId: "test-user" }));
  });

  // Test case for unauthorized access
  it("should return 401 Unauthorized if user is not authenticated", async () => {
    // Act: Send a request with an invalid token
    const response = await app.request(
      "/api/keys",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer invalid-token" },
        body: JSON.stringify({ name: "Test Session" }),
      },
      env
    );

    // Assert: Check for a 401 response
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Unauthorized: Invalid or missing token");
  });

  // Test case for increasing key limit
  it("should increase key limit for an authenticated user", async () => {
    // Arrange: Mock the result from keyLib.increaseKeyLimitBy
    const mockIncreaseResult: KeyResult = {
      success: true,
      key: {
        hash: "test-hash-123",
        name: "Test Key",
        limit: 5.0,
        disabled: false,
        created_at: "",
        updated_at: null,
        label: "",
      },
    };
    vi.mocked(keyLib.increaseKeyLimitBy).mockResolvedValue(mockIncreaseResult);

    // Act: Send a request to the endpoint
    const response = await app.request(
      "/api/keys",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-token" },
        body: JSON.stringify({ hash: "test-hash-123" }),
      },
      env
    );

    // Assert: Check the response and that increaseKeyLimitBy was called correctly
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.key.limit).toBe(5.0);
    expect(keyLib.increaseKeyLimitBy).toHaveBeenCalledWith(expect.objectContaining({ hash: "test-hash-123" }));
  });
});
