/**
 * Image handler - Extracts images from or.json events.
 *
 * Supports two formats:
 * - Format A: Raw OpenRouter choices[].message.images[]
 * - Format B: Transformed/OpenAI-compatible data[] array
 */

import { ParserHandler, OrJson } from "../parser-evento.js";

export const imageHandler: ParserHandler = {
  hash: "image-extractor",
  validate: (event) => {
    if (event.type === "or.json") {
      return { some: event };
    }
    return { none: true };
  },
  handle: (ctx) => {
    const event = ctx.event as OrJson;
    const json = event.json as Record<string, unknown>;

    // Format B: Transformed/OpenAI-compatible { data: [] }
    const data = json.data as Array<{ b64_json?: string; url?: string }> | undefined;
    if (data && Array.isArray(data)) {
      data.forEach((item, index) => {
        if (item.b64_json || item.url) {
          ctx.emit({
            type: "or.image",
            index,
            b64_json: item.b64_json,
            url: item.url,
          });
        }
      });
      return;
    }

    // Format A: Raw OpenRouter choices[].message.images[]
    const choices = json.choices as Array<{
      message?: { images?: Array<{ type: string; image_url?: { url: string } }> };
    }> | undefined;

    const images = choices?.[0]?.message?.images;
    if (images && Array.isArray(images)) {
      images.forEach((img, index) => {
        if (img.type === "image_url" && img.image_url?.url) {
          const dataUrl = img.image_url.url;
          const b64 = extractBase64(dataUrl);
          ctx.emit({
            type: "or.image",
            index,
            b64_json: b64,
            url: b64 ? undefined : dataUrl,
          });
        }
      });
    }
  },
};

function extractBase64(dataUrl: string): string | undefined {
  const match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
  return match ? match[1] : undefined;
}
