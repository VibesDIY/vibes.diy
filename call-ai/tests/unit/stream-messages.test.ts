import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  StreamMessageSchema,
  StreamTypes,
  createMessage,
  isMessageType,
  nextId,
  nextStreamId,
} from "../../pkg/stream-messages.js";

// =============================================================================
// Fixture Helpers
// =============================================================================

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(FIXTURE_DIR, name), "utf-8");
}

function string2stream(data: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}

/**
 * Rebuffer a stream into chunks of specified size
 * Useful for testing parser behavior with arbitrary chunk boundaries
 */
async function* rebuffer(stream: ReadableStream<Uint8Array>, chunkSize: number): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  let buffer = new Uint8Array(0);

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
      }

      while (buffer.length >= chunkSize) {
        yield buffer.slice(0, chunkSize);
        buffer = buffer.slice(chunkSize);
      }

      if (done) {
        if (buffer.length > 0) {
          yield buffer;
        }
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe("StreamMessage Schemas", () => {
  it("validates stream.start message", () => {
    const msg = createMessage(StreamTypes.STREAM_START, "openai/gpt-4o", "conn_123", {
      streamId: nextStreamId(),
      model: "openai/gpt-4o",
      timestamp: Date.now(),
    });

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it("validates code.fragment message", () => {
    const msg = createMessage(StreamTypes.CODE_FRAGMENT, "anthropic/claude-3.5-sonnet", "conn_456", {
      streamId: 1,
      blockId: "block_1",
      seq: "0",
      frag: "const x = 1;",
    });

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it("validates code.full message (complete code block)", () => {
    const msg = createMessage(StreamTypes.CODE_FULL, "openai/gpt-4o", "conn_789", {
      streamId: 1,
      blockId: "block_1",
      language: "tsx",
      block: "const x: number = 1;\nconsole.log(x);",
    });

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it("validates code.edit message (Claude str_replace style)", () => {
    const msg = createMessage(StreamTypes.CODE_EDIT, "anthropic/claude-3.5-sonnet", "conn_789", {
      streamId: 1,
      blockId: "block_1",
      language: "tsx",
      edits: [
        { oldStr: "const x = 1", newStr: "const x: number = 1" },
        { oldStr: "console.log(x)", newStr: "console.log(x);" },
      ],
    });

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it("validates text.fragment with string seq", () => {
    const msg = createMessage(StreamTypes.TEXT_FRAGMENT, "openai/gpt-4o", "conn_1", {
      streamId: 1,
      seq: "chunk_42",
      frag: "Hello world",
    });

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it("validates img message", () => {
    const msg = createMessage(StreamTypes.IMG, "openai/gpt-4o", "conn_1", {
      streamId: 1,
      url: "https://example.com/image.png",
      revisedPrompt: "A beautiful sunset",
    });

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(true);
  });

  it("rejects img message without url or base64", () => {
    const msg = createMessage(StreamTypes.IMG, "openai/gpt-4o", "conn_1", {
      streamId: 1,
      revisedPrompt: "Still life",
    } as any);

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(false);
  });

  it("rejects invalid message type", () => {
    const badMsg = {
      type: "invalid.type",
      src: "test",
      dst: "test",
      ttl: 3,
      payload: {},
    };

    const result = StreamMessageSchema.safeParse(badMsg);
    expect(result.success).toBe(false);
  });

  it("rejects negative TTL", () => {
    const msg = {
      type: StreamTypes.STREAM_START,
      src: "openai/gpt-4o",
      dst: "conn_123",
      ttl: -1,
      payload: {
        streamId: 1,
        model: "openai/gpt-4o",
        timestamp: Date.now(),
      },
    };

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(false);
  });

  it("requires streamId to be number", () => {
    const msg = {
      type: StreamTypes.CODE_FRAGMENT,
      src: "openai/gpt-4o",
      dst: "conn_1",
      ttl: 3,
      payload: {
        streamId: "not-a-number", // Should be number
        blockId: "block_1",
        seq: "0",
        frag: "code",
      },
    };

    const result = StreamMessageSchema.safeParse(msg);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe("isMessageType", () => {
  it("correctly identifies message types", () => {
    const msg = createMessage(StreamTypes.CODE_FRAGMENT, "openai/gpt-4o", "conn_1", {
      streamId: 1,
      blockId: "b1",
      seq: "0",
      frag: "code",
    });

    expect(isMessageType(msg, StreamTypes.CODE_FRAGMENT)).toBe(true);
    expect(isMessageType(msg, StreamTypes.TEXT_FRAGMENT)).toBe(false);
  });
});

// =============================================================================
// ID Generator Tests
// =============================================================================

describe("nextId", () => {
  it("generates unique string IDs", () => {
    const id1 = nextId("stream");
    const id2 = nextId("stream");
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^stream_/);
    // cement's nextId generates variable-length IDs
    expect(id1.length).toBeGreaterThanOrEqual(10);
  });
});

describe("nextStreamId", () => {
  it("generates incrementing numeric IDs", () => {
    const id1 = nextStreamId();
    const id2 = nextStreamId();
    expect(typeof id1).toBe("number");
    expect(id2).toBe(id1 + 1);
  });
});

// =============================================================================
// Rebuffer Tests
// =============================================================================

describe("rebuffer", () => {
  it("chunks stream data correctly", async () => {
    const data = "Hello, World!";
    const stream = string2stream(data);
    const chunks: Uint8Array[] = [];

    for await (const chunk of rebuffer(stream, 5)) {
      chunks.push(chunk);
    }

    const decoder = new TextDecoder();
    const reassembled = chunks.map((c) => decoder.decode(c)).join("");
    expect(reassembled).toBe(data);
    expect(chunks.length).toBe(3); // "Hello", ", Wor", "ld!"
  });
});

// =============================================================================
// Type Constants Tests
// =============================================================================

describe("StreamTypes", () => {
  it("uses lowercase dotted format", () => {
    expect(StreamTypes.STREAM_START).toBe("callai.stream.start");
    expect(StreamTypes.CODE_FRAGMENT).toBe("callai.code.fragment");
    expect(StreamTypes.IMG).toBe("callai.img");
  });
});

// =============================================================================
// Parser Integration Test (placeholder for XState implementation)
// =============================================================================

describe.skip("AIStreamParser", () => {
  it("parses SSE stream and emits semantic events", async () => {
    const fixture = loadFixture("openai-stream-response.json");
    const stream = string2stream(fixture);
    const _ibuf = rebuffer(stream, 511);

    // TODO: Implement AIStreamParser with XState
    // const parser = new AIStreamParser();
    const _events = vi.fn();

    // parser.on(StreamTypes.CODE_FRAGMENT, (payload) => {
    //   _events("codeFragment", payload.frag);
    // });
    // parser.on(StreamTypes.STREAM_END, (payload) => {
    //   _events("complete");
    //   parser.stop();
    // });
    // parser.on(StreamTypes.STREAM_ERROR, (payload) => {
    //   _events("error", payload.message);
    // });

    // await parser.startStream(_ibuf);

    // expect(_events.mock.calls).toEqual([
    //   ["codeFragment", "..."],
    //   ["complete"],
    // ]);
  });
});
