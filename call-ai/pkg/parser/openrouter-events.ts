/**
 * OpenRouter event types - Re-exports from parser-evento.ts
 *
 * This file exists for import compatibility. All types are defined in parser-evento.ts.
 */

export {
  orMeta,
  orDelta,
  orUsage,
  orDone,
  orStreamEnd,
  orJson,
  orImage,
  parserEvent as orEvent,
  OrMeta,
  OrDelta,
  OrUsage,
  OrDone,
  OrStreamEnd,
  OrJson,
  OrImage,
  ParserEvent as OrEvent,
  isParserEventError as isOrEventError,
} from "./parser-evento.js";

import { OnFunc } from "@adviser/cement";
import { ParserEvent, ParserHandler } from "./parser-evento.js";

/**
 * Interface for parsers that emit OrEvents.
 * Both OpenRouterParser (streaming) and NonStreamingOpenRouterParser implement this.
 */
export interface OrEventSource {
  readonly onEvent: {
    (callback: (event: ParserEvent) => void): void;
    invoke(event: ParserEvent): void;
  };
  register(handler: ParserHandler): void;
}

/**
 * Create an OrEventSource-compatible onEvent function.
 */
export function createOrEventSource(): OrEventSource["onEvent"] {
  return OnFunc<(event: ParserEvent) => void>();
}
