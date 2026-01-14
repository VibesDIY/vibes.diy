/**
 * Test utilities for parser tests
 * These helpers provide access to internal parser functions for testing
 */
import { ToolSchemaParser } from "../../pkg/parser/tool-schema-parser.js";
import { createBaseParser } from "../../pkg/parser/create-base-parser.js";

/**
 * Create a ToolSchemaParser connected to the base parser stack for testing
 */
export function createTestSchemaParser(): ToolSchemaParser {
  const orParser = createBaseParser();
  return new ToolSchemaParser(orParser);
}

/**
 * Re-export createBaseParser for tests that need direct access
 */
export { createBaseParser } from "../../pkg/parser/create-base-parser.js";
