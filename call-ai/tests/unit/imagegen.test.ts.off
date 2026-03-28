import { vitest, describe, it, expect, beforeEach, beforeAll, assert } from "vitest";
import { imageGen } from "call-ai";

// Mock fetch
const mock = {
  fetch: vitest.fn(),
  Blob: vitest.fn(),
  File: vitest.fn(),
  FormData: {
    append: vitest.fn(),
    delete: vitest.fn(),
    get: vitest.fn(),
    getAll: vitest.fn(),
    has: vitest.fn(),
    set: vitest.fn(),
  },
};

// Create mock objects in setup to avoid TypeScript errors
// let mockBlobInstance: any;
// let mockFileInstance: any;

// Setup mock constructors and instances
beforeAll(() => {
  // Create mock instances that will be returned when 'new' is called
  const mockBlobInstance = {
    size: 0,
    type: "image/png",
    arrayBuffer: vitest.fn().mockResolvedValue(new ArrayBuffer(0)),
    text: vitest.fn().mockResolvedValue("mock text"),
  };

  const mockFileInstance = {
    name: "mock-file.png",
    type: "image/png",
    size: 0,
    lastModified: Date.now(),
  };

  // Use a simple class implementation that Jest's objectContaining can properly match
  // class MockFormData {
  //   append = vitest.fn();
  //   delete = vitest.fn();
  //   get = vitest.fn();
  //   getAll = vitest.fn();
  //   has = vitest.fn();
  //   set = vitest.fn();
  // }

  // Mock constructors
  mock.Blob.mockImplementation(() => mockBlobInstance); //as any;
  mock.File.mockImplementation((_, name, options) => {
    return { ...mockFileInstance, name, type: options?.type || "image/png" };
  }); //as any;

  // For FormData, create a new instance each time
  // mock.FormData = MockFormData as unknown as typeof FormData;
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
    vitest.clearAllMocks();
    mock.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vitest.fn().mockResolvedValue(mockImageResponse),
      text: vitest.fn().mockResolvedValue(JSON.stringify(mockImageResponse)),
    });
  });

  it("should make POST request with correct parameters for image generation", async () => {
    const prompt = "A children's book drawing of a veterinarian using a stethoscope to listen to the heartbeat of a baby otter.";
    const options = {
      apiKey: "VIBES_DIY",
      model: "gpt-image-1",
      debug: true,
      mock,
    };

    const result = await imageGen(prompt, options);

    // Check that fetch was called with the correct parameters
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    const [url, optionsArg] = mock.fetch.mock.calls[0];

    expect(url).toContain("/api/openrouter-image/generate");
    expect(optionsArg.method).toBe("POST");

    // Check headers
    const headers = optionsArg.headers;
    expect(headers).toBeDefined();
    if (headers instanceof Headers) {
      expect(headers.get("Authorization")).toBe("Bearer VIBES_DIY");
      expect(headers.get("Content-Type")).toBe("application/json");
    } else {
      // Fallback if headers is a plain object (though likely Headers in this env)
      expect(headers["Authorization"]).toBe("Bearer VIBES_DIY");
      expect(headers["Content-Type"]).toBe("application/json");
    }

    // Check request body
    const requestBody = JSON.parse(optionsArg.body);
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
      mock,
    };

    const result = await imageGen(prompt, options);

    // Check that fetch was called with the correct parameters
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    const [url, optionsArg] = mock.fetch.mock.calls[0];

    expect(url).toContain("/api/openrouter-image/edit");
    expect(optionsArg.method).toBe("POST");

    // Check headers
    const headers = optionsArg.headers;
    expect(headers).toBeDefined();
    if (headers instanceof Headers) {
      expect(headers.get("Authorization")).toBe("Bearer VIBES_DIY");
      // Content-Type should NOT be set manually for FormData (browser sets it with boundary)
      // or if it is set, it might be multipart/form-data
    } else {
      expect(headers["Authorization"]).toBe("Bearer VIBES_DIY");
    }

    expect(optionsArg.body).toBeInstanceOf(FormData);

    // Check response structure
    expect(result).toEqual(mockImageResponse);
    expect(result.data[0].b64_json).toBeDefined();
  });

  it("should handle errors from the image generation API", async () => {
    // Mock a failed response
    mock.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: vitest.fn().mockResolvedValue(JSON.stringify({ error: "Invalid prompt" })),
    });

    const prompt = "This prompt will cause an error";

    try {
      await imageGen(prompt, { apiKey: "VIBES_DIY", mock });
      assert.fail("Expected the image generation to throw an error");
    } catch (error) {
      expect((error as Error).message).toContain("Image generation failed");
      expect((error as Error).message).toContain("400 Bad Request");
    }
  });

  it("should handle errors from the image editing API", async () => {
    // Mock a failed response
    mock.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: vitest.fn().mockResolvedValue(JSON.stringify({ error: "Invalid image format" })),
    });

    const prompt = "This will trigger an error";
    const mockImageBlob = new Blob(["fake image data"], { type: "image/png" });
    const mockFiles = [new File([mockImageBlob], "invalid.png", { type: "image/png" })];

    try {
      await imageGen(prompt, {
        apiKey: "VIBES_DIY",
        images: mockFiles,
        mock,
      });
      assert.fail("Expected the image editing to throw an error");
    } catch (error) {
      expect((error as Error).message).toContain("Image editing failed");
      expect((error as Error).message).toContain("400 Bad Request");
    }
  });

  it("should use custom endpoint when provided for image generation", async () => {
    const prompt = "A beautiful sunset over mountains";
    const customEndpoint = "https://api.openai.com/v1/images/generations";
    const options = {
      apiKey: "sk-test-openai-key",
      model: "dall-e-3",
      size: "1024x1024",
      endpoint: customEndpoint,
      debug: true,
      mock,
    };

    const result = await imageGen(prompt, options);

    // Check that fetch was called with the custom endpoint
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    const [url, optionsArg] = mock.fetch.mock.calls[0];

    // Verify the custom endpoint was used directly, not the default vibes.diy endpoint
    expect(url).toBe(customEndpoint);
    expect(url).not.toContain("vibes-diy-api.com");
    expect(url).not.toContain("/api/openrouter-image/generate");

    // Verify the request was made with correct headers
    const headers = optionsArg.headers;
    expect(headers).toBeDefined();
    if (headers instanceof Headers) {
      expect(headers.get("Authorization")).toBe("Bearer sk-test-openai-key");
      expect(headers.get("Content-Type")).toBe("application/json");
    }

    // Verify request body
    const requestBody = JSON.parse(optionsArg.body);
    expect(requestBody).toEqual({
      model: "dall-e-3",
      prompt: "A beautiful sunset over mountains",
      size: "1024x1024",
    });

    // Check response
    expect(result).toEqual(mockImageResponse);
  });

  it("should use custom endpoint when provided for image editing", async () => {
    const prompt = "Edit this image to add a rainbow";
    const customEndpoint = "https://api.openai.com/v1/images/edits";
    const mockImageBlob = new Blob(["fake image data"], { type: "image/png" });
    const mockFiles = [new File([mockImageBlob], "image.png", { type: "image/png" })];

    const options = {
      apiKey: "sk-test-openai-key",
      model: "dall-e-2",
      images: mockFiles,
      size: "512x512",
      endpoint: customEndpoint,
      debug: true,
      mock,
    };

    const result = await imageGen(prompt, options);

    // Check that fetch was called with the custom endpoint
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    const [url, optionsArg] = mock.fetch.mock.calls[0];

    // Verify the custom endpoint was used directly
    expect(url).toBe(customEndpoint);
    expect(url).not.toContain("vibes-diy-api.com");
    expect(url).not.toContain("/api/openrouter-image/edit");

    // Verify the request was made with FormData
    expect(optionsArg.body).toBeInstanceOf(FormData);

    // Check response
    expect(result).toEqual(mockImageResponse);
  });

  it("should fallback to default endpoint when endpoint option is not provided", async () => {
    const prompt = "Test fallback behavior";
    const options = {
      apiKey: "VIBES_DIY",
      model: "gpt-image-1",
      debug: true,
      mock,
    };

    await imageGen(prompt, options);

    // Check that fetch was called with the default endpoint
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    const [url] = mock.fetch.mock.calls[0];

    // Should use the default vibes.diy endpoint
    expect(url).toContain("/api/openrouter-image/generate");
  });
});
