import { readFileSync } from "node:fs";

import { LineEvent } from "call-ai";
import { LineStreamParser, LineStreamState } from "../../pkg/parser/line-stream.js";
import { describe, it, expect } from "vitest";

import { feedFixtureRandomly } from "./test-utils.js";

const openAiStreamFixture = readFileSync(new URL("./fixtures/openai-stream-response.json", import.meta.url), "utf8");

const openAiWeatherStreamFixture = readFileSync(new URL("./fixtures/openai-weather-response.json", import.meta.url), "utf8");

const fireproofStreamFixture = readFileSync(
  new URL("../integration/fixtures/openai-fireproof-stream-response.txt", import.meta.url),
  "utf8",
);

describe("line stream fixtures", () => {
  it("openai stream fixture retains SSE data chunks", () => {
    const matches = openAiStreamFixture.match(/^data:/gm) ?? [];
    expect(matches).toHaveLength(33);
  });

  it("openai weather stream fixture retains SSE data chunks", () => {
    const matches = openAiWeatherStreamFixture.match(/^data:/gm) ?? [];
    expect(matches).toHaveLength(39);
  });

  it("openai fireproof stream fixture retains SSE data chunks", () => {
    const matches = fireproofStreamFixture.match(/^data:/gm) ?? [];
    expect(matches).toHaveLength(232);
  });
});

describe("LineStreamParser SSE fixtures", () => {
  it("extracts OpenRouter delta content from raw SSE stream with random chunking", () => {
    // Feed raw fixture through LineStreamParser with random chunk boundaries
    const so = new LineStreamParser(LineStreamState.WaitingForEOL);
    const events: LineEvent[] = [];
    so.onEvent((evt) => events.push(evt));

    feedFixtureRandomly(so, fireproofStreamFixture, { seed: 99999 });

    // Non-accumulating: consumer must accumulate fragments into complete lines
    let currentLine = "";
    const completedLines: string[] = [];

    events.forEach((evt) => {
      if (evt.type === "line.fragment") {
        currentLine += evt.fragment;
        if (evt.lineComplete) {
          if (currentLine.startsWith("data: ") && !currentLine.includes("[DONE]")) {
            completedLines.push(currentLine);
          }
          currentLine = "";
        }
      }
    });

    // Parse the JSON from each data line and extract delta.content
    const contentParts = completedLines
      .map((line: string) => {
        try {
          const parsed = JSON.parse(line.slice(6));
          return parsed.choices?.[0]?.delta?.content ?? "";
        } catch {
          return "";
        }
      })
      .join("");

    // Verify the combined content contains expected code
    expect(contentParts).toContain("import { useFireproof }");
    expect(contentParts).toContain("function App()");

    const expectedLineCount = (fireproofStreamFixture.match(/^data:/gm)?.length ?? 0) - 1; // exclude [DONE]
    expect(completedLines.length).toBe(expectedLineCount);
  });
});
