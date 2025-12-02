import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AppCreate, PublishEvent } from "@vibes.diy/hosting";
import type { OpenAPIRoute } from "chanfana";

// Mock types
interface MockKV {
  get: (key: string, type?: string) => Promise<string | ArrayBuffer | null>;
  put: (key: string, value: unknown) => Promise<void>;
}

interface MockQueue {
  send: (message: unknown) => Promise<void>;
}

interface MockContext {
  env: {
    KV: MockKV;
    PUBLISH_QUEUE: MockQueue;
    CALLAI_API_KEY?: string;
  };
  get: (key: string) => { email: string; userId: string };
  req: {
    json: () => Promise<unknown>;
  };
  json: (
    data: unknown,
    status?: number,
  ) => { body: string; init: { status: number } };
}

describe("Queue functionality", () => {
  let mockKV: MockKV;
  let mockQueue: MockQueue;
  let mockContext: MockContext;

  beforeEach(() => {
    // Mock KV
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
    };

    // Mock queue
    mockQueue = {
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
    vi.clearAllMocks();
  });

  it("should send app_created event to queue for new app", async () => {
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
        userId: "user-123",
      },
    };

    // Spy on getValidatedData
    vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(
      mockData as {
        body: {
          chatId: string;
          code: string;
          title: string;
          userId: string;
          remixOf?: string;
        };
      },
    );

    // Call the handler
    const result = await appCreate.handle(mockContext);

    // Verify queue was called
    expect(mockQueue.send).toHaveBeenCalledOnce();

    // Get the queue message
    const queueMessage = mockQueue.send.mock.calls[0][0];

    // Validate the message structure
    const validationResult = PublishEvent.safeParse(queueMessage);
    expect(validationResult.success).toBe(true);

    if (validationResult.success) {
      const event = validationResult.data;
      expect(event.type).toBe("app_created");
      expect(event.app.code).toBe("console.log('hello');");
      expect(event.app.title).toBe("Test App");
      expect(event.app.userId).toBe("user-123");
      expect(event.app.summary).toBeNull();
      expect(event.app.hasIcon).toBe(false);
      expect(event.metadata.isUpdate).toBe(false);
      expect(event.metadata.timestamp).toBeTypeOf("number");
    }

    // Verify the API response
    expect(result.success).toBe(true);
    expect(result.app).toBeDefined();
  });

  it("should send app_updated event to queue for existing app", async () => {
    // Mock KV to return existing app
    const existingApp = {
      name: "existing-app",
      slug: "test-slug",
      code: "old code",
      chatId: "test-chat-456",
      userId: "test-user-123", // Same user as in mock context to pass ownership check
      updateCount: 2,
      title: "Existing App",
    };

    mockKV.get.mockResolvedValue(JSON.stringify(existingApp));
    mockKV.put.mockResolvedValue(undefined);

    const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

    // Mock the getValidatedData method
    const mockData = {
      body: {
        chatId: "test-chat-456",
        code: "console.log('updated code');",
        title: "Updated App",
        userId: "test-user-123", // Same user as in mock context to pass ownership check
      },
    };

    // Spy on getValidatedData
    vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(
      mockData as {
        body: {
          chatId: string;
          code: string;
          title: string;
          userId: string;
          remixOf?: string;
        };
      },
    );

    // Call the handler
    const result = await appCreate.handle(mockContext);

    // Verify queue was called
    expect(mockQueue.send).toHaveBeenCalledOnce();

    // Get the queue message
    const queueMessage = mockQueue.send.mock.calls[0][0];

    // Validate the message structure
    const validationResult = PublishEvent.safeParse(queueMessage);
    expect(validationResult.success).toBe(true);

    if (validationResult.success) {
      const event = validationResult.data;
      expect(event.type).toBe("app_updated");
      expect(event.app.code).toBe("console.log('updated code');");
      expect(event.app.title).toBe("Updated App");
      expect(event.app.updateCount).toBe(3); // Should be incremented
      expect(event.metadata.isUpdate).toBe(true);
      expect(event.metadata.timestamp).toBeTypeOf("number");
    }

    // Verify the API response
    expect(result.success).toBe(true);
    expect(result.app).toBeDefined();
  });

  it("should handle queue send failure gracefully", async () => {
    // Mock KV to return no existing app
    mockKV.get.mockResolvedValue(null);
    mockKV.put.mockResolvedValue(undefined);

    // Mock queue to fail
    mockQueue.send.mockRejectedValue(new Error("Queue send failed"));

    // Spy on console.error to verify error logging
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // Mock implementation - intentionally empty
    });

    const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

    // Mock the getValidatedData method
    const mockData = {
      body: {
        chatId: "test-chat-789",
        code: "console.log('queue fail test');",
        title: "Queue Fail Test",
        userId: "user-789",
      },
    };

    // Spy on getValidatedData
    vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(
      mockData as {
        body: {
          chatId: string;
          code: string;
          title: string;
          userId: string;
          remixOf?: string;
        };
      },
    );

    // Call the handler
    const result = await appCreate.handle(mockContext);

    // Verify queue was called but failed
    expect(mockQueue.send).toHaveBeenCalledOnce();

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error sending to queue:",
      expect.any(Error),
    );

    // Verify the API still returns success (queue failure doesn't break app creation)
    expect(result.success).toBe(true);
    expect(result.app).toBeDefined();

    // Clean up spy
    consoleSpy.mockRestore();
  });

  it("should include remix information in queue event", async () => {
    // Mock KV to return no existing app
    mockKV.get.mockResolvedValue(null);
    mockKV.put.mockResolvedValue(undefined);

    const appCreate = new AppCreate({ schema: {} } as OpenAPIRoute);

    // Mock the getValidatedData method for a remix
    const mockData = {
      body: {
        chatId: "test-chat-remix",
        code: "console.log('remix code');",
        title: "Remix App",
        userId: "user-remix",
        remixOf: "original-app-slug",
      },
    };

    // Spy on getValidatedData
    vi.spyOn(appCreate, "getValidatedData").mockResolvedValue(
      mockData as {
        body: {
          chatId: string;
          code: string;
          title: string;
          userId: string;
          remixOf?: string;
        };
      },
    );

    // Call the handler
    await appCreate.handle(mockContext);

    // Verify queue was called
    expect(mockQueue.send).toHaveBeenCalledOnce();

    // Get the queue message
    const queueMessage = mockQueue.send.mock.calls[0][0];

    // Validate the message structure
    const validationResult = PublishEvent.safeParse(queueMessage);
    expect(validationResult.success).toBe(true);

    if (validationResult.success) {
      const event = validationResult.data;
      expect(event.app.remixOf).toBe("original-app-slug");
    }
  });
});
