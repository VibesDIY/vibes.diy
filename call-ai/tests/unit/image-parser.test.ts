import { describe, it, expect } from "vitest";
import { NonStreamingOpenRouterParser } from "../../pkg/parser/non-streaming-openrouter-parser.js";
import { ImageParser } from "../../pkg/parser/image-parser.js";
import { OrImage } from "../../pkg/parser/openrouter-events.js";

describe("ImageParser", () => {
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

  function createParserChain() {
    const orParser = new NonStreamingOpenRouterParser();
    const imageParser = new ImageParser(orParser);
    return { orParser, imageParser };
  }

  describe("Format A: Raw OpenRouter response", () => {
    it("should emit or.image event with extracted base64 from data URL", () => {
      const { orParser, imageParser } = createParserChain();
      const events: OrImage[] = [];
      imageParser.onImage((evt) => events.push(evt));

      orParser.parse(rawOpenRouterImageResponse);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "or.image",
        index: 0,
        b64_json:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      });
    });

    it("should emit or.image event with URL when not a data URL", () => {
      const { orParser, imageParser } = createParserChain();
      const events: OrImage[] = [];
      imageParser.onImage((evt) => events.push(evt));

      orParser.parse(rawOpenRouterImageResponseWithUrl);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "or.image",
        index: 0,
        url: "https://example.com/image.png",
      });
    });

    it("should still emit text content from message.content via or.delta", () => {
      const { orParser } = createParserChain();
      const deltaContent: string[] = [];
      orParser.onEvent((evt) => {
        if (evt.type === "or.delta") {
          deltaContent.push(evt.content);
        }
      });

      orParser.parse(rawOpenRouterImageResponse);

      expect(deltaContent).toHaveLength(1);
      expect(deltaContent[0]).toBe("Here is your generated image");
    });
  });

  describe("Format B: Transformed/OpenAI-compatible response", () => {
    it("should emit or.image event with b64_json", () => {
      const { orParser, imageParser } = createParserChain();
      const events: OrImage[] = [];
      imageParser.onImage((evt) => events.push(evt));

      orParser.parse(transformedImageResponse);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "or.image",
        index: 0,
        b64_json:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      });
    });

    it("should emit or.image event with URL", () => {
      const { orParser, imageParser } = createParserChain();
      const events: OrImage[] = [];
      imageParser.onImage((evt) => events.push(evt));

      orParser.parse(transformedImageResponseWithUrl);

      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        type: "or.image",
        index: 0,
        url: "https://example.com/image.png",
      });
    });
  });

  describe("Multiple images", () => {
    it("should emit or.image event for each image with correct index", () => {
      const { orParser, imageParser } = createParserChain();
      const events: OrImage[] = [];
      imageParser.onImage((evt) => events.push(evt));

      orParser.parse(multipleImagesResponse);

      expect(events).toHaveLength(3);

      expect(events[0]).toMatchObject({
        type: "or.image",
        index: 0,
        b64_json: "image1base64data",
      });
      expect(events[1]).toMatchObject({
        type: "or.image",
        index: 1,
        b64_json: "image2base64data",
      });
      expect(events[2]).toMatchObject({
        type: "or.image",
        index: 2,
        url: "https://example.com/image3.png",
      });
    });
  });
});
