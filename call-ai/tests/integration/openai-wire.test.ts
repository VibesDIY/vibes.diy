import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { ParserEvent, OpenRouterParser } from "@vibes.diy/call-ai-base";
import { feedFixtureToParser } from "../test-helpers.js";

/**
 * OpenAI Wire Protocol Tests - Response Parsing
 *
 * Tests parser handling of OpenAI SSE format using real fixtures.
 * No fetch mocking - tests parser directly with simulated network fragmentation.
 */

describe("OpenAI Response Parsing (parser-based)", () => {
  const openaiStreamResponseFixture = fs.readFileSync(path.join(__dirname, "fixtures/openai-stream-response.json"), "utf8");

  it("should parse OpenAI streaming response and extract deltas", () => {
    const parser = new OpenRouterParser();
    const deltas: string[] = [];
    let metaEmitted = false;
    let model = "";

    parser.onEvent((evt: ParserEvent) => {
      switch (evt.type) {
        case "or.meta":
          metaEmitted = true;
          model = evt.model;
          break;
        case "or.delta":
          deltas.push(evt.content);
          break;
      }
    });

    feedFixtureToParser(parser, openaiStreamResponseFixture);

    // Verify metadata was extracted
    expect(metaEmitted).toBe(true);
    expect(model).toBe("openai/gpt-4o");

    // Verify deltas were collected
    expect(deltas.length).toBeGreaterThan(0);

    // Accumulated content should be valid JSON
    const accumulated = deltas.join("");
    expect(() => JSON.parse(accumulated)).not.toThrow();

    // Verify parsed content matches expected book recommendation
    const parsed = JSON.parse(accumulated);
    expect(parsed.title).toBe("The Night Circus");
    expect(parsed.author).toBe("Erin Morgenstern");
    expect(parsed.year).toBe(2011);
    expect(parsed.genre).toBe("Fantasy");
    expect(parsed.rating).toBe(4.3);
  });

  it("should emit or.done with finish_reason stop", () => {
    const parser = new OpenRouterParser();
    let finishReason: string | null = null;

    parser.onEvent((evt: ParserEvent) => {
      if (evt.type === "or.done") {
        finishReason = evt.finishReason;
      }
    });

    feedFixtureToParser(parser, openaiStreamResponseFixture);

    expect(finishReason).toBe("stop");
  });

  it("should emit or.usage with token counts", () => {
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

    feedFixtureToParser(parser, openaiStreamResponseFixture);

    expect(usage).toEqual({
      promptTokens: 80,
      completionTokens: 30,
      totalTokens: 110,
    });
  });

  it("should emit or.stream-end on [DONE]", () => {
    const parser = new OpenRouterParser();
    let streamEnded = false;

    parser.onEvent((evt: ParserEvent) => {
      if (evt.type === "or.stream-end") streamEnded = true;
    });

    feedFixtureToParser(parser, openaiStreamResponseFixture);

    expect(streamEnded).toBe(true);
  });

  it("should handle random chunk fragmentation", () => {
    const parser = new OpenRouterParser();
    const deltas: string[] = [];

    parser.onEvent((evt: ParserEvent) => {
      if (evt.type === "or.delta") deltas.push(evt.content);
    });

    // Use very small chunks to stress test buffering
    feedFixtureToParser(parser, openaiStreamResponseFixture, 5);

    const accumulated = deltas.join("");
    const parsed = JSON.parse(accumulated);
    expect(parsed.title).toBe("The Night Circus");
  });
});
