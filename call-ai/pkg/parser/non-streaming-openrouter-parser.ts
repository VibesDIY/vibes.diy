/**
 * NonStreamingOpenRouterParser - Interprets non-streaming OpenRouter JSON responses.
 *
 * Wraps NonStreamingAdapter with the same API for compatibility.
 */

import { OnFunc } from "@adviser/cement";
import { ParserEvento, ParserEvent } from "./parser-evento.js";
import { NonStreamingAdapter } from "./adapters/non-streaming-adapter.js";
import { OrEventSource } from "./openrouter-events.js";

export class NonStreamingOpenRouterParser implements OrEventSource {
  readonly onEvent = OnFunc<(event: ParserEvent) => void>();
  private evento: ParserEvento;
  private adapter: NonStreamingAdapter;

  constructor() {
    this.evento = new ParserEvento();
    this.adapter = new NonStreamingAdapter(this.evento);

    // Forward all events from ParserEvento to onEvent
    this.evento.onEvent((event) => {
      this.onEvent.invoke(event);
    });
  }

  /**
   * Parse a non-streaming JSON response and emit OrEvents.
   * @param json - The parsed JSON response object
   */
  parse(json: unknown): void {
    this.adapter.parse(json);
  }
}
