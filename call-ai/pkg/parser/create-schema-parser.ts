import { LineStreamParser, LineStreamState } from "./line-stream.js";
import { SSEDataParser } from "./sse-data-parser.js";
import { JsonParser } from "./json-parser.js";
import { OpenRouterParser } from "./openrouter-parser.js";
import { ToolSchemaParser } from "./tool-schema-parser.js";

export function createSchemaParser(): ToolSchemaParser {
  const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
  const sseParser = new SSEDataParser(lineParser);
  const jsonParser = new JsonParser(sseParser);
  const orParser = new OpenRouterParser(jsonParser);
  return new ToolSchemaParser(orParser);
}
