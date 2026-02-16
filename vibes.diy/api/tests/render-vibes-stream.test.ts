import { describe, it, expect } from "vitest";
import { uint8array2stream } from "@adviser/cement";
import { bufferContent } from "../svc/intern/render-vibes.js";

describe("render-vibes bufferContent", () => {
  const testData = new Uint8Array([1, 2, 3, 4, 5]);

  it("should handle ReadableStream by buffering", async () => {
    const stream = uint8array2stream(testData);
    const result = await bufferContent(stream);
    expect(result).toEqual(testData);
  });

  it("should handle Uint8Array directly", async () => {
    const result = await bufferContent(testData);
    expect(result).toEqual(testData);
  });

  it("should buffer multi-chunk streams correctly", async () => {
    // Create a stream with multiple chunks
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5]);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      }
    });

    const result = await bufferContent(stream);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });
});
