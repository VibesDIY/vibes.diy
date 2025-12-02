import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppCreate } from "@vibes.diy/hosting";
import type { OpenAPIRoute } from "chanfana";

describe("AppCreate endpoint", () => {
  let originalFetch: typeof global.fetch;
  let mockFetch: typeof global.fetch;
  let mockKV: {
    get: (key: string, type?: string) => Promise<string | ArrayBuffer | null>;
    put: (key: string, value: unknown) => Promise<void>;
  };
  let mockContext: {
    env: { KV: typeof mockKV };
    get: (key: string) => { email: string };
    req: { json: () => Promise<unknown> };
  };

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Mock fetch to capture Discord webhook calls
    mockFetch = vi
      .fn()
      .mockImplementation((url: string, _options: RequestInit) => {
        if (url.includes("discord.com/api/webhooks")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ success: true }),
          });
        }

        // For other fetch calls, return a basic response
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        });
      });

    global.fetch = mockFetch;

    // Mock KV
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
    };

    // Mock queue
    const mockQueue = {
      send: vi.fn().mockResolvedValue(undefined),
    };

    // Mock context
    mockContext = {
      env: {
        KV: mockKV,
        PUBLISH_QUEUE: mockQueue,
      },
      get: vi.fn().mockReturnValue({
        email: "test@example.com",
        userId: "test-user-123",
      }),
      req: {
        json: vi.fn(),
      },
      json: vi.fn().mockImplementation((data, status) => ({
        body: JSON.stringify(data),
        init: { status: status || 200 },
      })),
    };
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("should send event to queue for new app", async () => {
    // Mock KV to return no existing app (new app scenario)
    mockKV.get.mockResolvedValue(null);
    mockKV.put.mockResolvedValue(undefined);

    const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

    // Mock the getValidatedData method
    const mockData = {
      body: {
        chatId: "test-chat-123",
        code: "console.log('hello');",
        title: "Test App",
        screenshot:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        userId: "user-123",
      },
    };

    // Spy on getValidatedData
    vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(mockData);

    // Call the handler
    const result = await appCreate.handle(mockContext);

    // Verify queue was called instead of Discord
    expect(mockContext.env.PUBLISH_QUEUE.send).toHaveBeenCalledOnce();

    // Verify the result includes the app
    expect(result.success).toBe(true);
    expect(result.app).toBeDefined();
    expect(result.app.title).toBe("Test App");
    expect(result.app.summary).toBeNull();
    expect(result.app.hasIcon).toBe(false);
    expect(result.app.iconKey).toBeNull();

    // Verify Discord webhook was NOT called directly
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("should send event to queue for remix app", async () => {
    // Mock KV to return no existing app (new app scenario)
    mockKV.get.mockResolvedValue(null);
    mockKV.put.mockResolvedValue(undefined);

    const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

    // Mock the getValidatedData method for a remix
    const mockData = {
      body: {
        chatId: "test-chat-remix-456",
        code: "console.log('hello remix');",
        title: "Remix App",
        screenshot:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        userId: "user-456",
        remixOf: "original-app-slug",
      },
    };

    // Spy on getValidatedData
    vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(mockData);

    // Call the handler
    const result = await appCreate.handle(mockContext);

    // Verify queue was called
    expect(mockContext.env.PUBLISH_QUEUE.send).toHaveBeenCalledOnce();

    // Get the queue message and check remix information
    const queueMessage = mockContext.env.PUBLISH_QUEUE.send.mock.calls[0][0];
    expect(queueMessage.app.remixOf).toBe("original-app-slug");
    expect(queueMessage.app.title).toBe("Remix App");

    // Verify the result
    expect(result.success).toBe(true);
    expect(result.app.remixOf).toBe("original-app-slug");
  });

  it("should send event to queue for app without screenshot", async () => {
    // Mock KV to return no existing app (new app scenario)
    mockKV.get.mockResolvedValue(null);
    mockKV.put.mockResolvedValue(undefined);

    const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

    // Mock the getValidatedData method without screenshot
    const mockData = {
      body: {
        chatId: "test-chat-789",
        code: "console.log('no screenshot');",
        title: "No Screenshot App",
        userId: "user-789",
      },
    };

    // Spy on getValidatedData
    vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(mockData);

    // Call the handler
    const result = await appCreate.handle(mockContext);

    // Verify queue was called
    expect(mockContext.env.PUBLISH_QUEUE.send).toHaveBeenCalledOnce();

    // Get the queue message
    const queueMessage = mockContext.env.PUBLISH_QUEUE.send.mock.calls[0][0];
    expect(queueMessage.app.title).toBe("No Screenshot App");

    // Verify the result
    expect(result.success).toBe(true);
    expect(result.app.title).toBe("No Screenshot App");
  });

  describe("Authentication and Security", () => {
    it("should require authentication for app creation", async () => {
      // Mock context with no user
      const unauthenticatedContext = {
        ...mockContext,
        get: vi.fn().mockReturnValue(null), // No user
      };

      const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

      const mockData = {
        body: {
          chatId: "test-chat-no-auth",
          code: "console.log('hello');",
          title: "Unauthorized App",
        },
      };

      vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(mockData);

      // Call the handler
      const result = await appCreate.handle(unauthenticatedContext);

      // Verify 401 response
      expect(result.init.status).toBe(401);
      expect(result.body).toContain("Authentication required");
    });

    it("should require authentication when user has no userId", async () => {
      // Mock context with user but no userId
      const partialUserContext = {
        ...mockContext,
        get: vi.fn().mockReturnValue({ email: "test@example.com" }), // User but no userId
      };

      const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

      const mockData = {
        body: {
          chatId: "test-chat-partial-user",
          code: "console.log('hello');",
          title: "Partial User App",
        },
      };

      vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(mockData);

      // Call the handler
      const result = await appCreate.handle(partialUserContext);

      // Verify 401 response
      expect(result.init.status).toBe(401);
      expect(result.body).toContain("Authentication required");
    });

    it("should prevent unauthorized app updates", async () => {
      // Mock an existing app owned by a different user
      const existingApp = {
        chatId: "existing-chat-123",
        userId: "original-owner-456",
        slug: "existing-app",
        code: "original code",
        raw: "original raw",
        title: "Original App",
      };

      mockKV.get.mockResolvedValue(JSON.stringify(existingApp));

      // Mock authenticated context with different user
      const differentUserContext = {
        ...mockContext,
        get: vi.fn().mockReturnValue({
          email: "different@example.com",
          userId: "different-user-789",
        }),
      };

      const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

      const mockData = {
        body: {
          chatId: "existing-chat-123", // Trying to update existing app
          code: "malicious code",
          title: "Hijacked App",
        },
      };

      vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(mockData);

      // Call the handler
      const result = await appCreate.handle(differentUserContext);

      // Verify 403 response
      expect(result.init.status).toBe(403);
      expect(result.body).toContain("Forbidden");

      // Verify KV was not updated
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it("should allow app owner to update their own app", async () => {
      // Mock an existing app
      const existingApp = {
        chatId: "owner-chat-123",
        userId: "owner-user-456",
        slug: "owner-app",
        code: "original code",
        raw: "original raw",
        title: "Owner App",
      };

      mockKV.get.mockResolvedValue(JSON.stringify(existingApp));
      mockKV.put.mockResolvedValue(undefined);

      // Mock authenticated context with same user
      const ownerContext = {
        ...mockContext,
        get: vi.fn().mockReturnValue({
          email: "owner@example.com",
          userId: "owner-user-456",
        }),
      };

      const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

      const mockData = {
        body: {
          chatId: "owner-chat-123",
          code: "updated code",
          title: "Updated App",
        },
      };

      vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(mockData);

      // Call the handler
      const result = await appCreate.handle(ownerContext);

      // Verify successful update
      expect(result.success).toBe(true);
      expect(result.app.title).toBe("Updated App");

      // Verify KV was updated
      expect(mockKV.put).toHaveBeenCalled();
    });

    it("should preserve code when only updating metadata", async () => {
      // Mock an existing app
      const existingApp = {
        chatId: "preserve-code-123",
        userId: "user-789",
        slug: "preserve-app",
        code: "important code that should be preserved",
        raw: "important raw code",
        title: "Original Title",
        customDomain: null,
      };

      mockKV.get.mockResolvedValue(JSON.stringify(existingApp));
      mockKV.put.mockResolvedValue(undefined);

      // Mock authenticated context
      const authenticatedContext = {
        ...mockContext,
        get: vi.fn().mockReturnValue({
          email: "user@example.com",
          userId: "user-789",
        }),
      };

      const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

      // Mock data that only updates metadata (no code/raw provided)
      const mockData = {
        body: {
          chatId: "preserve-code-123",
          title: "Updated Title",
          customDomain: "example.com",
          // Note: No code or raw fields provided
        },
      };

      vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(mockData);

      // Call the handler
      const result = await appCreate.handle(authenticatedContext);

      // Verify successful update
      expect(result.success).toBe(true);
      expect(result.app.title).toBe("Updated Title");

      // Get the stored app data
      const storedAppCall = mockKV.put.mock.calls.find(
        (call) => call[0] === "preserve-code-123",
      );
      expect(storedAppCall).toBeDefined();

      const storedApp = JSON.parse(storedAppCall[1]);

      // Verify code was preserved
      expect(storedApp.code).toBe("important code that should be preserved");
      expect(storedApp.raw).toBe("important raw code");

      // Verify metadata was updated
      expect(storedApp.title).toBe("Updated Title");
      expect(storedApp.customDomain).toBe("example.com");
    });
  });
});
