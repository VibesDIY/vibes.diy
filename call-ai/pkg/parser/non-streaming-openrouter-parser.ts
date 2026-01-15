/**
 * NonStreamingOpenRouterParser - Interprets non-streaming OpenRouter JSON responses.
 *
 * Wraps NonStreamingAdapter with the same API for compatibility.
 */

import { OnFunc } from "@adviser/cement";
import { ParserEvento, ParserEvent, ParserHandler, ParserEventSource } from "./parser-evento.js";
import { NonStreamingAdapter } from "./adapters/non-streaming-adapter.js";
import { imageHandler } from "./handlers/image-handler.js";
import { toolHandler } from "./handlers/tool-handler.js";

export class NonStreamingOpenRouterParser implements ParserEventSource {
  private readonly evento = new ParserEvento();
  readonly onEvent = this.evento.onEvent;
  private adapter: NonStreamingAdapter;

  constructor() {
    this.evento.push(imageHandler, toolHandler);
    this.adapter = new NonStreamingAdapter(this.evento);
  }

  /**
   * Parse a non-streaming JSON response and emit ParserEvents.
   * @param json - The parsed JSON response object
   */
  parse(json: unknown): void {
    this.adapter.parse(json);
  }

  register(handler: ParserHandler): void {
    this.evento.push(handler);
  }
}
