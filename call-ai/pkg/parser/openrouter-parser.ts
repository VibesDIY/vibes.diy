import { OnFunc } from "@adviser/cement";
import { ParserEvento, ParserEvent, ParserHandler } from "./parser-evento.js";
import { StreamingAdapter } from "./adapters/streaming-adapter.js";
import { OrEventSource } from "./openrouter-events.js";
import { imageHandler } from "./handlers/image-handler.js";
import { toolHandler } from "./handlers/tool-handler.js";

export class OpenRouterParser implements OrEventSource {
  readonly onEvent = OnFunc<(event: ParserEvent) => void>();
  private evento: ParserEvento;
  private adapter: StreamingAdapter;

  constructor() {
    this.evento = new ParserEvento();
    this.evento.push(imageHandler, toolHandler);
    this.adapter = new StreamingAdapter(this.evento);

    // Forward all events from ParserEvento to onEvent
    this.evento.onEvent((event) => {
      this.onEvent.invoke(event);
    });
  }

  processChunk(chunk: string): void {
    this.adapter.processChunk(chunk);
  }

  register(handler: ParserHandler): void {
    this.evento.push(handler);
  }
}
