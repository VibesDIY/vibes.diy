import { readFileSync } from "node:fs";

import { LineEvent } from "@vibes.diy/call-ai-base";
import { LineStreamParser, LineStreamState } from "@vibes.diy/call-ai-base";
import { describe, it, expect } from "vitest";

import { feedFixtureRandomly } from "./test-utils.js";

const openAiStreamFixture = readFileSync(new URL("./fixtures/openai-stream-response.json", import.meta.url), "utf8");

const openAiWeatherStreamFixture = readFileSync(new URL("./fixtures/openai-weather-response.json", import.meta.url), "utf8");

const fireproofStreamFixture = readFileSync(
  new URL("../integration/fixtures/openai-fireproof-stream-response.txt", import.meta.url),
  "utf8",
);

/**
 * SSE (Server-Sent Events) format per MDN spec:
 * - Messages separated by double newline (\n\n)
 * - Fields: `fieldname: value` (colon + space + value)
 * - Lines starting with `:` are comments
 * - `data:` field contains the payload
 * - `data: [DONE]` signals stream end
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
 */

describe("SSE envelope parsing", () => {
  describe("openai-stream fixture (book recommendation)", () => {
    it("identifies SSE comments (keepalive lines)", () => {
      const comments = openAiStreamFixture.match(/^: .+$/gm) ?? [];
      expect(comments).toHaveLength(13);
      expect(comments[0]).toBe(": OPENROUTER PROCESSING");
    });

    it("identifies data events", () => {
      const dataLines = openAiStreamFixture.match(/^data: .+$/gm) ?? [];
      expect(dataLines).toHaveLength(33);
    });

    it("identifies [DONE] terminator", () => {
      const doneLines = openAiStreamFixture.match(/^data: \[DONE\]$/gm) ?? [];
      expect(doneLines).toHaveLength(1);
    });

    it("parses data payloads as JSON with OpenRouter structure", () => {
      const dataLines = openAiStreamFixture.match(/^data: .+$/gm) ?? [];
      const jsonPayloads = dataLines.filter((line) => !line.includes("[DONE]")).map((line) => JSON.parse(line.slice(6)));

      expect(jsonPayloads[0]).toMatchObject({
        provider: "OpenAI",
        model: "openai/gpt-4o",
        object: "chat.completion.chunk",
        choices: expect.any(Array),
      });

      // First chunk has role but empty content
      expect(jsonPayloads[0].choices[0].delta).toMatchObject({
        role: "assistant",
        content: "",
      });

      // Later chunks have content
      const withContent = jsonPayloads.filter((p) => p.choices[0]?.delta?.content?.length > 0);
      expect(withContent.length).toBeGreaterThan(0);

      // Last data chunk before [DONE] has finish_reason
      const lastChunk = jsonPayloads[jsonPayloads.length - 1];
      expect(lastChunk.usage).toBeDefined();
    });
  });

  describe("openai-weather fixture", () => {
    it("identifies SSE comments", () => {
      const comments = openAiWeatherStreamFixture.match(/^: .+$/gm) ?? [];
      expect(comments).toHaveLength(1);
    });

    it("identifies data events", () => {
      const dataLines = openAiWeatherStreamFixture.match(/^data: .+$/gm) ?? [];
      expect(dataLines).toHaveLength(39);
    });

    it("identifies [DONE] terminator", () => {
      const doneLines = openAiWeatherStreamFixture.match(/^data: \[DONE\]$/gm) ?? [];
      expect(doneLines).toHaveLength(1);
    });

    it("extracts weather JSON from content deltas", () => {
      const dataLines = openAiWeatherStreamFixture.match(/^data: .+$/gm) ?? [];
      const jsonPayloads = dataLines.filter((line) => !line.includes("[DONE]")).map((line) => JSON.parse(line.slice(6)));

      const contentParts = jsonPayloads.map((p) => p.choices[0]?.delta?.content ?? "").join("");

      expect(contentParts).toContain("New York");
      expect(contentParts).toContain("current_temp");
      expect(contentParts).toContain("conditions");
    });
  });

  describe("fireproof-stream fixture (app generation)", () => {
    it("has no SSE comments", () => {
      const comments = fireproofStreamFixture.match(/^: .+$/gm) ?? [];
      expect(comments).toHaveLength(0);
    });

    it("identifies data events", () => {
      const dataLines = fireproofStreamFixture.match(/^data: .+$/gm) ?? [];
      expect(dataLines).toHaveLength(232);
    });

    it("identifies [DONE] terminator", () => {
      const doneLines = fireproofStreamFixture.match(/^data: \[DONE\]$/gm) ?? [];
      expect(doneLines).toHaveLength(1);
    });

    it("extracts code content from deltas", () => {
      const dataLines = fireproofStreamFixture.match(/^data: .+$/gm) ?? [];
      const jsonPayloads = dataLines.filter((line) => !line.includes("[DONE]")).map((line) => JSON.parse(line.slice(6)));

      const contentParts = jsonPayloads.map((p) => p.choices[0]?.delta?.content ?? "").join("");

      expect(contentParts).toContain("import { useFireproof }");
      expect(contentParts).toContain("function App()");
    });
  });

  describe("LineStreamParser with SSE EOL mode (random chunking)", () => {
    // Expected line counts (deterministic - independent of chunk boundaries)
    const OPENAI_STREAM_EXPECTED = { dataLines: 33, commentLines: 13 };
    const FIREPROOF_EXPECTED = { dataLines: 232, commentLines: 0 };
    const WEATHER_EXPECTED = { dataLines: 39, commentLines: 1 };

    // Helper to accumulate fragments into complete lines (consumer-side accumulation)
    function accumulateLines(events: LineEvent[]): string[] {
      let currentLine = "";
      const lines: string[] = [];
      events.forEach((evt) => {
        if (evt.type === "line.fragment") {
          currentLine += evt.fragment;
          if (evt.lineComplete) {
            lines.push(currentLine);
            currentLine = "";
          }
        }
      });
      return lines;
    }

    it("parses SSE lines from openai-stream fixture with random chunks", () => {
      const so = new LineStreamParser(LineStreamState.WaitingForEOL);
      const events: LineEvent[] = [];
      so.onEvent((evt) => events.push(evt));

      // Feed raw fixture with random chunk boundaries (seeded for reproducibility)
      feedFixtureRandomly(so, openAiStreamFixture, { seed: 12345 });

      // Consumer accumulates fragments into complete lines
      const completedLines = accumulateLines(events);

      // Count data lines
      const dataLineCount = completedLines.filter((line: string) => line.startsWith("data:")).length;
      expect(dataLineCount).toBe(OPENAI_STREAM_EXPECTED.dataLines);

      // Count comment lines
      const commentLineCount = completedLines.filter((line: string) => line.startsWith(":")).length;
      expect(commentLineCount).toBe(OPENAI_STREAM_EXPECTED.commentLines);
    });

    it("parses SSE lines from fireproof fixture with random chunks", () => {
      const so = new LineStreamParser(LineStreamState.WaitingForEOL);
      const events: LineEvent[] = [];
      so.onEvent((evt) => events.push(evt));

      // Feed raw fixture with random chunk boundaries
      feedFixtureRandomly(so, fireproofStreamFixture, { seed: 67890 });

      // Consumer accumulates fragments into complete lines
      const completedLines = accumulateLines(events);

      const dataLineCount = completedLines.filter((line: string) => line.startsWith("data:")).length;
      expect(dataLineCount).toBe(FIREPROOF_EXPECTED.dataLines);
    });

    it("parses SSE lines from weather fixture with random chunks", () => {
      const so = new LineStreamParser(LineStreamState.WaitingForEOL);
      const events: LineEvent[] = [];
      so.onEvent((evt) => events.push(evt));

      feedFixtureRandomly(so, openAiWeatherStreamFixture, { seed: 11111 });

      // Consumer accumulates fragments into complete lines
      const completedLines = accumulateLines(events);

      const dataLineCount = completedLines.filter((line: string) => line.startsWith("data:")).length;
      expect(dataLineCount).toBe(WEATHER_EXPECTED.dataLines);

      const commentLineCount = completedLines.filter((line: string) => line.startsWith(":")).length;
      expect(commentLineCount).toBe(WEATHER_EXPECTED.commentLines);
    });
  });
});
