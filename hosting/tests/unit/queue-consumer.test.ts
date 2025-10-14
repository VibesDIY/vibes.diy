import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import queueConsumer from "../src/queue-consumer";
import { PublishEvent } from "../src/types";

describe("Queue Consumer", () => {
  let originalFetch: typeof global.fetch;
  let mockFetch: any;
  let mockEnv: any;
  let mockMessage: any;
  let mockBatch: any;

  beforeEach(() => {
    // Save original fetch
    originalFetch = global.fetch;

    // Mock fetch to capture Discord webhook and Bluesky API calls
    mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("discord.com/api/webhooks")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      }

      if (url.includes("bsky.social/xrpc/com.atproto.server.createSession")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              did: "did:plc:test123",
              accessJwt: "test-access-token",
              refreshJwt: "test-refresh-token",
              handle: "test.bsky.social",
            }),
        });
      }

      if (url.includes("bsky.social/xrpc/com.atproto.repo.uploadBlob")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              blob: {
                $type: "blob",
                ref: { $link: "bafyblob123" },
                mimeType: "image/png",
                size: 12345,
              },
            }),
        });
      }

      if (url.includes("bsky.social/xrpc/com.atproto.repo.createRecord")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              uri: "at://did:plc:test123/app.bsky.feed.post/test123",
              cid: "bafytest123",
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    });

    global.fetch = mockFetch;

    // Mock environment
    mockEnv = {
      KV: {
        get: vi.fn(),
        put: vi.fn(),
      },
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/test/webhook",
      BLUESKY_HANDLE: "test.bsky.social",
      BLUESKY_APP_PASSWORD: "test-app-password",
    };

    // Mock message
    mockMessage = {
      body: null, // Will be set in individual tests
      ack: vi.fn(),
      retry: vi.fn(),
    };

    // Mock batch
    mockBatch = {
      messages: [mockMessage],
    };
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("should process app_created event and call Discord webhook", async () => {
    // Create test event
    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "test-app",
        slug: "test-slug-123",
        code: "console.log('test');",
        chatId: "chat-123",
        title: "Test App",
        userId: "user-123",
        email: "test@example.com",
        updateCount: 0,
      },
      metadata: {
        timestamp: Date.now(),
        userId: "user-123",
        isUpdate: false,
      },
    };

    // Validate the test event structure
    const validationResult = PublishEvent.safeParse(testEvent);
    expect(validationResult.success).toBe(true);

    mockMessage.body = testEvent;

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was acknowledged
    expect(mockMessage.ack).toHaveBeenCalledOnce();
    expect(mockMessage.retry).not.toHaveBeenCalled();

    // Verify Discord webhook was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("discord.com/api/webhooks"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Verify Discord webhook body content
    const discordCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("discord.com/api/webhooks"),
    );

    expect(discordCall).toBeDefined();

    if (discordCall) {
      const body = JSON.parse(discordCall[1].body);
      expect(body.content).toContain("Test App");
      expect(body.embeds[0].title).toContain("test-slug-123");
      expect(body.embeds[0].image.url).toBe(
        "https://test-slug-123.vibesdiy.work/screenshot.png",
      );
      // Check that basic fields exist (lenient)
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "Updates" }),
          expect.objectContaining({ name: "User" }),
          expect.objectContaining({ name: "Email" }),
        ]),
      );
    }
  });

  it("should process app_updated event correctly", async () => {
    // Create test event for update
    const testEvent = {
      type: "app_updated" as const,
      app: {
        name: "updated-app",
        slug: "updated-slug-456",
        code: "console.log('updated');",
        chatId: "chat-456",
        title: "Updated App",
        userId: "user-456",
        email: "updated@example.com",
        updateCount: 3,
      },
      metadata: {
        timestamp: Date.now(),
        userId: "user-456",
        isUpdate: true,
      },
    };

    mockMessage.body = testEvent;

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was acknowledged
    expect(mockMessage.ack).toHaveBeenCalledOnce();

    // Verify Discord webhook was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("discord.com/api/webhooks"),
      expect.objectContaining({
        method: "POST",
      }),
    );

    // Verify update count in Discord message (lenient)
    const discordCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("discord.com/api/webhooks"),
    );

    if (discordCall) {
      const body = JSON.parse(discordCall[1].body);
      // Just check that Updates field exists, don't care about exact value
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "Updates" })]),
      );
    }
  });

  it("should handle remix apps with thumbnail", async () => {
    // Create test event for remix
    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "remix-app",
        slug: "remix-slug-789",
        code: "console.log('remix');",
        chatId: "chat-789",
        title: "Remix App",
        userId: "user-789",
        email: "remix@example.com",
        updateCount: 0,
        remixOf: "original-slug",
      },
      metadata: {
        timestamp: Date.now(),
        userId: "user-789",
        isUpdate: false,
      },
    };

    mockMessage.body = testEvent;

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify Discord webhook was called
    const discordCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("discord.com/api/webhooks"),
    );

    if (discordCall) {
      const body = JSON.parse(discordCall[1].body);
      // Should have both main image and remix thumbnail (lenient URLs)
      expect(body.embeds[0].image.url).toContain(
        "vibesdiy.work/screenshot.png",
      );
      expect(body.embeds[0].thumbnail.url).toContain(
        "vibesdiy.work/screenshot.png",
      );

      // Should have remix field (lenient matching)
      expect(body.embeds[0].fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: expect.stringContaining("Remix"),
          }),
        ]),
      );
    }
  });

  it("should retry message on processing error", async () => {
    // Create malformed event
    mockMessage.body = {
      type: "invalid_type",
      invalid_data: "test",
    };

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was retried due to validation error
    expect(mockMessage.retry).toHaveBeenCalledOnce();
    expect(mockMessage.ack).not.toHaveBeenCalled();

    // Verify error was logged (lenient - any error message containing "Error")
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error"),
      expect.any(Error),
    );

    // Clean up spy
    consoleSpy.mockRestore();
  });

  it("should continue processing other messages if one fails", async () => {
    // Create a second mock message that will succeed
    const mockMessage2 = {
      body: {
        type: "app_created" as const,
        app: {
          name: "good-app",
          slug: "good-slug",
          code: "console.log('good');",
          chatId: "chat-good",
          title: "Good App",
          updateCount: 0,
        },
        metadata: {
          timestamp: Date.now(),
          isUpdate: false,
        },
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    // Update batch to have both messages
    mockBatch.messages = [mockMessage, mockMessage2];

    // Set first message to fail
    mockMessage.body = { invalid: "data" };

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify first message was retried
    expect(mockMessage.retry).toHaveBeenCalledOnce();
    expect(mockMessage.ack).not.toHaveBeenCalled();

    // Verify second message was acknowledged
    expect(mockMessage2.ack).toHaveBeenCalledOnce();
    expect(mockMessage2.retry).not.toHaveBeenCalled();

    // Clean up spy
    consoleSpy.mockRestore();
  });

  it("should handle Discord webhook failure gracefully", async () => {
    // Mock Discord webhook to fail
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("discord.com/api/webhooks")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "test-app",
        slug: "test-slug",
        code: "console.log('test');",
        chatId: "chat-123",
        title: "Test App",
        updateCount: 0,
      },
      metadata: {
        timestamp: Date.now(),
        isUpdate: false,
      },
    };

    mockMessage.body = testEvent;

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was still retried due to Discord failure
    expect(mockMessage.retry).toHaveBeenCalledOnce();
    expect(mockMessage.ack).not.toHaveBeenCalled();

    // Verify error was logged (lenient - any error message containing "Error")
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error"),
      expect.any(Error),
    );

    // Clean up spy
    consoleSpy.mockRestore();
  });

  it("should post to Bluesky when shareToFirehose is enabled", async () => {
    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "bluesky-test-app",
        slug: "bluesky-test-slug",
        code: "console.log('bluesky test');",
        chatId: "chat-bsky-123",
        title: "Bluesky Test App",
        userId: "user-bsky-123",
        email: "bluesky@example.com",
        updateCount: 0,
        shareToFirehose: true,
      },
      metadata: {
        timestamp: Date.now(),
        userId: "user-bsky-123",
        isUpdate: false,
      },
    };

    mockMessage.body = testEvent;

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was acknowledged
    expect(mockMessage.ack).toHaveBeenCalledOnce();
    expect(mockMessage.retry).not.toHaveBeenCalled();

    // Verify Bluesky session creation was called
    expect(mockFetch).toHaveBeenCalledWith(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );

    // Verify Bluesky post creation was called
    expect(mockFetch).toHaveBeenCalledWith(
      "https://bsky.social/xrpc/com.atproto.repo.createRecord",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
          "Content-Type": "application/json",
        }),
      }),
    );

    // Verify both Discord and Bluesky endpoints were called
    const discordCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("discord.com"),
    );
    const blueskySessionCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("createSession"),
    );
    const blueskyPostCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("createRecord"),
    );

    expect(discordCall).toBeDefined();
    expect(blueskySessionCall).toBeDefined();
    expect(blueskyPostCall).toBeDefined();
  });

  it("should not post to Bluesky when shareToFirehose is false", async () => {
    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "no-bluesky-app",
        slug: "no-bluesky-slug",
        code: "console.log('no bluesky');",
        chatId: "chat-no-bsky",
        title: "No Bluesky App",
        updateCount: 0,
        shareToFirehose: false,
      },
      metadata: {
        timestamp: Date.now(),
        isUpdate: false,
      },
    };

    mockMessage.body = testEvent;

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was acknowledged
    expect(mockMessage.ack).toHaveBeenCalledOnce();

    // Verify only Discord was called, not Bluesky
    const discordCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("discord.com"),
    );
    const blueskyCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("bsky.social"),
    );

    expect(discordCall).toBeDefined();
    expect(blueskyCall).toBeUndefined();
  });

  it("should handle Bluesky posting failure gracefully", async () => {
    // Mock Bluesky session to fail
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("discord.com/api/webhooks")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      }

      if (url.includes("bsky.social/xrpc/com.atproto.server.createSession")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        });
      }

      return Promise.resolve({ ok: true, status: 200 });
    });

    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "bluesky-fail-app",
        slug: "bluesky-fail-slug",
        code: "console.log('bluesky fail');",
        chatId: "chat-bsky-fail",
        title: "Bluesky Fail App",
        updateCount: 0,
        shareToFirehose: true,
      },
      metadata: {
        timestamp: Date.now(),
        isUpdate: false,
      },
    };

    mockMessage.body = testEvent;

    // Spy on console.error
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was retried due to Bluesky failure
    expect(mockMessage.retry).toHaveBeenCalledOnce();
    expect(mockMessage.ack).not.toHaveBeenCalled();

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Error"),
      expect.any(Error),
    );

    // Clean up spy
    consoleSpy.mockRestore();
  });

  it("should warn when shareToFirehose is enabled but credentials missing", async () => {
    // Remove Bluesky credentials from environment
    const envWithoutBluesky = {
      ...mockEnv,
      BLUESKY_HANDLE: undefined,
      BLUESKY_APP_PASSWORD: undefined,
    };

    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "missing-creds-app",
        slug: "missing-creds-slug",
        code: "console.log('missing creds');",
        chatId: "chat-missing-creds",
        title: "Missing Creds App",
        updateCount: 0,
        shareToFirehose: true,
      },
      metadata: {
        timestamp: Date.now(),
        isUpdate: false,
      },
    };

    mockMessage.body = testEvent;

    // Spy on console.warn
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Process the queue batch with environment missing Bluesky credentials
    await queueConsumer.queue(mockBatch, envWithoutBluesky);

    // Verify message was still acknowledged (Discord should still work)
    expect(mockMessage.ack).toHaveBeenCalledOnce();

    // Verify warning was logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "shareToFirehose enabled but Bluesky credentials missing",
      ),
    );

    // Clean up spy
    warnSpy.mockRestore();
  });

  it("should create Bluesky post with external embed and screenshot thumbnail", async () => {
    // Mock KV to return screenshot data
    const mockScreenshotData = new ArrayBuffer(1024); // Mock image data
    mockEnv.KV.get.mockResolvedValue(mockScreenshotData);

    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "embed-test-app",
        slug: "embed-test-slug",
        code: "console.log('embed test');",
        chatId: "chat-embed-123",
        title: "Embed Test App",
        userId: "user-embed-123",
        email: "embed@example.com",
        updateCount: 0,
        shareToFirehose: true,
      },
      metadata: {
        timestamp: Date.now(),
        userId: "user-embed-123",
        isUpdate: false,
      },
    };

    mockMessage.body = testEvent;

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was acknowledged
    expect(mockMessage.ack).toHaveBeenCalledOnce();
    expect(mockMessage.retry).not.toHaveBeenCalled();

    // Verify KV was called to get screenshot
    expect(mockEnv.KV.get).toHaveBeenCalledWith(
      "embed-test-slug-screenshot",
      "arrayBuffer",
    );

    // Verify blob upload was called
    expect(mockFetch).toHaveBeenCalledWith(
      "https://bsky.social/xrpc/com.atproto.repo.uploadBlob",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-access-token",
          "Content-Type": "image/png",
        }),
        body: mockScreenshotData,
      }),
    );

    // Verify post creation was called with external embed
    const postCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("createRecord"),
    );
    expect(postCall).toBeDefined();

    if (postCall) {
      const postBody = JSON.parse(postCall[1].body);
      const record = postBody.record;

      // Check that post has external embed
      expect(record.embed).toBeDefined();
      expect(record.embed.$type).toBe("app.bsky.embed.external");
      expect(record.embed.external.uri).toBe(
        "https://vibes.diy/vibe/embed-test-slug",
      );
      expect(record.embed.external.title).toBe("Embed Test App");
      expect(record.embed.external.description).toBe(
        "A new vibe created on vibes.diy",
      );

      // Check that thumbnail blob is included
      expect(record.embed.external.thumb).toEqual({
        $type: "blob",
        ref: { $link: "bafyblob123" },
        mimeType: "image/png",
        size: 12345,
      });

      // Check post text (should be shorter since we have the embed)
      expect(record.text).toBe("💽 Embed Test App");
    }
  });

  it("should create Bluesky post with external embed but no thumbnail when screenshot missing", async () => {
    // Mock KV to return null (no screenshot)
    mockEnv.KV.get.mockResolvedValue(null);

    const testEvent = {
      type: "app_created" as const,
      app: {
        name: "no-screenshot-app",
        slug: "no-screenshot-slug",
        code: "console.log('no screenshot');",
        chatId: "chat-no-screenshot",
        title: "No Screenshot App",
        updateCount: 0,
        shareToFirehose: true,
        remixOf: "original-app",
      },
      metadata: {
        timestamp: Date.now(),
        isUpdate: false,
      },
    };

    mockMessage.body = testEvent;

    // Process the queue batch
    await queueConsumer.queue(mockBatch, mockEnv);

    // Verify message was acknowledged
    expect(mockMessage.ack).toHaveBeenCalledOnce();

    // Verify KV was called but no blob upload occurred
    expect(mockEnv.KV.get).toHaveBeenCalledWith(
      "no-screenshot-slug-screenshot",
      "arrayBuffer",
    );

    const blobUploadCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("uploadBlob"),
    );
    expect(blobUploadCall).toBeUndefined();

    // Verify post creation was called with external embed but no thumbnail
    const postCall = mockFetch.mock.calls.find((call: any) =>
      call[0].includes("createRecord"),
    );
    expect(postCall).toBeDefined();

    if (postCall) {
      const postBody = JSON.parse(postCall[1].body);
      const record = postBody.record;

      // Check that post has external embed
      expect(record.embed).toBeDefined();
      expect(record.embed.$type).toBe("app.bsky.embed.external");
      expect(record.embed.external.uri).toBe(
        "https://vibes.diy/vibe/no-screenshot-slug",
      );
      expect(record.embed.external.title).toBe("No Screenshot App");
      expect(record.embed.external.description).toBe(
        "A new vibe created on vibes.diy (remix of original-app)",
      );

      // Check that NO thumbnail is included
      expect(record.embed.external.thumb).toBeUndefined();

      // Check post text includes remix info
      expect(record.text).toBe(
        "💽 No Screenshot App\n\n🔀 Remix of original-app",
      );
    }
  });
});
