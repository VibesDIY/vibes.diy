import { ToolSchemaParser } from "./tool-schema-parser.js";
import { fixMalformedJson } from "../utils.js";

export class ToolSchemaAccumulator {
  result: string | null = null;

  constructor(parser: ToolSchemaParser) {
    parser.onToolCallComplete((evt) => {
      // Fix potential malformed JSON before storing
      this.result = fixMalformedJson(evt.arguments);
    });
  }

  processChunk(chunk: string): void {
    // Delegate to upstream (handled by parser stack wiring)
  }
}
