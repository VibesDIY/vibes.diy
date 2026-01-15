import { describe, it, expect, vi } from "vitest";

// Import the types and classes we'll create
import {
  ParserEvento,
  ParserHandler,
  ParserEvent,
  orJson,
  orDone,
  orImage,
  isParserEventError,
} from "@vibes.diy/call-ai-base";

describe("ParserEvento", () => {
  describe("handler registration and triggering", () => {
    it("triggers handlers that validate the event type", () => {
      const evento = new ParserEvento();
      const handleFn = vi.fn();

      const handler: ParserHandler = {
        hash: "test-handler",
        validate: (event) => {
          // Only handle or.json events
          if (event.type === "or.json") {
            return { some: event };
          }
          return { none: true };
        },
        handle: handleFn,
      };

      evento.push(handler);
      evento.trigger({ type: "or.json", json: { test: "data" } });

      expect(handleFn).toHaveBeenCalledTimes(1);
      expect(handleFn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: { type: "or.json", json: { test: "data" } },
        }),
      );
    });

    it("does not trigger handlers when validation returns none", () => {
      const evento = new ParserEvento();
      const handleFn = vi.fn();

      const handler: ParserHandler = {
        hash: "json-only-handler",
        validate: (event) => {
          if (event.type === "or.json") {
            return { some: event };
          }
          return { none: true };
        },
        handle: handleFn,
      };

      evento.push(handler);
      evento.trigger({ type: "or.done", finishReason: "stop" });

      expect(handleFn).not.toHaveBeenCalled();
    });

    it("triggers multiple handlers for matching events", () => {
      const evento = new ParserEvento();
      const handleFn1 = vi.fn();
      const handleFn2 = vi.fn();

      const handler1: ParserHandler = {
        hash: "handler-1",
        validate: (event) => (event.type === "or.json" ? { some: event } : { none: true }),
        handle: handleFn1,
      };

      const handler2: ParserHandler = {
        hash: "handler-2",
        validate: (event) => (event.type === "or.json" ? { some: event } : { none: true }),
        handle: handleFn2,
      };

      evento.push(handler1, handler2);
      evento.trigger({ type: "or.json", json: {} });

      expect(handleFn1).toHaveBeenCalledTimes(1);
      expect(handleFn2).toHaveBeenCalledTimes(1);
    });
  });

  describe("event emission from handlers", () => {
    it("emits events from handlers to onEvent subscribers", () => {
      const evento = new ParserEvento();
      const receivedEvents: ParserEvent[] = [];

      evento.onEvent((event) => receivedEvents.push(event));

      const handler: ParserHandler = {
        hash: "image-extractor",
        validate: (event) => (event.type === "or.json" ? { some: event } : { none: true }),
        handle: (ctx) => {
          // Handler emits an image event
          ctx.emit({ type: "or.image", index: 0, b64_json: "abc123", url: undefined });
        },
      };

      evento.push(handler);
      evento.trigger({ type: "or.json", json: { data: [{ b64_json: "abc123" }] } });

      expect(receivedEvents).toContainEqual({
        type: "or.image",
        index: 0,
        b64_json: "abc123",
        url: undefined,
      });
    });

    it("passes through events that no handler modifies", () => {
      const evento = new ParserEvento();
      const receivedEvents: ParserEvent[] = [];

      evento.onEvent((event) => receivedEvents.push(event));

      // Handler that only processes or.json, ignores or.done
      const handler: ParserHandler = {
        hash: "json-processor",
        validate: (event) => (event.type === "or.json" ? { some: event } : { none: true }),
        handle: () => {
          // Does nothing
        },
      };

      evento.push(handler);
      evento.trigger({ type: "or.done", finishReason: "stop" });

      // The or.done event should still be emitted to subscribers
      expect(receivedEvents).toContainEqual({ type: "or.done", finishReason: "stop" });
    });
  });

  describe("arktype event validation", () => {
    it("validates or.json events with arktype schema", () => {
      const result = orJson({ type: "or.json", json: { test: "value" } });
      expect(isParserEventError(result)).toBe(false);
      expect(result).toEqual({ type: "or.json", json: { test: "value" } });
    });

    it("validates or.done events with arktype schema", () => {
      const result = orDone({ type: "or.done", finishReason: "stop" });
      expect(isParserEventError(result)).toBe(false);
      expect(result).toEqual({ type: "or.done", finishReason: "stop" });
    });

    it("validates or.image events with arktype schema", () => {
      const result = orImage({ type: "or.image", index: 0, b64_json: "abc", url: undefined });
      expect(isParserEventError(result)).toBe(false);
    });

    it("rejects invalid events", () => {
      const result = orJson({ type: "or.json" }); // missing json field
      expect(isParserEventError(result)).toBe(true);
    });
  });
});
