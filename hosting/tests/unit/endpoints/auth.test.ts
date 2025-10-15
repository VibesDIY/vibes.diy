import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  OpenRouterChat,
  ClaudeChat,
  ImageGenerate,
  ImageEdit,
} from "@vibes.diy/hosting";

describe("AI Endpoints Authentication", () => {
  let mockContext: {
    env: {
      SERVER_OPENROUTER_API_KEY?: string;
      ANTHROPIC_API_KEY?: string;
      OPENAI_API_KEY?: string;
    };
    get: (key: string) => unknown;
    req: {
      json: () => Promise<unknown>;
      formData: () => Promise<FormData>;
      header: (name: string) => string | undefined;
    };
    json: (data: unknown, status?: number) => Response;
  };

  beforeEach(() => {
    // Mock context with authentication
    mockContext = {
      env: {
        SERVER_OPENROUTER_API_KEY: "test-openrouter-key",
        ANTHROPIC_API_KEY: "test-claude-key",
        OPENAI_API_KEY: "test-openai-key",
      },
      get: vi.fn(),
      req: {
        json: vi.fn(),
        formData: vi.fn(),
        header: vi.fn(),
      },
      json: vi
        .fn()
        .mockImplementation(
          (data, status) => new Response(JSON.stringify(data), { status }),
        ),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("OpenRouterChat", () => {
    it("should reject unauthenticated requests with proxy-managed key", async () => {
      // Mock unauthenticated user
      vi.mocked(mockContext.get).mockReturnValue(null);
      vi.mocked(mockContext.req.json).mockResolvedValue({
        model: "anthropic/claude-3-opus",
        messages: [{ role: "user", content: "test" }],
      });
      vi.mocked(mockContext.req.header).mockImplementation((name) => {
        if (name === "Authorization") return "Bearer sk-vibes-proxy-managed";
        if (name === "cf-connecting-ip") return "127.0.0.1";
        return undefined;
      });

      const endpoint = new OpenRouterChat();
      await endpoint.handle(mockContext as unknown);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            message:
              "Authentication required. Please log in to use AI features.",
            type: "authentication_error",
            code: 401,
          },
        },
        401,
      );
    });

    it("should allow authenticated requests with proxy-managed key", async () => {
      // Mock authenticated user
      vi.mocked(mockContext.get).mockReturnValue({ userId: "user123" });
      vi.mocked(mockContext.req.json).mockResolvedValue({
        model: "anthropic/claude-3-opus",
        messages: [{ role: "user", content: "test" }],
      });
      vi.mocked(mockContext.req.header).mockImplementation((name) => {
        if (name === "Authorization") return "Bearer sk-vibes-proxy-managed";
        if (name === "cf-connecting-ip") return "127.0.0.1";
        return undefined;
      });

      // Mock global fetch for OpenRouter API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "test response" } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
      });

      const endpoint = new OpenRouterChat();
      await endpoint.handle(mockContext as unknown);

      // Should not call json with error response
      expect(mockContext.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: "authentication_error",
          }),
        }),
        401,
      );
    });

    it("should allow user-provided API keys without authentication", async () => {
      // Mock unauthenticated user but with user's own API key
      vi.mocked(mockContext.get).mockReturnValue(null);
      vi.mocked(mockContext.req.json).mockResolvedValue({
        model: "anthropic/claude-3-opus",
        messages: [{ role: "user", content: "test" }],
      });
      vi.mocked(mockContext.req.header).mockImplementation((name) => {
        if (name === "Authorization") return "Bearer sk-user-provided-key";
        if (name === "cf-connecting-ip") return "127.0.0.1";
        return undefined;
      });

      // Mock global fetch for OpenRouter API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: "test response" } }],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 5,
              total_tokens: 15,
            },
          }),
      });

      const endpoint = new OpenRouterChat();
      await endpoint.handle(mockContext as unknown);

      // Should not call json with error response
      expect(mockContext.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: "authentication_error",
          }),
        }),
        401,
      );
    });
  });

  describe("ClaudeChat", () => {
    it("should reject unauthenticated requests", async () => {
      // Mock unauthenticated user
      vi.mocked(mockContext.get).mockReturnValue(null);
      vi.mocked(mockContext.req.json).mockResolvedValue({
        model: "claude-3-opus-20240229",
        messages: [{ role: "user", content: "test" }],
      });

      const endpoint = new ClaudeChat();
      const _response = await endpoint.handle(mockContext as unknown);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            message:
              "Authentication required. Please log in to use AI features.",
            type: "authentication_error",
            code: 401,
          },
        },
        401,
      );
    });

    it("should allow authenticated requests", async () => {
      // Mock authenticated user
      vi.mocked(mockContext.get).mockReturnValue({ userId: "user123" });
      vi.mocked(mockContext.req.json).mockResolvedValue({
        model: "claude-3-opus-20240229",
        messages: [{ role: "user", content: "test" }],
      });

      // Mock global fetch for Claude API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "msg_123",
            content: [{ type: "text", text: "test response" }],
            usage: { input_tokens: 10, output_tokens: 5 },
          }),
      });

      const endpoint = new ClaudeChat();
      await endpoint.handle(mockContext as unknown);

      // Should not call json with error response
      expect(mockContext.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: "authentication_error",
          }),
        }),
        401,
      );
    });
  });

  describe("ImageGenerate", () => {
    it("should reject unauthenticated requests", async () => {
      // Mock unauthenticated user
      vi.mocked(mockContext.get).mockReturnValue(null);
      vi.mocked(mockContext.req.json).mockResolvedValue({
        prompt: "a beautiful sunset",
      });

      const endpoint = new ImageGenerate();
      const _response = await endpoint.handle(mockContext as unknown);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            message:
              "Authentication required. Please log in to use AI features.",
            type: "authentication_error",
            code: 401,
          },
        },
        401,
      );
    });

    it("should allow authenticated requests", async () => {
      // Mock authenticated user
      vi.mocked(mockContext.get).mockReturnValue({ userId: "user123" });
      vi.mocked(mockContext.req.json).mockResolvedValue({
        prompt: "a beautiful sunset",
      });

      // Mock global fetch for OpenAI API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            created: Date.now(),
            data: [{ url: "https://example.com/image.png" }],
          }),
      });

      const endpoint = new ImageGenerate();
      await endpoint.handle(mockContext as unknown);

      // Should not call json with error response
      expect(mockContext.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: "authentication_error",
          }),
        }),
        401,
      );
    });
  });

  describe("ImageEdit", () => {
    it("should reject unauthenticated requests", async () => {
      // Mock unauthenticated user
      vi.mocked(mockContext.get).mockReturnValue(null);

      const mockFormData = new FormData();
      mockFormData.append("prompt", "edit this image");
      vi.mocked(mockContext.req.formData).mockResolvedValue(mockFormData);

      const endpoint = new ImageEdit();
      const _response = await endpoint.handle(mockContext as unknown);

      expect(mockContext.json).toHaveBeenCalledWith(
        {
          error: {
            message:
              "Authentication required. Please log in to use AI features.",
            type: "authentication_error",
            code: 401,
          },
        },
        401,
      );
    });

    it("should allow authenticated requests", async () => {
      // Mock authenticated user
      vi.mocked(mockContext.get).mockReturnValue({ userId: "user123" });

      const mockFormData = new FormData();
      mockFormData.append("prompt", "edit this image");
      vi.mocked(mockContext.req.formData).mockResolvedValue(mockFormData);

      // Mock global fetch for OpenAI API call
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            created: Date.now(),
            data: [{ url: "https://example.com/edited-image.png" }],
          }),
      });

      const endpoint = new ImageEdit();
      await endpoint.handle(mockContext as unknown);

      // Should not call json with error response
      expect(mockContext.json).not.toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            type: "authentication_error",
          }),
        }),
        401,
      );
    });
  });
});
