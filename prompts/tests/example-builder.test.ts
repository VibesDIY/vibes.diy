import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { buildExample } from "@vibes.diy/prompts";

describe("buildExample", () => {
  it("flat scalars: string, number, boolean", async () => {
    const schema = {
      properties: {
        name: { type: "string" },
        score: { type: "number" },
        active: { type: "boolean" },
      },
    };
    const example = await buildExample(schema);
    const validator = type({ name: "string", score: "number", active: "boolean" });
    const result = validator(example);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it("integer type produces a number", async () => {
    const schema = {
      properties: {
        count: { type: "integer" },
      },
    };
    const example = await buildExample(schema);
    const validator = type({ count: "number" });
    const result = validator(example);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it("string array", async () => {
    const schema = {
      properties: {
        layers: { type: "array", items: { type: "string" } },
      },
    };
    const example = await buildExample(schema);
    const validator = type({ layers: "string[]" });
    const result = validator(example);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it("array of objects", async () => {
    const schema = {
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
          },
        },
      },
    };
    const example = await buildExample(schema);
    const validator = type({
      tasks: type({ title: "string", description: "string" }).array(),
    });
    const result = validator(example);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it("nested object", async () => {
    const schema = {
      properties: {
        address: {
          type: "object",
          properties: {
            street: { type: "string" },
            city: { type: "string" },
          },
        },
      },
    };
    const example = await buildExample(schema);
    const validator = type({ address: { street: "string", city: "string" } });
    const result = validator(example);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it("sandwich schema", async () => {
    const schema = {
      name: "sandwich",
      properties: {
        name: { type: "string" },
        layers: { type: "array", items: { type: "string" } },
      },
    };
    const example = await buildExample(schema);
    const validator = type({ name: "string", layers: "string[]" });
    const result = validator(example);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it("tasks schema", async () => {
    const schema = {
      name: "tasks",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              difficulty: { type: "string" },
            },
          },
        },
      },
    };
    const example = await buildExample(schema);
    const validator = type({
      tasks: type({ title: "string", description: "string", difficulty: "string" }).array(),
    });
    const result = validator(example);
    expect(result).not.toBeInstanceOf(type.errors);
  });

  it("empty schema returns empty object", async () => {
    const example = await buildExample({});
    expect(example).toEqual({});
  });

  it("number array", async () => {
    const schema = {
      properties: {
        scores: { type: "array", items: { type: "number" } },
      },
    };
    const example = await buildExample(schema);
    const validator = type({ scores: "number[]" });
    const result = validator(example);
    expect(result).not.toBeInstanceOf(type.errors);
  });
});
