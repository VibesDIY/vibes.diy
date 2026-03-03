import { describe, it, expect } from "vitest";
import { buildRequestBody, getHeaders } from "./build-request.js";
import type { RequestBody } from "./build-request.js";
import sandwichSchema from "./fixtures/sandwich-schema.json" with { type: "json" };

describe("buildRequestBody", () => {
  it("without schema: no response_format, no system message", () => {
    const body: RequestBody = buildRequestBody({ model: "openai/gpt-4o-mini", prompt: "Hello" });
    expect(body.model).toBe("openai/gpt-4o-mini");
    expect(body.stream).toBe(true);
    expect(body.response_format).toBeUndefined();
    expect(body.messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("with schema: adds response_format and system message", () => {
    const body: RequestBody = buildRequestBody({
      model: "openai/gpt-4o-mini",
      prompt: "Describe a sandwich",
      schema: sandwichSchema,
    });
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "sandwich",
        strict: true,
        schema: {
          type: "object",
          properties: sandwichSchema.properties,
          required: ["name", "layers"],
          additionalProperties: false,
        },
      },
    });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1]).toEqual({ role: "user", content: "Describe a sandwich" });
  });

  it("schema without name defaults to result", () => {
    const body: RequestBody = buildRequestBody({
      model: "gpt-4o-mini",
      prompt: "test",
      schema: { properties: { x: { type: "string" } } },
    });
    expect(body.response_format?.json_schema.name).toBe("result");
  });

  it("schema without required defaults to all property keys", () => {
    const body: RequestBody = buildRequestBody({
      model: "gpt-4o-mini",
      prompt: "test",
      schema: { properties: { a: { type: "string" }, b: { type: "number" } } },
    });
    expect(body.response_format?.json_schema.schema.required).toEqual(["a", "b"]);
  });

  it("with schema + apiStyle anthropic: uses tools/tool_choice", () => {
    const body = buildRequestBody({
      model: "claude-sonnet-4-6",
      prompt: "Describe a sandwich",
      schema: sandwichSchema,
      apiStyle: "anthropic",
    });
    expect(body.response_format).toBeUndefined();
    expect(body.tools).toEqual([{
      name: "sandwich",
      description: "Return structured JSON",
      input_schema: {
        type: "object",
        properties: sandwichSchema.properties,
        required: ["name", "layers"],
        additionalProperties: false,
      },
    }]);
    expect(body.tool_choice).toEqual({ type: "tool", name: "sandwich" });
    expect(body.max_tokens).toBe(1024);
    expect(body.messages).toEqual([{ role: "user", content: "Describe a sandwich" }]);
  });

  it("auto-detects anthropic style from api.anthropic.com URL", () => {
    const body = buildRequestBody({
      model: "claude-sonnet-4-6",
      prompt: "Describe a sandwich",
      schema: sandwichSchema,
      url: "https://api.anthropic.com/v1/messages",
    });
    expect(body.response_format).toBeUndefined();
    expect(body.tools).toBeDefined();
    expect(body.tool_choice).toEqual({ type: "tool", name: "sandwich" });
  });

  it("anthropic URL without schema still uses anthropic message shape", () => {
    const body = buildRequestBody({
      model: "claude-sonnet-4-6",
      prompt: "Describe a sandwich",
      url: "https://api.anthropic.com/v1/messages",
    });
    expect(body.response_format).toBeUndefined();
    expect(body.tools).toBeUndefined();
    expect(body.messages).toEqual([{ role: "user", content: "Describe a sandwich" }]);
    expect(body.max_tokens).toBe(1024);
  });

  it("non-anthropic URL defaults to openai style", () => {
    const body = buildRequestBody({
      model: "openai/gpt-4o-mini",
      prompt: "Describe a sandwich",
      schema: sandwichSchema,
      url: "https://openrouter.ai/api/v1/chat/completions",
    });
    expect(body.response_format).toBeDefined();
    expect(body.tools).toBeUndefined();
  });

  it("nested objects get required/additionalProperties automatically", () => {
    const body = buildRequestBody({
      model: "gpt-4o-mini",
      prompt: "test",
      schema: {
        properties: {
          name: { type: "string" },
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              location: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" },
                },
              },
            },
          },
          tags: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                score: { type: "number" },
              },
            },
          },
        },
      },
    });
    const schema = body.response_format!.json_schema.schema;
    expect(schema.required).toEqual(["name", "address", "tags"]);
    expect(schema.additionalProperties).toBe(false);

    const address = schema.properties.address as {
      required: string[];
      additionalProperties: boolean;
      properties: Record<string, unknown>;
    };
    expect(address.required).toEqual(["street", "city", "location"]);
    expect(address.additionalProperties).toBe(false);

    const location = address.properties.location as { required: string[]; additionalProperties: boolean };
    expect(location.required).toEqual(["lat", "lng"]);
    expect(location.additionalProperties).toBe(false);

    const tags = schema.properties.tags as { items: { required: string[]; additionalProperties: boolean } };
    expect(tags.items.required).toEqual(["label", "score"]);
    expect(tags.items.additionalProperties).toBe(false);
  });

  it("nested objects get required/additionalProperties for anthropic style too", () => {
    const body = buildRequestBody({
      model: "claude-sonnet-4-6",
      prompt: "test",
      apiStyle: "anthropic",
      schema: {
        properties: {
          name: { type: "string" },
          meta: {
            type: "object",
            properties: {
              color: { type: "string" },
            },
          },
        },
      },
    });

    const tool = body.tools![0];
    const meta = tool.input_schema.properties.meta as { required: string[]; additionalProperties: boolean };
    expect(meta.required).toEqual(["color"]);
    expect(meta.additionalProperties).toBe(false);
  });

  it("anthropic headers include x-api-key and anthropic-version", () => {
    const headers = getHeaders("anthropic", "sk-ant-test");
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("openai headers use Bearer authorization", () => {
    const headers = getHeaders("openai", "sk-test");
    expect(headers["Authorization"]).toBe("Bearer sk-test");
    expect(headers["x-api-key"]).toBeUndefined();
  });

  it("explicit apiStyle overrides URL auto-detection", () => {
    const body = buildRequestBody({
      model: "claude-sonnet-4-6",
      prompt: "Describe a sandwich",
      schema: sandwichSchema,
      url: "https://api.anthropic.com/v1/messages",
      apiStyle: "openai",
    });
    expect(body.response_format).toBeDefined();
    expect(body.tools).toBeUndefined();
  });
});
