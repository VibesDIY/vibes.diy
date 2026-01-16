import { OnFunc } from "@adviser/cement";
import { ParserEvento, ParserEvent, ParserHandler, ParserEventSource } from "./parser-evento.js";
import { StreamingAdapter } from "./adapters/streaming-adapter.js";
import { imageHandler } from "./handlers/image-handler.js";
import { createToolHandler } from "./handlers/tool-handler.js";

export class OpenRouterParser implements ParserEventSource {
  private readonly evento = new ParserEvento();
  readonly onEvent = this.evento.onEvent;
  private adapter: StreamingAdapter;

  constructor() {
    // StreamingAdapter creates its own parser chain internally
    // Use factory for isolated tool handler state per parser instance
    this.evento.push(imageHandler, createToolHandler());
    this.adapter = new StreamingAdapter(this.evento);
  }

  processChunk(chunk: string): void {
    this.adapter.processChunk(chunk);
  }

  /**
   * Finalize the stream - triggers or.stream-end event.
   * Call this when all chunks have been processed.
   */
  finalize(): void {
    this.evento.trigger({ type: "or.stream-end" });
  }

  register(handler: ParserHandler): void {
    this.evento.push(handler);
  }
}
