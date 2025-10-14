// Test for keyCreate endpoint functionality
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  type MockedFunction,
} from "vitest";
import { Hono } from "hono";
import { fromHono } from "chanfana";

// Mock the entire keyLib module first
vi.mock("../../../pkg/src/endpoints/keyLib", () => ({
  createKey: vi.fn(),
  increaseKeyLimitBy: vi.fn(),
}));

import { KeyCreate } from "@vibes.diy/hosting";
import {
  createKey,
  increaseKeyLimitBy,
} from "../../../pkg/src/endpoints/keyLib";

interface TokenPayload {
  userId: string;
  tenants: { id: string; role: string }[];
  ledgers: { id: string; role: string; right: string }[];
  iat: number;
  iss: string;
  aud: string;
  exp: number;
}

interface KeyResult {
  success: boolean;
  key?: {
    hash: string;
    name: string;
    label: string;
    disabled: boolean;
    limit: number;
    usage: number;
    created_at: string;
    updated_at: string | null;
    key: string;
  };
  error?: string;
}

const mockTokenPayload: TokenPayload = {
  userId: "test-user",
  tenants: [{ id: "tenant-1", role: "admin" }],
  ledgers: [{ id: "ledger-1", role: "owner", right: "rw" }],
  iat: Math.floor(Date.now() / 1000),
  iss: "FP_CLOUD",
  aud: "PUBLIC",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

describe("KeyCreate Endpoint Integration Test", () => {
  let app: Hono;
  const env = {
    SERVER_OPENROUTER_PROV_KEY: "test-provisioning-key",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    app = new Hono();
    const openapi = fromHono(app);

    // Auth middleware
    app.use("/api/keys", async (c, next) => {
      const authHeader = c.req.header("Authorization");
      if (authHeader === "Bearer valid-token") {
        c.set("user", mockTokenPayload);
      } else {
        c.set("user", null);
      }
      await next();
    });

    openapi.post("/api/keys", KeyCreate);
  });

  it("should create a key for an authenticated user", async () => {
    const mockResult: KeyResult = {
      success: true,
      key: {
        hash: "test-hash",
        name: "Test Key",
        limit: 2.5,
        disabled: false,
        created_at: "",
        updated_at: null,
        label: "",
        usage: 0,
        key: "test-api-key",
      },
    };

    (createKey as MockedFunction<typeof createKey>).mockResolvedValue(
      mockResult,
    );

    const request = new Request("http://localhost/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ name: "Test Session" }),
    });

    const response = await app.fetch(request, env);
    const body = (await response.json()) as KeyResult;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(createKey).toHaveBeenCalledWith({
      userId: "test-user",
      name: "Test Session",
      label: undefined,
      provisioningKey: "test-provisioning-key",
    });
  });

  it("should return 401 for unauthenticated user", async () => {
    const request = new Request("http://localhost/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid-token",
      },
      body: JSON.stringify({ name: "Test Session" }),
    });

    const response = await app.fetch(request, env);
    const body = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Unauthorized: Invalid or missing token");
  });

  it("should increase key limit for authenticated user", async () => {
    const mockResult: KeyResult = {
      success: true,
      key: {
        hash: "test-hash-123",
        name: "Test Key",
        limit: 5.0,
        disabled: false,
        created_at: "",
        updated_at: null,
        label: "",
        usage: 2.5,
        key: "test-api-key",
      },
    };

    (
      increaseKeyLimitBy as MockedFunction<typeof increaseKeyLimitBy>
    ).mockResolvedValue(mockResult);

    const request = new Request("http://localhost/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({ hash: "test-hash-123" }),
    });

    const response = await app.fetch(request, env);
    const body = (await response.json()) as KeyResult;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.key?.limit).toBe(5.0);
    expect(increaseKeyLimitBy).toHaveBeenCalledWith({
      hash: "test-hash-123",
      amount: 2.5,
      provisioningKey: "test-provisioning-key",
    });
  });
});
