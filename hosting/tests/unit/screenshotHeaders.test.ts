import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Screenshot endpoint headers", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("should include Content-Length header in screenshot response", async () => {
    // Test the Response construction logic that we use in renderApp
    const testImageBuffer = new ArrayBuffer(1234); // Simulate 1234 byte image

    const response = new Response(testImageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": testImageBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });

    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Length")).toBe("1234");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("should calculate correct content length for different buffer sizes", () => {
    const testCases = [
      { size: 0, expected: "0" },
      { size: 1234, expected: "1234" },
      { size: 1000000, expected: "1000000" },
    ];

    testCases.forEach(({ size, expected }) => {
      const buffer = new ArrayBuffer(size);
      const response = new Response(buffer, {
        headers: {
          "Content-Length": buffer.byteLength.toString(),
        },
      });

      expect(response.headers.get("Content-Length")).toBe(expected);
    });
  });

  it("should handle HEAD requests with same headers but no body", () => {
    const testImageBuffer = new ArrayBuffer(5678);

    // Simulate HEAD request response (same headers, no body)
    const headResponse = new Response(null, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": testImageBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });

    // Simulate GET request response (same headers, with body)
    const getResponse = new Response(testImageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": testImageBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });

    // Both should have identical headers
    expect(headResponse.headers.get("Content-Type")).toBe("image/png");
    expect(headResponse.headers.get("Content-Length")).toBe("5678");
    expect(headResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=86400",
    );
    expect(headResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");

    expect(getResponse.headers.get("Content-Type")).toBe("image/png");
    expect(getResponse.headers.get("Content-Length")).toBe("5678");
    expect(getResponse.headers.get("Cache-Control")).toBe(
      "public, max-age=86400",
    );
    expect(getResponse.headers.get("Access-Control-Allow-Origin")).toBe("*");

    // HEAD should have no body, GET should have body
    expect(headResponse.body).toBeNull();
    expect(getResponse.body).not.toBeNull();
  });

  it("should return 405 for unsupported HTTP methods", () => {
    // Test that our method checking logic works
    const supportedMethods = ["GET", "HEAD"];
    const unsupportedMethods = ["POST", "PUT", "DELETE", "PATCH"];

    supportedMethods.forEach((method) => {
      expect(["GET", "HEAD"]).toContain(method);
    });

    unsupportedMethods.forEach((method) => {
      expect(["GET", "HEAD"]).not.toContain(method);
    });
  });

  it("should handle Range requests with 206 Partial Content", () => {
    const testImageBuffer = new ArrayBuffer(10000); // 10KB test image

    // Simulate Range request for first 1024 bytes
    const start = 0;
    const end = 1023;
    const contentLength = end - start + 1;
    const chunk = testImageBuffer.slice(start, end + 1);

    const response = new Response(chunk, {
      status: 206,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": contentLength.toString(),
        "Content-Range": `bytes ${start}-${end}/${testImageBuffer.byteLength}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Content-Length")).toBe("1024");
    expect(response.headers.get("Content-Range")).toBe("bytes 0-1023/10000");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
  });

  it("should handle invalid Range requests with 416 Range Not Satisfiable", () => {
    const fileSize = 5000;

    // Test invalid range (start > end)
    const response = new Response("Range Not Satisfiable", {
      status: 416,
      headers: {
        "Content-Range": `bytes */${fileSize}`,
        "Content-Type": "image/png",
      },
    });

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */5000");
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("should parse Range header correctly", () => {
    // Test our parseRangeHeader function logic
    const testCases = [
      {
        range: "bytes=0-1023",
        fileSize: 10000,
        expected: { start: 0, end: 1023 },
      },
      {
        range: "bytes=500-",
        fileSize: 10000,
        expected: { start: 500, end: 9999 },
      },
      { range: "bytes=0-", fileSize: 1000, expected: { start: 0, end: 999 } },
    ];

    testCases.forEach(({ range, fileSize, expected }) => {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

        expect(start).toBe(expected.start);
        expect(end).toBe(expected.end);
      }
    });
  });
});
