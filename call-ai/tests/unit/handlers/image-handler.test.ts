import { describe, it, expect } from "vitest";

import { ParserEvento, ParserEvent, OrImage } from "@vibes.diy/call-ai-base";
import { imageHandler } from "@vibes.diy/call-ai-base";

describe("imageHandler", () => {
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
        b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
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
    data: [{ b64_json: "image1base64data" }, { b64_json: "image2base64data" }, { url: "https://example.com/image3.png" }],
  };

  function createEvento() {
    const evento = new ParserEvento();
    evento.push(imageHandler);
    return evento;
  }

  function collectImages(evento: ParserEvento): OrImage[] {
    const images: OrImage[] = [];
    evento.onEvent((event) => {
      if (event.type === "or.image") {
        images.push(event as OrImage);
      }
    });
    return images;
  }

  describe("Format B: data[] array (OpenAI-compatible)", () => {
    it("extracts images from data[] format with b64_json", () => {
      const evento = createEvento();
      const images = collectImages(evento);

      evento.trigger({ type: "or.json", json: transformedImageResponse });

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        type: "or.image",
        index: 0,
        b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      });
    });

    it("extracts images from data[] format with url", () => {
      const evento = createEvento();
      const images = collectImages(evento);

      evento.trigger({ type: "or.json", json: transformedImageResponseWithUrl });

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        type: "or.image",
        index: 0,
        url: "https://example.com/image.png",
      });
    });

    it("extracts multiple images with correct indices", () => {
      const evento = createEvento();
      const images = collectImages(evento);

      evento.trigger({ type: "or.json", json: multipleImagesResponse });

      expect(images).toHaveLength(3);
      expect(images[0]).toMatchObject({ type: "or.image", index: 0, b64_json: "image1base64data" });
      expect(images[1]).toMatchObject({ type: "or.image", index: 1, b64_json: "image2base64data" });
      expect(images[2]).toMatchObject({ type: "or.image", index: 2, url: "https://example.com/image3.png" });
    });
  });

  describe("Format A: choices[].message.images[] (Raw OpenRouter)", () => {
    it("extracts base64 from data URL in message.images", () => {
      const evento = createEvento();
      const images = collectImages(evento);

      evento.trigger({ type: "or.json", json: rawOpenRouterImageResponse });

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        type: "or.image",
        index: 0,
        b64_json: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      });
    });

    it("extracts URL when not a data URL", () => {
      const evento = createEvento();
      const images = collectImages(evento);

      evento.trigger({ type: "or.json", json: rawOpenRouterImageResponseWithUrl });

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        type: "or.image",
        index: 0,
        url: "https://example.com/image.png",
      });
    });
  });

  describe("ignores non-image payloads", () => {
    it("ignores or.json without image data", () => {
      const evento = createEvento();
      const images = collectImages(evento);

      evento.trigger({ type: "or.json", json: { choices: [{ message: { content: "Hello" } }] } });

      expect(images).toHaveLength(0);
    });

    it("ignores non or.json events", () => {
      const evento = createEvento();
      const images = collectImages(evento);

      evento.trigger({ type: "or.done", finishReason: "stop" });
      evento.trigger({ type: "or.delta", seq: 0, content: "hello" });

      expect(images).toHaveLength(0);
    });
  });
});
