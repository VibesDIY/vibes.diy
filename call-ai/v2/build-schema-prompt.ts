/**
 * Builds the system message for schema-based callAI requests.
 *
 * Includes a random example of the expected output shape, which
 * anchors all models (especially GPT) on the correct flat structure
 * instead of echoing the schema's { name, properties } wrapper.
 *
 * Used by srv-sandbox vibeCallAI handler and capture.sh.
 */
import { buildExample } from "./example-builder.js";

export function buildSchemaSystemMessage(schema: unknown): string {
  const schemaObj = schema as Record<string, unknown>;
  const example = buildExample(schemaObj);
  return `Return a JSON object conforming to this schema: ${JSON.stringify(schema)}

Example of expected output shape:
${JSON.stringify(example, null, 2)}`;
}
