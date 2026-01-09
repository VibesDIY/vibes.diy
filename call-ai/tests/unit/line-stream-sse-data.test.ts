import { readFileSync } from "node:fs";

import { LineStreamParser, LineStreamState, SSEDataParser, DataEvent } from "call-ai";
import { describe, it, expect } from "vitest";

import { feedFixtureRandomly } from "./test-utils.js";

const openAiStreamFixture = readFileSync(
  new URL("./fixtures/openai-stream-response.json", import.meta.url),
  "utf8",
);

const openAiWeatherStreamFixture = readFileSync(
  new URL("./fixtures/openai-weather-response.json", import.meta.url),
  "utf8",
);

const fireproofStreamFixture = readFileSync(
  new URL("../integration/fixtures/openai-fireproof-stream-response.txt", import.meta.url),
  "utf8",
);

describe("SSEDataParser", () => {
  it("emits DataEvent for data: lines", () => {
    const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    const sseParser = new SSEDataParser(lineParser);
    const events: DataEvent[] = [];
    sseParser.onData((evt) => events.push(evt));

    sseParser.processChunk("data: hello world\n");

    expect(events).toHaveLength(1);
    expect(events[0].payload).toBe("hello world");
    expect(events[0].isDone).toBe(false);
  });

  it("handles payload split across chunks", () => {
    const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    const sseParser = new SSEDataParser(lineParser);
    const events: DataEvent[] = [];
    sseParser.onData((evt) => events.push(evt));

    sseParser.processChunk("data: hel");
    sseParser.processChunk("lo wor");
    sseParser.processChunk("ld\n");

    expect(events).toHaveLength(1);
    expect(events[0].payload).toBe("hello world");
  });

  it("handles data: prefix split across chunks", () => {
    const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    const sseParser = new SSEDataParser(lineParser);
    const events: DataEvent[] = [];
    sseParser.onData((evt) => events.push(evt));

    sseParser.processChunk("dat");
    sseParser.processChunk("a: hello\n");

    expect(events).toHaveLength(1);
    expect(events[0].payload).toBe("hello");
  });

  it("does not emit for comment lines", () => {
    const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    const sseParser = new SSEDataParser(lineParser);
    const events: DataEvent[] = [];
    sseParser.onData((evt) => events.push(evt));

    sseParser.processChunk(": OPENROUTER PROCESSING\n");

    expect(events).toHaveLength(0);
  });

  it("does not emit for empty lines", () => {
    const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    const sseParser = new SSEDataParser(lineParser);
    const events: DataEvent[] = [];
    sseParser.onData((evt) => events.push(evt));

    sseParser.processChunk("\n\n\n");

    expect(events).toHaveLength(0);
  });

  it("identifies [DONE] terminator", () => {
    const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    const sseParser = new SSEDataParser(lineParser);
    const events: DataEvent[] = [];
    sseParser.onData((evt) => events.push(evt));

    sseParser.processChunk("data: [DONE]\n");

    expect(events).toHaveLength(1);
    expect(events[0].isDone).toBe(true);
    expect(events[0].payload).toBe("[DONE]");
  });

  it("handles multiple data lines in one chunk", () => {
    const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    const sseParser = new SSEDataParser(lineParser);
    const events: DataEvent[] = [];
    sseParser.onData((evt) => events.push(evt));

    sseParser.processChunk("data: first\n\ndata: second\n");

    expect(events).toHaveLength(2);
    expect(events[0].payload).toBe("first");
    expect(events[1].payload).toBe("second");
  });

  it("handles data line without space after colon", () => {
    const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
    const sseParser = new SSEDataParser(lineParser);
    const events: DataEvent[] = [];
    sseParser.onData((evt) => events.push(evt));

    sseParser.processChunk("data:no-space\n");

    expect(events).toHaveLength(1);
    expect(events[0].payload).toBe("no-space");
  });

  describe("with random chunking", () => {
    it("extracts all data payloads from openai-stream fixture", () => {
      const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
      const sseParser = new SSEDataParser(lineParser);
      const events: DataEvent[] = [];
      sseParser.onData((evt) => events.push(evt));

      feedFixtureRandomly(sseParser, openAiStreamFixture, { seed: 12345 });

      // 33 data lines total (including [DONE])
      expect(events).toHaveLength(33);

      // Last one is [DONE]
      expect(events[events.length - 1].isDone).toBe(true);

      // Others are valid JSON
      events.slice(0, -1).forEach((evt) => {
        expect(() => JSON.parse(evt.payload)).not.toThrow();
      });
    });

    it("extracts all data payloads from fireproof fixture", () => {
      const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
      const sseParser = new SSEDataParser(lineParser);
      const events: DataEvent[] = [];
      sseParser.onData((evt) => events.push(evt));

      feedFixtureRandomly(sseParser, fireproofStreamFixture, { seed: 67890 });

      // 232 data lines total (including [DONE])
      expect(events).toHaveLength(232);

      // Last one is [DONE]
      expect(events[events.length - 1].isDone).toBe(true);
    });

    it("extracts all data payloads from weather fixture", () => {
      const lineParser = new LineStreamParser(LineStreamState.WaitingForEOL);
      const sseParser = new SSEDataParser(lineParser);
      const events: DataEvent[] = [];
      sseParser.onData((evt) => events.push(evt));

      feedFixtureRandomly(sseParser, openAiWeatherStreamFixture, { seed: 11111 });

      // 39 data lines total (including [DONE])
      expect(events).toHaveLength(39);

      // Last one is [DONE]
      expect(events[events.length - 1].isDone).toBe(true);

      // Can extract weather data from payloads
      const contentParts = events
        .filter((evt) => !evt.isDone)
        .map((evt) => {
          try {
            const parsed = JSON.parse(evt.payload);
            return parsed.choices?.[0]?.delta?.content ?? "";
          } catch {
            return "";
          }
        })
        .join("");

      expect(contentParts).toContain("New York");
      expect(contentParts).toContain("current_temp");
    });
  });
});
