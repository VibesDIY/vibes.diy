import { ToolSchemaParser } from "./tool-schema-parser.js";
import { fixMalformedJson } from "../utils.js";

export class ToolSchemaAccumulator {
  result: string | null = null;
  private readonly parser: ToolSchemaParser;

  constructor(parser: ToolSchemaParser) {
    this.parser = parser;
    parser.onToolCallComplete((evt) => {
      // Fix potential malformed JSON before storing
      this.result = fixMalformedJson(evt.arguments);
    });
  }

  processChunk(chunk: string): void {
    this.parser.processChunk(chunk);
  }
}
