import { imageGen } from "call-ai";
import { dotenv } from "zx";
import { HttpHeader } from "@adviser/cement";
import { describe, beforeEach, it, expect, vi } from "vitest";

// Configure fetch mock
const global = globalThis;
const globalFetch = vi.fn<typeof fetch>();
global.fetch = globalFetch;
//fetchMock.enableMocks();

// Load environment variables from .env file if present
dotenv.config();

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
    globalFetch.mockClear();
  });

  it("should generate an image with a text prompt", async () => {
    // Set up fetch mock for image generation

    globalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue(mockImageResponse),
      text: vi.fn().mockResolvedValue(JSON.stringify(mockImageResponse)),
      headers: HttpHeader.from({ "Content-Type": "application/json" }).AsHeaders(),
    } as unknown as Response);

    // Generate test prompt
    const testPrompt =
      "A children's book drawing of a veterinarian using a stethoscope to listen to the heartbeat of a baby otter.";

    // Call the imageGen function
    const result = await imageGen(testPrompt, {
      apiKey: "VIBES_DIY",
      debug: true,
    });

    // Verify the structure of the response
    expect(result).toBeDefined();
    expect(result.created).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].b64_json).toBeDefined();

    // Verify base64 image data exists
    const imageBase64 = result.data[0].b64_json;
    expect(typeof imageBase64).toBe("string");
    expect(imageBase64.length).toBeGreaterThan(0);

    // Verify the request was made correctly
    expect(globalFetch).toHaveBeenCalledTimes(1);
    const fetchCall = globalFetch.mock.calls[0];
    expect(fetchCall[0]).toMatch(/.*\/api\/openai-image\/generate$/);
    expect(fetchCall[1]?.method).toBe("POST");
    expect(fetchCall[1]?.headers).toBeInstanceOf(Headers);
    expect((fetchCall[1]?.headers as Headers).get("Authorization")).toBe("Bearer VIBES_DIY");
    expect((fetchCall[1]?.headers as Headers).get("Content-Type")).toBe("application/json");
    // Ensure token header is absent by default
    expect((fetchCall[1]?.headers as Headers).has("X-VIBES-Token")).toBe(false);
    expect(typeof fetchCall[1]?.body).toBe("string");

    // Verify request body content
    const mockCall = globalFetch.mock.calls[0];
    const requestBody = JSON.parse(mockCall[1]?.body as string);
    expect(requestBody.prompt).toBe(testPrompt);
    expect(requestBody.model).toBe("gpt-image-1");

    console.log("Image generation test completed successfully");
  });

  it("should handle image editing with multiple input images", async () => {
    // Set up fetch mock for image editing
    globalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue(mockImageResponse),
      text: vi.fn().mockResolvedValue(JSON.stringify(mockImageResponse)),
      headers: HttpHeader.from({ "Content-Type": "application/json" }).AsHeaders(),
    } as unknown as Response);

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
    });

    // Verify the structure of the response
    expect(result).toBeDefined();
    expect(result.created).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].b64_json).toBeDefined();

    // Verify the request was made correctly
    expect(globalFetch).toHaveBeenCalledTimes(1);
    const fetchCall = globalFetch.mock.calls[0];
    expect(fetchCall[0]).toMatch(/.*\/api\/openai-image\/edit$/);
    expect(fetchCall[1]?.method).toBe("POST");
    expect(fetchCall[1]?.headers).toBeInstanceOf(Headers);
    expect((fetchCall[1]?.headers as Headers).get("Authorization")).toBe("Bearer VIBES_DIY");
    // Ensure token header is absent by default
    expect((fetchCall[1]?.headers as Headers).has("X-VIBES-Token")).toBe(false);
    expect(fetchCall[1]?.body).toBeInstanceOf(FormData);

    console.log("Image editing test completed successfully");
  });

  it("adds X-VIBES-Token when localStorage token is set (generate)", async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue(mockImageResponse),
      text: vi.fn().mockResolvedValue(JSON.stringify(mockImageResponse)),
      headers: HttpHeader.from({ "Content-Type": "application/json" }).AsHeaders(),
    } as unknown as Response);

    const token = "token-abc";
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => (key === "vibes-diy-auth-token" ? token : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true, configurable: true });

    const result = await imageGen("prompt", { apiKey: "VIBES_DIY" });
    expect(result).toBeDefined();

    const fetchCall = globalFetch.mock.calls[0];
    const headers = fetchCall[1]?.headers as Headers;
    expect(headers).toBeInstanceOf(Headers);
    expect(headers.get("X-VIBES-Token")).toBe(token);
  });

  it("adds X-VIBES-Token when localStorage token is set (edit)", async () => {
    globalFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue(mockImageResponse),
      text: vi.fn().mockResolvedValue(JSON.stringify(mockImageResponse)),
      headers: HttpHeader.from({ "Content-Type": "application/json" }).AsHeaders(),
    } as unknown as Response);

    const token = "token-def";
    const mockLocalStorage = {
      getItem: vi.fn((key: string) => (key === "vibes-diy-auth-token" ? token : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    } as unknown as Storage;
    Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true, configurable: true });

    const mockImageBlob = new Blob(["fake"], { type: "image/png" });
    const files = [new File([mockImageBlob], "a.png", { type: "image/png" })];
    const result = await imageGen("prompt", { apiKey: "VIBES_DIY", images: files });
    expect(result).toBeDefined();

    const fetchCall = globalFetch.mock.calls[0];
    const headers = fetchCall[1]?.headers as Headers;
    expect(headers).toBeInstanceOf(Headers);
    expect(headers.get("X-VIBES-Token")).toBe(token);
  });
});
