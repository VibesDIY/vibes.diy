/**
 * OpenRouterParser - Streaming parser for OpenRouter SSE responses.
 *
 * Wraps StreamingAdapter with the same API for compatibility.
 */

import { OnFunc } from "@adviser/cement";
import { ParserEvento, ParserEvent } from "./parser-evento.js";
import { StreamingAdapter } from "./adapters/streaming-adapter.js";
import { OrEventSource } from "./openrouter-events.js";
import { DataSource } from "./json-parser.js";

export class OpenRouterParser implements OrEventSource {
  readonly onEvent = OnFunc<(event: ParserEvent) => void>();
  private evento: ParserEvento;
  private adapter: StreamingAdapter;

  constructor(_jsonParser: DataSource) {
    // StreamingAdapter creates its own parser chain internally
    this.evento = new ParserEvento();
    this.adapter = new StreamingAdapter(this.evento);

    // Forward all events from ParserEvento to onEvent
    this.evento.onEvent((event) => {
      this.onEvent.invoke(event);
    });
  }

  processChunk(chunk: string): void {
    this.adapter.processChunk(chunk);
  }
}
