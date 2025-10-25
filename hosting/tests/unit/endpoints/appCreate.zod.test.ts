import { describe, it, expect, vi } from "vitest";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { AppCreate } from "@vibes.diy/hosting";

describe("AppCreate Zod v4 Compatibility", () => {
  it("should validate request body without _parse error", async () => {
    // Create a real Hono app with chanfana OpenAPI registry
    const app = new Hono<{ Bindings: Env }>();
    const openapi = fromHono(app, { docs_url: "/docs" });

    // Mock KV and Queue
    const mockKV = {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    };
    const mockQueue = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    // Mock environment with proper typing
    app.use("*", async (c, next) => {
      c.env = {
        KV: mockKV,
        PUBLISH_QUEUE: mockQueue,
      } as unknown as Env;
      await next();
    });

    // Mock auth middleware to set user
    app.use("*", async (c, next) => {
      c.set("user", { userId: "test-user", email: "test@test.com" });
      await next();
    });

    // Register the AppCreate endpoint
    openapi.post("/api/apps", AppCreate);

    // Create a real Request object
    const request = new Request("http://localhost/api/apps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId: "test-123",
        code: "export default () => <div>Test</div>",
        title: "Test App",
      }),
    });

    // Execute the request through the actual Hono/chanfana pipeline
    // This will trigger real validation including getValidatedData()
    const response = await app.fetch(request);

    // Should not throw "_parse is not a function"
    expect(response).toBeDefined();
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
  });
});
