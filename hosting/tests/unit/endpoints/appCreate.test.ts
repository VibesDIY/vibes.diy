import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AppCreate } from "@vibes.diy/hosting";
import { OpenAPIRoute } from "chanfana";

describe("AppCreate endpoint", () => {
  let originalFetch: typeof global.fetch;
  let mockFetch: typeof global.fetch;
  let mockKV: {
    get: (key: string, type?: string) => Promise<string | ArrayBuffer | null>;
    put: (key: string, value: string) => Promise<void>;
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
    mockFetch = vi.fn().mockImplementation((url: string, _options: RequestInit) => {
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
        SERVER_OPENROUTER_PROV_KEY: "test-prov-key",
      },
      get: vi.fn().mockReturnValue({ email: "test@example.com" }),
      req: {
        json: vi.fn(),
      },
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
});
