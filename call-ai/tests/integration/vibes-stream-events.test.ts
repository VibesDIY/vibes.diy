import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

import { VibesStream, VibesEvent, vibesEvent, isVibesEventError } from "call-ai";

const fireproofStreamFixture = readFileSync(
  new URL("./fixtures/openai-fireproof-stream-response.txt", import.meta.url),
  "utf8",
);

describe("VibesStream", () => {
  describe("event emission", () => {
    it("should emit vibes.begin on process start", async () => {
      const stream = new VibesStream();
      const events: VibesEvent[] = [];
      stream.onEvent((evt) => events.push(evt));

      // Feed fixture directly (bypass network)
      stream.processChunk(fireproofStreamFixture);
      stream.finalize();

      const beginEvents = events.filter((e) => e.type === "vibes.begin");
      expect(beginEvents).toHaveLength(1);
      expect(beginEvents[0]).toMatchObject({
        type: "vibes.begin",
        streamId: expect.any(String),
      });
    });

    it("should emit vibes.update events as content streams", async () => {
      const stream = new VibesStream();
      const events: VibesEvent[] = [];
      stream.onEvent((evt) => events.push(evt));

      stream.processChunk(fireproofStreamFixture);
      stream.finalize();

      const updateEvents = events.filter((e) => e.type === "vibes.update");
      expect(updateEvents.length).toBeGreaterThan(0);

      // Each update should have text and segments
      updateEvents.forEach((evt) => {
        if (evt.type === "vibes.update") {
          expect(typeof evt.text).toBe("string");
          expect(Array.isArray(evt.segments)).toBe(true);
        }
      });
    });

    it("should emit vibes.end on stream completion", async () => {
      const stream = new VibesStream();
      const events: VibesEvent[] = [];
      stream.onEvent((evt) => events.push(evt));

      stream.processChunk(fireproofStreamFixture);
      stream.finalize();

      const endEvents = events.filter((e) => e.type === "vibes.end");
      expect(endEvents).toHaveLength(1);
      expect(endEvents[0]).toMatchObject({
        type: "vibes.end",
        streamId: expect.any(String),
        text: expect.any(String),
        segments: expect.any(Array),
      });
    });

    it("should have matching streamId in begin and end events", async () => {
      const stream = new VibesStream();
      const events: VibesEvent[] = [];
      stream.onEvent((evt) => events.push(evt));

      stream.processChunk(fireproofStreamFixture);
      stream.finalize();

      const beginEvent = events.find((e) => e.type === "vibes.begin");
      const endEvent = events.find((e) => e.type === "vibes.end");

      expect(beginEvent).toBeDefined();
      expect(endEvent).toBeDefined();
      if (beginEvent?.type === "vibes.begin" && endEvent?.type === "vibes.end") {
        expect(beginEvent.streamId).toBe(endEvent.streamId);
      }
    });

    it("should validate all events with arktype", async () => {
      const stream = new VibesStream();
      const events: VibesEvent[] = [];

      stream.onEvent((evt) => {
        const result = vibesEvent(evt);
        if (isVibesEventError(result)) {
          throw new Error(`Invalid event: ${JSON.stringify(evt)}`);
        }
        events.push(evt);
      });

      stream.processChunk(fireproofStreamFixture);
      stream.finalize();

      expect(events.length).toBeGreaterThan(2); // begin + updates + end
    });
  });

  describe("content parsing", () => {
    it("should accumulate segments with markdown and code", async () => {
      const stream = new VibesStream();
      const events: VibesEvent[] = [];
      stream.onEvent((evt) => events.push(evt));

      stream.processChunk(fireproofStreamFixture);
      stream.finalize();

      const endEvent = events.find((e) => e.type === "vibes.end");
      expect(endEvent).toBeDefined();

      if (endEvent?.type === "vibes.end") {
        // Should have parsed code content
        expect(endEvent.text).toContain("import { useFireproof }");
        expect(endEvent.text).toContain("function App()");

        // Should have segments
        expect(endEvent.segments.length).toBeGreaterThan(0);
      }
    });

    it("should include stats in end event when available", async () => {
      const stream = new VibesStream();
      const events: VibesEvent[] = [];
      stream.onEvent((evt) => events.push(evt));

      stream.processChunk(fireproofStreamFixture);
      stream.finalize();

      const endEvent = events.find((e) => e.type === "vibes.end");
      if (endEvent?.type === "vibes.end") {
        // Stats should be present (may have undefined values if not in fixture)
        expect(endEvent.stats).toBeDefined();
      }
    });
  });

  describe("event order", () => {
    it("should emit events in order: begin, updates..., end", async () => {
      const stream = new VibesStream();
      const eventTypes: string[] = [];
      stream.onEvent((evt) => eventTypes.push(evt.type));

      stream.processChunk(fireproofStreamFixture);
      stream.finalize();

      expect(eventTypes[0]).toBe("vibes.begin");
      expect(eventTypes[eventTypes.length - 1]).toBe("vibes.end");

      // All middle events should be updates
      const middleEvents = eventTypes.slice(1, -1);
      middleEvents.forEach((type) => {
        expect(type).toBe("vibes.update");
      });
    });
  });
});
