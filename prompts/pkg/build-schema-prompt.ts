/**
 * Builds the system message for schema-based callAI requests.
 *
 * Includes a random example of the expected output shape, which
 * anchors all models (especially GPT) on the correct flat structure
 * instead of echoing the schema's { name, properties } wrapper.
 *
 * Used by srv-sandbox vibeCallAI handler.
 */
import { generate, type JsonSchema } from "json-schema-faker";

async function buildExample(schema: JsonSchema) {
  const result = await generate(schema, { optionalsProbability: 1 });
  if (!result) {
    return {};
  }
  return result;
}

export async function buildSchemaSystemMessage(schema: object): Promise<string> {
  const example = await buildExample(schema as JsonSchema);
  return `Return a JSON object conforming to this schema: ${JSON.stringify(schema)}

Example of expected output shape:
${JSON.stringify(example, null, 2)}`;
}
