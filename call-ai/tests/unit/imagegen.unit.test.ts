import { imageGen } from "call-ai";
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { fail } from "assert";

// Mock fetch
const global = globalThis;
const globalFetch = vi.fn<typeof fetch>();
global.fetch = globalFetch;

// Create mock objects in setup to avoid TypeScript errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockBlobInstance: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockFileInstance: any;

// Setup mock constructors and instances
beforeAll(() => {
  // Create mock instances that will be returned when 'new' is called
  mockBlobInstance = {
    size: 0,
    type: "image/png",
    arrayBuffer: vi.fn<(typeof mockBlobInstance)["arrayBuffer"]>().mockResolvedValue(new ArrayBuffer(0)),
    text: vi.fn<(typeof mockBlobInstance)["text"]>().mockResolvedValue("mock text"),
  };

  mockFileInstance = {
    name: "mock-file.png",
    type: "image/png",
    size: 0,
    lastModified: Date.now(),
  };

  // Use a simple class implementation that Jest's objectContaining can properly match
  class MockFormData {
    append = vi.fn();
    delete = vi.fn();
    get = vi.fn();
    getAll = vi.fn();
    has = vi.fn();
    set = vi.fn();
  }

  // Mock constructors
  global.Blob = vi.fn(function (blobParts?: BlobPart[], options?: BlobPropertyBag) {
    return { ...mockBlobInstance, type: options?.type || "image/png" };
  }) as unknown as typeof Blob;
  global.File = vi.fn(function (_, name, options?: FilePropertyBag) {
    return { ...mockFileInstance, name, type: options?.type || "image/png" };
  }) as unknown as typeof File;

  // For FormData, create a new instance each time
  global.FormData = MockFormData as unknown as typeof FormData;
});

// Mock response for successful image generation
const mockImageResponse = {
  created: Date.now(),
  data: [
    {
      b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", // 1x1 px transparent PNG
      revised_prompt: "Generated image based on prompt",
    },
  ],
};

describe("imageGen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      json: vi.fn<() => Promise<any>>().mockResolvedValue(mockImageResponse),
      text: vi.fn<() => Promise<string>>().mockResolvedValue(JSON.stringify(mockImageResponse)),
    } as unknown as Response);
  });

  it("should make POST request with correct parameters for image generation", async () => {
    const prompt = "A children's book drawing of a veterinarian using a stethoscope to listen to the heartbeat of a baby otter.";
    const options = {
      apiKey: "VIBES_DIY",
      model: "gpt-image-1",
      debug: true,
    };

    const result = await imageGen(prompt, options);

    // Check that fetch was called with the correct parameters
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = globalFetch.mock.calls[0];
    expect(fetchCall[0]).toBe("https://vibes-diy-api.com/api/openai-image/generate");
    expect(fetchCall[1]?.method).toBe("POST");
    expect(fetchCall[1]?.headers).toBeInstanceOf(Headers);
    expect((fetchCall[1]?.headers as Headers).get("Authorization")).toBe("Bearer VIBES_DIY");
    expect((fetchCall[1]?.headers as Headers).get("Content-Type")).toBe("application/json");

    // Check request body
    const requestBody = JSON.parse(globalFetch.mock.calls[0][1]?.body as string);
    expect(requestBody).toEqual({
      model: "gpt-image-1",
      prompt: "A children's book drawing of a veterinarian using a stethoscope to listen to the heartbeat of a baby otter.",
      size: "1024x1024",
    });

    // Check response structure
    expect(result).toEqual(mockImageResponse);
    expect(result.data[0].b64_json).toBeDefined();
  });

  it("should make POST request with correct parameters for image editing", async () => {
    const prompt = "Create a lovely gift basket with these four items in it";

    // Mock implementation for File objects
    const mockImageBlob = new Blob(["fake image data"], { type: "image/png" });
    const mockFiles = [
      new File([mockImageBlob], "image1.png", { type: "image/png" }),
      new File([mockImageBlob], "image2.png", { type: "image/png" }),
    ];

    const options = {
      apiKey: "VIBES_DIY",
      model: "gpt-image-1",
      images: mockFiles,
      size: "1024x1024",
      debug: true,
    };

    const result = await imageGen(prompt, options);

    // Check that fetch was called with the correct parameters
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = globalFetch.mock.calls[0];
    expect(fetchCall[0]).toBe("https://vibes-diy-api.com/api/openai-image/edit");
    expect(fetchCall[1]?.method).toBe("POST");
    expect(fetchCall[1]?.headers).toBeInstanceOf(Headers);
    expect((fetchCall[1]?.headers as Headers).get("Authorization")).toBe("Bearer VIBES_DIY");
    expect(fetchCall[1]?.body).toBeInstanceOf(FormData);

    // Check response structure
    expect(result).toEqual(mockImageResponse);
    expect(result.data[0].b64_json).toBeDefined();
  });

  it("should handle errors from the image generation API", async () => {
    // Mock a failed response
    globalFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: vi.fn<() => Promise<string>>().mockResolvedValue(JSON.stringify({ error: "Invalid prompt" })),
    } as unknown as Response);

    const prompt = "This prompt will cause an error";

    try {
      await imageGen(prompt, { apiKey: "VIBES_DIY" });
      fail("Expected the image generation to throw an error");
    } catch (error) {
      expect((error as Error).message).toContain("Image generation failed");
      expect((error as Error).message).toContain("400 Bad Request");
    }
  });

  it("should handle errors from the image editing API", async () => {
    // Mock a failed response
    globalFetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: vi.fn<() => Promise<string>>().mockResolvedValue(JSON.stringify({ error: "Invalid image format" })),
    } as unknown as Response);

    const prompt = "This will trigger an error";
    const mockImageBlob = new Blob(["fake image data"], { type: "image/png" });
    const mockFiles = [new File([mockImageBlob], "invalid.png", { type: "image/png" })];

    try {
      await imageGen(prompt, {
        apiKey: "VIBES_DIY",
        images: mockFiles,
      });
      fail("Expected the image editing to throw an error");
    } catch (error) {
      expect((error as Error).message).toContain("Image editing failed");
      expect((error as Error).message).toContain("400 Bad Request");
    }
  });
});
