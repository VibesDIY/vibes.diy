import { OnFunc } from "@adviser/cement";
import { OrEventSource, OrImage } from "./openrouter-events.js";

/**
 * ImageParser - Extracts images from OpenRouter JSON responses.
 *
 * This class listens to or.json events from an OrEventSource and extracts
 * image data from both raw OpenRouter format and transformed OpenAI-compatible format.
 *
 * Supported formats:
 * - Format A: Raw OpenRouter `choices[].delta.images[]` with data URLs
 * - Format B: Transformed `data[].b64_json` or `data[].url`
 *
 * Usage:
 * ```typescript
 * const orParser = new NonStreamingOpenRouterParser();
 * const imageParser = new ImageParser(orParser);
 *
 * imageParser.onImage(evt => {
 *   if (evt.b64_json) {
 *     // Handle base64 image
 *   } else if (evt.url) {
 *     // Handle URL image
 *   }
 * });
 *
 * orParser.parse(response);
 * ```
 */
export class ImageParser {
  readonly onImage = OnFunc<(event: OrImage) => void>();

  constructor(orParser: OrEventSource) {
    orParser.onEvent((evt) => {
      if (evt.type === "or.json") {
        this.handleJson(evt.json);
      }
    });
  }

  private handleJson(json: unknown): void {
    const response = json as Record<string, unknown>;

    // Format B: Transformed/OpenAI-compatible { data: [] }
    const data = response.data as Array<{ b64_json?: string; url?: string }> | undefined;
    if (data && Array.isArray(data)) {
      data.forEach((item, index) => {
        if (item.b64_json || item.url) {
          this.emitImage(index, item.b64_json, item.url);
        }
      });
      return;
    }

    // Format A: Raw OpenRouter choices[].delta.images[]
    const choices = response.choices as Array<{
      delta?: { images?: Array<{ type: string; image_url?: { url: string } }> };
    }> | undefined;

    const images = choices?.[0]?.delta?.images;
    if (images && Array.isArray(images)) {
      images.forEach((img, index) => {
        if (img.type === "image_url" && img.image_url?.url) {
          const dataUrl = img.image_url.url;
          const b64 = this.extractBase64(dataUrl);
          this.emitImage(index, b64, b64 ? undefined : dataUrl);
        }
      });
    }
  }

  private extractBase64(dataUrl: string): string | undefined {
    const match = dataUrl.match(/^data:image\/[^;]+;base64,(.+)$/);
    return match ? match[1] : undefined;
  }

  private emitImage(index: number, b64_json: string | undefined, url: string | undefined): void {
    this.onImage.invoke({ type: "or.image", index, b64_json, url });
  }
}
