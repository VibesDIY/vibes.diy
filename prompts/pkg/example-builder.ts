/**
 * Generates a random but correctly-shaped example from a callAI schema.
 *
 * Uses json-schema-faker to recursively walk the schema and produce
 * a concrete example, giving the model an anchor for the expected output shape.
 */
import { generate, type JsonSchema } from "json-schema-faker";

/**
 * Build a random example that matches the shape a callAI schema expects.
 * Wraps the callAI shorthand (top-level properties, optional type) into
 * a full JSON Schema object and delegates to json-schema-faker.
 */
export async function buildExample(schema: JsonSchema) {
  const result = await generate(schema, { optionalsProbability: 1 });
  if (!result) {
    return {};
  }
  return result;
}
