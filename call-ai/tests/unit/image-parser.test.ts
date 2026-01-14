import { describe, it, expect } from "vitest";
import { NonStreamingOpenRouterParser } from "../../pkg/parser/non-streaming-openrouter-parser.js";
import { OrEvent } from "../../pkg/parser/openrouter-events.js";

describe("NonStreamingOpenRouterParser - Image Handling", () => {
  // Format A: Raw OpenRouter response with choices[].message.images[]
  const rawOpenRouterImageResponse = {
    id: "gen-123",
    created: 1234567890,
    choices: [
      {
        message: {
          content: "Here is your generated image",
          images: [
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
              },
            },
          ],
        },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
  };

  // Format B: Transformed/OpenAI-compatible response with data[]
  const transformedImageResponse = {
    created: 1234567890,
    data: [
      {
        b64_json:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        revised_prompt: "A beautiful sunset",
      },
    ],
  };

  // Format A with URL instead of data URL
  const rawOpenRouterImageResponseWithUrl = {
    id: "gen-456",
    created: 1234567890,
    choices: [
      {
        message: {
          images: [
            {
              type: "image_url",
              image_url: {
                url: "https://example.com/image.png",
              },
            },
          ],
        },
        finish_reason: "stop",
      },
    ],
  };

  // Format B with URL instead of b64_json
  const transformedImageResponseWithUrl = {
    created: 1234567890,
    data: [
      {
        url: "https://example.com/image.png",
      },
    ],
  };

  // Multiple images
  const multipleImagesResponse = {
    created: 1234567890,
    data: [
      { b64_json: "image1base64data" },
      { b64_json: "image2base64data" },
      { url: "https://example.com/image3.png" },
    ],
  };

  describe("Format A: Raw OpenRouter response", () => {
    it("should emit or.image event with extracted base64 from data URL", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.parse(rawOpenRouterImageResponse);

      const imageEvents = events.filter((e) => e.type === "or.image");
      expect(imageEvents).toHaveLength(1);
      expect(imageEvents[0]).toMatchObject({
        type: "or.image",
        index: 0,
        b64_json:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      });
    });

    it("should emit or.image event with URL when not a data URL", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.parse(rawOpenRouterImageResponseWithUrl);

      const imageEvents = events.filter((e) => e.type === "or.image");
      expect(imageEvents).toHaveLength(1);
      expect(imageEvents[0]).toMatchObject({
        type: "or.image",
        index: 0,
        url: "https://example.com/image.png",
      });
    });

    it("should also emit text content from message.content", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.parse(rawOpenRouterImageResponse);

      const deltaEvents = events.filter((e) => e.type === "or.delta");
      expect(deltaEvents).toHaveLength(1);
      expect(deltaEvents[0]).toMatchObject({
        type: "or.delta",
        content: "Here is your generated image",
      });
    });
  });

  describe("Format B: Transformed/OpenAI-compatible response", () => {
    it("should emit or.image event with b64_json", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.parse(transformedImageResponse);

      const imageEvents = events.filter((e) => e.type === "or.image");
      expect(imageEvents).toHaveLength(1);
      expect(imageEvents[0]).toMatchObject({
        type: "or.image",
        index: 0,
        b64_json:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      });
    });

    it("should emit or.image event with URL", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.parse(transformedImageResponseWithUrl);

      const imageEvents = events.filter((e) => e.type === "or.image");
      expect(imageEvents).toHaveLength(1);
      expect(imageEvents[0]).toMatchObject({
        type: "or.image",
        index: 0,
        url: "https://example.com/image.png",
      });
    });
  });

  describe("Multiple images", () => {
    it("should emit or.image event for each image with correct index", () => {
      const parser = new NonStreamingOpenRouterParser();
      const events: OrEvent[] = [];
      parser.onEvent((evt) => events.push(evt));

      parser.parse(multipleImagesResponse);

      const imageEvents = events.filter((e) => e.type === "or.image");
      expect(imageEvents).toHaveLength(3);

      expect(imageEvents[0]).toMatchObject({
        type: "or.image",
        index: 0,
        b64_json: "image1base64data",
      });
      expect(imageEvents[1]).toMatchObject({
        type: "or.image",
        index: 1,
        b64_json: "image2base64data",
      });
      expect(imageEvents[2]).toMatchObject({
        type: "or.image",
        index: 2,
        url: "https://example.com/image3.png",
      });
    });
  });
});
