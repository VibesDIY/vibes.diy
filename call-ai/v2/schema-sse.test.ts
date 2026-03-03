import { array2stream, stream2array, loadAsset, pathOps } from "@adviser/cement";
import { describe, it, expect, beforeAll } from "vitest";
import {
  createSectionsStream,
  isBlockEnd,
  isToplevelLine,
  isSseError,
  isSseEnd,
} from "./index.js";
import type { ToplevelLineMsg } from "./index.js";
import { createDataStream } from "./data-stream.js";
import { createDeltaStream } from "./delta-stream.js";
import { createLineStream } from "./line-stream.js";
import { createSseStream } from "./sse-stream.js";
import { createStatsCollector } from "./stats-stream.js";
import { buildRequestBody } from "./build-request.js";
import type { RequestBody } from "./build-request.js";

async function resolveContent(content: string): Promise<string> {
  const match = content.match(/^export default "([^"]+)"/);
  console.log("resolveContent: match =", match?.[1] ?? "(no match)");
  if (match && match[1]) {
    try {
      const response = await fetch(match[1]);
      console.log("resolveContent: fetch status =", response.status, "url =", match[1]);
      return await response.text();
    } catch (e) {
      console.error("resolveContent: fetch failed for", match[1], e);
      return content;
    }
  }
  return content;
}

async function loadFixtureLines(filename: string): Promise<string[]> {
  console.log("loadFixture: import.meta.url =", import.meta.url);

  const result = await loadAsset(`fixtures/${filename}`, {
    basePath: () => import.meta.url,
    fallBackUrl: import.meta.url,
    pathCleaner: (base, localPath, mode) => {
      const joined = pathOps.join(base, localPath);
      console.log("loadFixture pathCleaner:", { base, localPath, mode, joined });
      return joined;
    },
  });

  const raw = result.Ok();
  console.log("loadFixture raw:", {
    len: raw.length,
    first80: raw.slice(0, 80),
    isExportDefault: raw.startsWith("export default"),
  });

  const content = await resolveContent(raw);
  console.log("loadFixture resolved:", {
    len: content.length,
    first80: content.slice(0, 80),
    changed: content !== raw,
  });

  return content.split("\n");
}

function runFullPipeline(lines: readonly string[]) {
  let id = 1;
  const streamId = `test-${id++}`;
  return stream2array(
    array2stream(lines.map((i) => i + "\n"))
      .pipeThrough(createStatsCollector(streamId, 5000))
      .pipeThrough(createLineStream(streamId))
      .pipeThrough(createDataStream(streamId))
      .pipeThrough(createSseStream(streamId))
      .pipeThrough(createDeltaStream(streamId, () => `test-${id++}`))
      .pipeThrough(createSectionsStream(streamId, () => `test-${id++}`))
  );
}

const sandwichSchema = {
  name: "sandwich",
  properties: {
    name: { type: "string" },
    layers: { type: "array", items: { type: "string" } },
  },
  required: ["name", "layers"],
} as const;

describe("buildRequestBody (dry-run logic)", () => {
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

  it("schema without name defaults to 'result'", () => {
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

  it("with schema + apiStyle anthropic: produces tools/tool_choice instead of response_format", () => {
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

  it("nested objects get required and additionalProperties automatically", () => {
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
    const s = body.response_format!.json_schema.schema;
    // top level
    expect(s.required).toEqual(["name", "address", "tags"]);
    expect(s.additionalProperties).toBe(false);
    // nested object
    const address = s.properties.address as { required: string[]; additionalProperties: boolean; properties: Record<string, unknown> };
    expect(address.required).toEqual(["street", "city", "location"]);
    expect(address.additionalProperties).toBe(false);
    // deeply nested object
    const location = address.properties.location as { required: string[]; additionalProperties: boolean };
    expect(location.required).toEqual(["lat", "lng"]);
    expect(location.additionalProperties).toBe(false);
    // array items
    const tags = s.properties.tags as { items: { required: string[]; additionalProperties: boolean } };
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

  it("explicit apiStyle overrides URL auto-detection", () => {
    const body = buildRequestBody({
      model: "claude-sonnet-4-6",
      prompt: "Describe a sandwich",
      schema: sandwichSchema,
      url: "https://api.anthropic.com/v1/messages",
      apiStyle: "openai",
    });
    // Explicit openai override even though URL is anthropic
    expect(body.response_format).toBeDefined();
    expect(body.tools).toBeUndefined();
  });
});

const fixtureConfigs = [
  { name: "OpenRouter GPT (json_schema)", file: "openrouter-gpt-json-schema.llm.txt" },
  { name: "OpenRouter Claude (json_schema)", file: "openrouter-claude-json-schema.llm.txt" },
  { name: "OpenAI Direct (json_schema)", file: "openai-json-schema.llm.txt" },
  { name: "Anthropic Direct (tool_use)", file: "anthropic-json-schema.llm.txt" },
] as const;

describe("json_schema across all 4 providers", () => {
  const fixtures: { name: string; lines: string[] }[] = [];

  beforeAll(async () => {
    for (const config of fixtureConfigs) {
      const lines = await loadFixtureLines(config.file);
      fixtures.push({ name: config.name, lines });
    }
  });

  for (const config of fixtureConfigs) {
    it(`${config.name}: pipeline produces valid sandwich JSON`, async () => {
      const fixture = fixtures.find((f) => f.name === config.name);
      if (fixture === undefined) {
        throw new Error(`Fixture not found: ${config.name}`);
      }
      const res = await runFullPipeline(fixture.lines);

      const errors = res.filter((i) => isSseError(i));
      expect(errors).toHaveLength(0);

      const endEvents = res.filter((i) => isSseEnd(i));
      expect(endEvents).toHaveLength(1);

      const textLines = res.filter((i): i is ToplevelLineMsg => isToplevelLine(i)).map((i) => i.line);
      const text = textLines.join("\n");

      const parsed = JSON.parse(text);
      expect(parsed).toHaveProperty("name");
      expect(parsed).toHaveProperty("layers");
      expect(typeof parsed.name).toBe("string");
      expect(Array.isArray(parsed.layers)).toBe(true);
      expect(parsed.layers.length).toBeGreaterThan(0);
      for (const layer of parsed.layers) {
        expect(typeof layer).toBe("string");
      }

      const blockEnds = res.filter((i) => isBlockEnd(i));
      expect(blockEnds).toHaveLength(1);
    });
  }
});
