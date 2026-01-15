import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { ParserEvent } from "../../pkg/parser/index.js";
import { OpenRouterParser } from "../helpers/parser-test-utils.js";
import { feedFixtureToParser } from "../test-helpers.js";

/**
 * OpenAI Weather Streaming Tests - Response Parsing
 *
 * Tests parser handling of weather schema streaming response.
 * No fetch mocking - tests parser directly with simulated network fragmentation.
 */

describe("OpenAI Weather Response Parsing (parser-based)", () => {
  const weatherResponseFixture = fs.readFileSync(
    path.join(__dirname, "fixtures/openai-weather-response.json"),
    "utf8",
  );

  it("should correctly parse OpenAI streaming with weather schema", () => {
    const parser = new OpenRouterParser();
    const deltas: string[] = [];

    parser.onEvent((evt: ParserEvent) => {
      if (evt.type === "or.delta") deltas.push(evt.content);
    });

    feedFixtureToParser(parser, weatherResponseFixture);

    // Verify deltas were collected
    expect(deltas.length).toBeGreaterThan(0);

    // Accumulated content should be valid JSON
    const accumulated = deltas.join("");
    expect(() => JSON.parse(accumulated)).not.toThrow();

    // Verify the weather data structure
    const data = JSON.parse(accumulated);
    expect(data).toHaveProperty("location");
    expect(data).toHaveProperty("current_temp");
    expect(data).toHaveProperty("conditions");
    expect(data).toHaveProperty("tomorrow");

    // Verify types
    expect(typeof data.location).toBe("string");
    expect(typeof data.current_temp).toBe("number");
    expect(typeof data.conditions).toBe("string");
    expect(typeof data.tomorrow).toBe("object");
    expect(typeof data.tomorrow.conditions).toBe("string");

    // Verify actual values from fixture
    expect(data.location).toBe("New York, NY");
    expect(data.current_temp).toBe(63);
    expect(data.conditions).toBe("Partly Cloudy");
    expect(data.tomorrow.high).toBe(68);
    expect(data.tomorrow.low).toBe(55);
    expect(data.tomorrow.conditions).toBe("Sunny");
  });

  it("should emit proper metadata", () => {
    const parser = new OpenRouterParser();
    let model: string | null = null;

    parser.onEvent((evt: ParserEvent) => {
      if (evt.type === "or.meta") model = evt.model;
    });

    feedFixtureToParser(parser, weatherResponseFixture);

    expect(model).toBe("openai/gpt-4o");
  });

  it("should emit usage stats", () => {
    const parser = new OpenRouterParser();
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null = null;

    parser.onEvent((evt: ParserEvent) => {
      if (evt.type === "or.usage") {
        usage = {
          promptTokens: evt.promptTokens,
          completionTokens: evt.completionTokens,
          totalTokens: evt.totalTokens,
        };
      }
    });

    feedFixtureToParser(parser, weatherResponseFixture);

    expect(usage).toEqual({
      promptTokens: 98,
      completionTokens: 36,
      totalTokens: 134,
    });
  });

  it("should handle fragmentation with small chunks", () => {
    const parser = new OpenRouterParser();
    const deltas: string[] = [];

    parser.onEvent((evt: ParserEvent) => {
      if (evt.type === "or.delta") deltas.push(evt.content);
    });

    // Use very small chunks
    feedFixtureToParser(parser, weatherResponseFixture, 3);

    const accumulated = deltas.join("");
    const data = JSON.parse(accumulated);
    expect(data.location).toBe("New York, NY");
  });
});
