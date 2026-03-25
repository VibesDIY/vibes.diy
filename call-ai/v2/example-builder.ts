/**
 * Generates a random but correctly-shaped example from a callAI schema.
 *
 * Walks schema.properties and produces values using random-words,
 * giving the model a concrete example of the expected output shape.
 */
import { generate } from "random-words";

function randomString(): string {
  return generate({ min: 1, max: 3, join: " " }) as string;
}

function randomInt(): number {
  return Math.floor(Math.random() * 100) + 1;
}

function randomBool(): boolean {
  return Math.random() > 0.5;
}

function generateValue(propDef: Record<string, unknown>): unknown {
  const propType = propDef.type as string | undefined;

  switch (true) {
    case propType === "string":
      return randomString();

    case propType === "number":
    case propType === "integer":
      return randomInt();

    case propType === "boolean":
      return randomBool();

    case propType === "array": {
      const items = propDef.items as Record<string, unknown> | undefined;
      if (items === undefined) {
        return [randomString(), randomString()];
      }
      const itemType = items.type as string | undefined;
      const count = 2 + Math.floor(Math.random() * 3); // 2-4 items

      switch (true) {
        case itemType === "string":
          return Array.from({ length: count }, () => randomString());

        case itemType === "object" && items.properties !== undefined:
          return Array.from({ length: Math.min(count, 3) }, () =>
            generateFromProperties(items.properties as Record<string, unknown>)
          );

        case itemType === "number":
        case itemType === "integer":
          return Array.from({ length: count }, () => randomInt());

        case itemType === "boolean":
          return Array.from({ length: count }, () => randomBool());

        default:
          return [randomString(), randomString()];
      }
    }

    case propType === "object" && propDef.properties !== undefined:
      return generateFromProperties(propDef.properties as Record<string, unknown>);

    default:
      return randomString();
  }
}

function generateFromProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "object" && value !== null) {
      result[key] = generateValue(value as Record<string, unknown>);
    }
  }
  return result;
}

/**
 * Build a random example that matches the shape a callAI schema expects.
 * Reads schema.properties and produces a flat object with generated values.
 */
export function buildExample(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = schema.properties as Record<string, unknown> | undefined;
  if (properties === undefined) {
    return {};
  }
  return generateFromProperties(properties);
}
