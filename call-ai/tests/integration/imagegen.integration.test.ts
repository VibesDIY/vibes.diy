/// <reference lib="DOM" />
import { imageGen } from "call-ai";
import { describe, it, expect, vitest, beforeEach } from "vitest";

// Add type declaration for Node.js require
const mock = { fetch: vitest.fn() };

// Configure fetch mock

// Mock response for image generation
const mockImageResponse = {
  created: Date.now(),
  data: [
    {
      b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", // 1x1 px transparent PNG
      revised_prompt: "Generated image based on prompt",
    },
  ],
};

describe("Image Generation Integration Tests", () => {
  beforeEach(() => {
    // Reset fetch mocks before each test
    mock.fetch.mockClear();
  });

  it("should generate an image with a text prompt", async () => {
    // Set up fetch mock for image generation
    mock.fetch.mockResolvedValueOnce({
      json: async () => mockImageResponse,
      text: async () => JSON.stringify(mockImageResponse),
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
    });

    // Generate test prompt
    const testPrompt =
      "A children's book drawing of a veterinarian using a stethoscope to listen to the heartbeat of a baby otter.";

    // Call the imageGen function
    const result = await imageGen(testPrompt, {
      apiKey: "VIBES_DIY",
      debug: true,
      mock,
    });

    // Verify the structure of the response
    expect(result).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].b64_json).toBeDefined();

    // Verify base64 image data exists
    const imageBase64 = result.data[0].b64_json;
    expect(typeof imageBase64).toBe("string");
    expect(imageBase64.length).toBeGreaterThan(0);

    // Verify the request was made correctly
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    const [url, optionsArg] = mock.fetch.mock.calls[0];

    expect(url).toMatch(/.*\/api\/openai-image\/generate$/);
    expect(optionsArg.method).toBe("POST");

    // Check headers
    const headers = optionsArg.headers;
    expect(headers).toBeDefined();
    if (headers instanceof Headers) {
      expect(headers.get("Authorization")).toBe("Bearer VIBES_DIY");
      expect(headers.get("Content-Type")).toBe("application/json");
    } else {
      expect(headers["Authorization"]).toBe("Bearer VIBES_DIY");
      expect(headers["Content-Type"]).toBe("application/json");
    }

    // Verify request body content
    const requestBody = JSON.parse(optionsArg.body);
    expect(requestBody.prompt).toBe(testPrompt);
    expect(requestBody.model).toBe("gpt-image-1");
  });

  it("should handle image editing with multiple input images", async () => {
    // Set up fetch mock for image editing
    mock.fetch.mockResolvedValueOnce({
      json: async () => mockImageResponse,
      text: async () => JSON.stringify(mockImageResponse),
      status: 200,
      ok: true,
      headers: { "Content-Type": "application/json" },
    });

    const testPrompt = "Create a lovely gift basket with these four items in it";

    // Mock implementation for File objects
    const mockImageBlob = new Blob(["fake image data"], { type: "image/png" });
    const mockFiles = [
      new File([mockImageBlob], "image1.png", { type: "image/png" }),
      new File([mockImageBlob], "image2.png", { type: "image/png" }),
    ];

    // Call the imageGen function with mock images
    const result = await imageGen(testPrompt, {
      apiKey: "VIBES_DIY",
      images: mockFiles,
      debug: true,
      mock,
    });

    // Verify the structure of the response
    expect(result).toBeDefined();
    expect(result.created).toBeGreaterThan(0);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].b64_json).toBeDefined();

    // Verify the request was made correctly
    expect(mock.fetch).toHaveBeenCalledTimes(1);
    const [url, optionsArg] = mock.fetch.mock.calls[0];

    expect(url).toMatch(/.*\/api\/openai-image\/edit$/);
    expect(optionsArg.method).toBe("POST");

    // Check headers
    const headers = optionsArg.headers;
    expect(headers).toBeDefined();
    if (headers instanceof Headers) {
      expect(headers.get("Authorization")).toBe("Bearer VIBES_DIY");
    } else {
      expect(headers["Authorization"]).toBe("Bearer VIBES_DIY");
    }

    expect(optionsArg.body).toBeInstanceOf(FormData);
  });
});
