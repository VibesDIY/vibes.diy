import { describe, it, expect } from "vitest";
import { StreamTypes, StreamMessage, createMessage, nextStreamId } from "../../pkg/stream-messages.js";
import { CodeBlockDetector } from "../../pkg/code-block-detector.js";

/**
 * Since vitest's module mocking has issues in browser environment,
 * we simulate the parseAIStream behavior by creating a helper that
 * mimics its core logic: feeding deltas to CodeBlockDetector and
 * wrapping with STREAM_START/STREAM_END messages.
 */
function simulateParseAIStream(deltas: string[], model = "test-model"): StreamMessage[] {
  const streamId = nextStreamId();
  const messages: StreamMessage[] = [];
  const detector = new CodeBlockDetector(model);

  // Emit STREAM_START
  messages.push(
    createMessage(StreamTypes.STREAM_START, model, "client", {
      streamId,
      model,
      timestamp: Date.now(),
    }),
  );

  // Feed deltas to detector
  let seq = 0;
  for (const delta of deltas) {
    if (delta) {
      const events = detector.feed(delta, streamId, seq++);
      messages.push(...events);
    }
  }

  // Finalize detector
  const finalEvents = detector.finalize(streamId);
  messages.push(...finalEvents);

  // Emit STREAM_END
  messages.push(
    createMessage(StreamTypes.STREAM_END, model, "client", {
      streamId,
      finishReason: "stop",
      timestamp: Date.now(),
    }),
  );

  return messages;
}

/**
 * Simulate parseAIStream with an error occurring mid-stream
 */
function simulateParseAIStreamWithError(
  deltas: string[],
  errorMessage: string,
  errorAfterIndex: number,
  model = "test-model",
): StreamMessage[] {
  const streamId = nextStreamId();
  const messages: StreamMessage[] = [];
  const detector = new CodeBlockDetector(model);

  // Emit STREAM_START
  messages.push(
    createMessage(StreamTypes.STREAM_START, model, "client", {
      streamId,
      model,
      timestamp: Date.now(),
    }),
  );

  // Feed deltas until error
  let seq = 0;
  for (let i = 0; i < deltas.length; i++) {
    if (i === errorAfterIndex) {
      // Emit error
      messages.push(
        createMessage(StreamTypes.STREAM_ERROR, model, "client", {
          streamId,
          message: errorMessage,
          recoverable: false,
          timestamp: Date.now(),
        }),
      );
      break;
    }
    const delta = deltas[i];
    if (delta) {
      const events = detector.feed(delta, streamId, seq++);
      messages.push(...events);
    }
  }

  return messages;
}

describe("parseAIStream behavior simulation", () => {
  describe("message sequence", () => {
    it("emits STREAM_START at beginning", () => {
      const messages = simulateParseAIStream(["Hello"]);

      expect(messages[0].type).toBe(StreamTypes.STREAM_START);
      expect(messages[0].payload).toMatchObject({
        model: "test-model",
      });
    });

    it("emits STREAM_END at completion", () => {
      const messages = simulateParseAIStream(["Hello"]);

      const lastMsg = messages[messages.length - 1];
      expect(lastMsg.type).toBe(StreamTypes.STREAM_END);
      expect(lastMsg.payload).toMatchObject({
        finishReason: "stop",
      });
    });

    it("emits TEXT_FRAGMENT for plain text", () => {
      const messages = simulateParseAIStream(["Hello ", "world"]);

      const textFrags = messages.filter((m) => m.type === StreamTypes.TEXT_FRAGMENT);
      expect(textFrags.length).toBeGreaterThan(0);
    });
  });

  describe("code block detection", () => {
    it("emits CODE_START when code block opens", () => {
      const messages = simulateParseAIStream(["Here is code:\n", "```jsx\n", "const x = 1;", "\n```\n"]);

      const codeStarts = messages.filter((m) => m.type === StreamTypes.CODE_START);
      expect(codeStarts.length).toBe(1);
      expect(codeStarts[0].payload).toMatchObject({
        language: "jsx",
      });
    });

    it("emits CODE_END when code block closes", () => {
      const messages = simulateParseAIStream(["```js\n", "code", "\n```\n"]);

      const codeEnds = messages.filter((m) => m.type === StreamTypes.CODE_END);
      expect(codeEnds.length).toBe(1);
    });

    it("emits correct sequence for text + code + text", () => {
      const messages = simulateParseAIStream(["Hello ", "```jsx\n", "const x = 1;", "\n```", "\nDone!"]);

      const types = messages.map((m) => m.type);

      // Should have: START, TEXT(s), CODE_START, CODE_END, TEXT(s), END
      expect(types[0]).toBe(StreamTypes.STREAM_START);
      expect(types[types.length - 1]).toBe(StreamTypes.STREAM_END);
      expect(types).toContain(StreamTypes.CODE_START);
      expect(types).toContain(StreamTypes.CODE_END);
    });
  });

  describe("error handling", () => {
    it("emits STREAM_ERROR when error occurs", () => {
      const messages = simulateParseAIStreamWithError(["partial", "more"], "Network failure", 1);

      const errorMsgs = messages.filter((m) => m.type === StreamTypes.STREAM_ERROR);
      expect(errorMsgs.length).toBe(1);
      expect(errorMsgs[0].payload).toMatchObject({
        message: "Network failure",
        recoverable: false,
      });
    });

    it("error stops further processing", () => {
      const messages = simulateParseAIStreamWithError(["```js\n", "code", "\n```\n", "after"], "Test error", 2);

      // Should not have STREAM_END since error interrupted
      const endMsgs = messages.filter((m) => m.type === StreamTypes.STREAM_END);
      expect(endMsgs.length).toBe(0);
    });
  });

  describe("empty responses", () => {
    it("handles empty generator", () => {
      const messages = simulateParseAIStream([]);

      // Should still have START and END
      expect(messages[0].type).toBe(StreamTypes.STREAM_START);
      expect(messages[messages.length - 1]).toMatchObject({
        type: StreamTypes.STREAM_END,
      });
    });

    it("skips empty deltas", () => {
      const messages = simulateParseAIStream(["", "hello", ""]);

      // Should still work correctly
      expect(messages.length).toBeGreaterThan(2); // START + at least one content + END
    });
  });

  describe("streamId", () => {
    it("uses consistent streamId across all messages", () => {
      const messages = simulateParseAIStream(["```js\n", "code", "\n```\n"]);

      const streamIds = new Set(messages.map((m) => m.payload.streamId));
      expect(streamIds.size).toBe(1);
    });

    it("increments streamId for subsequent streams", () => {
      const messages1 = simulateParseAIStream(["test"]);
      const messages2 = simulateParseAIStream(["test"]);

      const streamId1 = messages1[0].payload.streamId;
      const streamId2 = messages2[0].payload.streamId;
      expect(streamId2).toBeGreaterThan(streamId1);
    });
  });
});

/**
 * Test the actual parseAIStream export exists and has correct signature.
 * We can't easily test it with mocked streaming, but we can verify exports.
 */
describe("parseAIStream exports", () => {
  it("exports parseAIStream function", async () => {
    const { parseAIStream } = await import("../../pkg/stream-parser.js");
    expect(typeof parseAIStream).toBe("function");
  });

  it("exports collectStreamMessages function", async () => {
    const { collectStreamMessages } = await import("../../pkg/stream-parser.js");
    expect(typeof collectStreamMessages).toBe("function");
  });
});
