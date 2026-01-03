# Plan: Integrate Stream-Messages Protocol with Existing Parsers

## Goal

Emit semantic `stream-messages` events from the existing SSE parsing pipeline, starting with the basic streaming codepath in `call-ai/pkg/streaming.ts`.

---

## Phase 1 Implementation Complete - Issues Identified

Phase 1 has been implemented but has critical issues that need to be addressed in Phase 1.1:

### Critical Issue: CodeBlockDetector Buffers Too Much

The current implementation buffers all content and only emits fragments on state transitions or finalize, defeating the "live streaming" goal:

**Problem in TEXT state (lines 135-162):**
- Characters are appended to `this.buffer`
- TEXT_FRAGMENT is only emitted when a fence marker ``` is detected (line 144-152)
- For pure prose streams (no code blocks), **no TEXT_FRAGMENT events are emitted until finalize()**

**Problem in IN_CODE state (lines 203-221):**
- Characters are appended to `this.buffer`
- CODE_FRAGMENT is only emitted when closing fence is detected (lines 229-240)
- Large code blocks accumulate in memory, no incremental updates to UI

**Impact:**
- Streaming UIs won't see progressive updates as the model writes
- Memory grows with entire response (unbounded buffer)
- parseAIStream consumers expecting real-time events get nothing until stream ends

### Missing Test Coverage

The `stream-parser.test.ts` tests use `simulateParseAIStream()` helper rather than testing the actual `parseAIStream` function. This means:
- Wiring bugs between parseAIStream, callAIStreaming, and CodeBlockDetector are untested
- The buffering behavior above is not detected by tests

---

## Phase 1.1: Fix Incremental Streaming (NEXT)

### Design Decision: Emit on Each Delta Chunk

Emit one TEXT_FRAGMENT or CODE_FRAGMENT per delta chunk from callAIStreaming, not per character. This balances streaming responsiveness with overhead.

**Key insight**: The current implementation processes char-by-char but only emits at state transitions. We should emit at the end of processing each delta, not just at fence boundaries.

**New approach - emit accumulated content at end of feed():**

```typescript
feed(delta: string, streamId: number, seq: number): StreamMessage[] {
  const events: StreamMessage[] = [];

  // Track content to emit at end of this delta
  let textToEmit = "";
  let codeToEmit = "";

  for (const char of delta) {
    // ... existing char processing for state transitions ...

    // Instead of buffering indefinitely, track what to emit
    if (this.state === "TEXT" && char !== "`") {
      textToEmit += char;
    } else if (this.state === "IN_CODE" && char !== "`") {
      codeToEmit += char;
    }
    // Backticks still go to buffer for fence detection
  }

  // Emit accumulated content from this delta
  if (textToEmit.length > 0) {
    events.push(createMessage(StreamTypes.TEXT_FRAGMENT, ...));
  }
  if (codeToEmit.length > 0 && this.currentBlock) {
    events.push(createMessage(StreamTypes.CODE_FRAGMENT, ...));
  }

  return events;
}
```

**Result**: Each call to `feed()` emits events for the content in that delta, rather than buffering across multiple deltas.

### Files to Modify

1. **`call-ai/pkg/code-block-detector.ts`**
   - Restructure `feed()` to emit at end of processing each delta
   - Track `textToEmit` and `codeToEmit` during char loop
   - Emit TEXT_FRAGMENT/CODE_FRAGMENT before returning from feed()
   - Only buffer backticks for fence detection

2. **`call-ai/tests/unit/code-block-detector.test.ts`**
   - Add tests verifying per-delta emission:
     - "emits TEXT_FRAGMENT for text delta" (feed("Hello") → 1 TEXT_FRAGMENT)
     - "emits CODE_FRAGMENT for code delta" (feed after CODE_START → 1 CODE_FRAGMENT)
     - "emits nothing for backtick-only delta" (potential fence marker)
     - "emits both text and code when delta crosses fence boundary"

3. **`call-ai/tests/unit/stream-parser.test.ts`**
   - Add integration tests that use actual `parseAIStream`:
     - Use dependency injection (pass mock callAIStreaming via options.mock)
     - Verify real event emission sequence matches expectations
     - Test error propagation from parseAIStream

### Implementation Steps

1. **Restructure CodeBlockDetector.feed()**
   - Add local vars: `textToEmit = ""`, `codeToEmit = ""`
   - In TEXT state: append non-backtick chars to textToEmit
   - In IN_CODE state: append non-backtick chars to codeToEmit
   - At end of feed(): emit TEXT_FRAGMENT if textToEmit, CODE_FRAGMENT if codeToEmit
   - Backticks still go to `this.buffer` for fence detection

2. **Update tests for per-delta emission**
   - Existing tests should still pass (final content is same)
   - Add new tests asserting event count per feed() call

3. **Add parseAIStream integration tests**
   - Add `mock.callAIStreaming` injection point in stream-parser.ts
   - Write tests that verify actual async generator behavior
   - Test error handling path

### Trade-offs

**Pro: True streaming**
- UI gets updates as deltas arrive
- Bounded memory (only fence markers buffered)
- Matches consumer expectations

**Con: Slightly more events**
- One event per delta instead of one per fence transition
- Still reasonable overhead (deltas are typically sentences/words)

**Alternative considered**: Per-character emission rejected as too much overhead.

---

## Current Architecture (Reference)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  callAIStreaming() - streaming.ts:422                                       │
│  Entry point for streaming AI responses                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Takes: prompt (string | Message[]), options (CallAIOptions)             │
│  2. Builds: fetch request with model, headers, body                         │
│  3. Calls: createStreamingGenerator() for SSE parsing                       │
│  4. Yields: string chunks (accumulated completeText) via yield*             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  createStreamingGenerator() - streaming.ts:17                               │
│  Core SSE parser with buffer accumulation                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Buffer accumulation pattern:                                               │
│    buffer += textDecoder.decode(value, { stream: true })                    │
│    const messages = buffer.split(/\n\n/)                                    │
│    buffer = messages.pop() || ""                                            │
│                                                                             │
│  For each complete SSE message:                                             │
│    - Skip non-data lines                                                    │
│    - Skip [DONE] marker                                                     │
│    - JSON.parse the payload                                                 │
│    - Check for errors in response                                           │
│    - Handle tool calls (Claude with schema)                                 │
│    - Extract content: json.choices[0].delta.content                         │
│    - Accumulate: completeText += content                                    │
│    - Yield: schemaStrategy.processResponse(completeText)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SchemaStrategy.processResponse() - types.ts                                │
│  Transforms accumulated text (identity for plain text mode)                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Insight: True Per-Chunk Deltas

The current `createStreamingGenerator` yields **accumulated completeText** on each chunk:

```typescript
// streaming.ts:272-274 (current behavior)
completeText += content;
yield schemaStrategy.processResponse(completeText);  // Full text so far
```

This causes **double buffering**: the SSE layer accumulates, then downstream consumers must diff to get deltas. Instead, we'll refactor to yield **true deltas** while maintaining backward compatibility via a flag.

## Integration Approach: Delta Mode in createStreamingGenerator

Add a `deltaMode` option to `createStreamingGenerator` that yields per-chunk deltas instead of accumulated text. Default is `false` (accumulated) for backward compatibility.

### Modified createStreamingGenerator

```typescript
// streaming.ts - add deltaMode option

async function* createStreamingGenerator(
  response: Response,
  options: CallAIOptions & { deltaMode?: boolean },  // NEW flag
  schemaStrategy: SchemaStrategy,
  model: string,
): AsyncGenerator<string, string, unknown> {
  // ... existing setup ...

  let completeText = "";
  const deltaMode = options.deltaMode ?? false;  // Default: accumulated (backward compat)

  // ... existing SSE parsing loop ...

  // At yield points (e.g., line 272-274):
  if (json.choices?.[0]?.delta?.content !== undefined) {
    const content = json.choices[0].delta.content || "";
    completeText += content;

    if (deltaMode) {
      yield content;  // NEW: yield just the delta
    } else {
      yield schemaStrategy.processResponse(completeText);  // Existing: yield accumulated
    }
  }

  // ... rest unchanged, return completeText at end ...
}
```

### parseAIStream Wrapper (Consumes Deltas)

```typescript
// New file: call-ai/pkg/stream-parser.ts
export async function* parseAIStream(
  prompt: string | Message[],
  options: CallAIOptions
): AsyncGenerator<StreamMessage> {
  const streamId = nextStreamId();
  const model = options.model || "unknown";

  yield createMessage(StreamTypes.STREAM_START, model, "client", {
    streamId,
    model,
    timestamp: Date.now(),
  });

  let seqCounter = 0;
  const codeState = new CodeBlockDetector();

  try {
    // Use deltaMode to get true per-chunk deltas
    for await (const delta of callAIStreaming(prompt, { ...options, deltaMode: true })) {
      // Feed delta directly to state machine - no diffing needed!
      const events = codeState.feed(delta, streamId, seqCounter++);
      for (const event of events) {
        yield event;
      }
    }

    // Emit any final CODE_END if stream ended mid-block
    const finalEvents = codeState.finalize(streamId);
    for (const event of finalEvents) {
      yield event;
    }

    yield createMessage(StreamTypes.STREAM_END, model, "client", {
      streamId,
      finishReason: "stop",
      timestamp: Date.now(),
    });
  } catch (error) {
    yield createMessage(StreamTypes.STREAM_ERROR, model, "client", {
      streamId,
      message: error instanceof Error ? error.message : String(error),
      recoverable: false,
      timestamp: Date.now(),
    });
  }
}
```

**Advantages of Delta Mode:**
- **No double buffering** - state machine runs directly on arriving bytes
- **Lower latency** - events emitted as chunks arrive, not after diffing
- **Cleaner semantics** - yields match what the LLM actually sent
- **Backward compatible** - `deltaMode: false` (default) preserves existing behavior
- **Minimal SSE buffer** - only keeps partial SSE frames, not entire response

## Code Block Detector State Machine

```typescript
// call-ai/pkg/code-block-detector.ts

type State = "TEXT" | "MAYBE_FENCE" | "IN_CODE" | "MAYBE_CLOSE";

interface CodeBlock {
  blockId: string;
  language?: string;
  content: string;
}

class CodeBlockDetector {
  private state: State = "TEXT";
  private buffer = "";
  private currentBlock: CodeBlock | null = null;
  private blockCounter = 0;

  feed(delta: string, streamId: number, seq: number): StreamMessage[] {
    const events: StreamMessage[] = [];

    for (const char of delta) {
      this.buffer += char;

      // State transitions based on ``` detection
      // Emit TEXT_FRAGMENT, CODE_START, CODE_FRAGMENT, CODE_END as appropriate
    }

    return events;
  }

  finalize(streamId: number): StreamMessage[] {
    // Handle incomplete code blocks at stream end
  }
}
```

**States:**
- `TEXT` - Outside code blocks, emit TEXT_FRAGMENT
- `MAYBE_FENCE` - Seen backticks, waiting to confirm fence
- `IN_CODE` - Inside code block, emit CODE_FRAGMENT
- `MAYBE_CLOSE` - Seen closing backticks, waiting to confirm

## Message Emission Points

| Event | Trigger | Payload |
|-------|---------|---------|
| `STREAM_START` | Generator starts | `{ streamId, model, timestamp }` |
| `TEXT_FRAGMENT` | Content outside code blocks | `{ streamId, seq, frag }` |
| `CODE_START` | Opening ``` detected | `{ streamId, blockId, language?, seq }` |
| `CODE_FRAGMENT` | Content inside code block | `{ streamId, blockId, seq, frag }` |
| `CODE_END` | Closing ``` detected | `{ streamId, blockId, language? }` |
| `STREAM_END` | Generator completes | `{ streamId, finishReason, timestamp }` |
| `STREAM_ERROR` | Exception caught | `{ streamId, message, recoverable, timestamp }` |

## Files to Create/Modify

### New Files
- `call-ai/pkg/stream-parser.ts` - Wrapper generator + exports
- `call-ai/pkg/code-block-detector.ts` - State machine for fence detection
- `call-ai/tests/unit/stream-parser.test.ts` - Parser tests

### Modified Files
- `call-ai/pkg/streaming.ts` - Add `deltaMode` option to yield deltas
- `call-ai/pkg/types.ts` - Add `deltaMode?: boolean` to `CallAIOptions`
- `call-ai/pkg/index.ts` - Add exports for `parseAIStream`, `StreamMessage`, `StreamTypes`

## Implementation Steps

1. **Add `deltaMode` to types.ts**
   - Add `deltaMode?: boolean` to `CallAIOptions` interface

2. **Modify `streaming.ts` for delta mode**
   - Add `deltaMode` flag check (default `false`)
   - At each yield point, yield delta instead of accumulated when flag is true
   - Keep `completeText` accumulation for return value regardless of mode
   - Yield points to modify:
     - Line 274: `json.choices[0].delta.content`
     - Line 280: `json.choices[0].message.content`
     - Line 296: content blocks
     - Line 307: text delta (Claude format)

3. **Create `code-block-detector.ts`**
   - State machine for detecting ``` fences
   - Handle language tags after opening fence
   - Buffer partial matches (e.g., single backtick)

4. **Create `stream-parser.ts`**
   - Import `callAIStreaming` from `./streaming.js`
   - Import types from `./stream-messages.js`
   - Implement `parseAIStream` wrapper with `deltaMode: true`

5. **Update `index.ts`**
   - Export `parseAIStream`
   - Export `StreamMessage`, `StreamTypes` from `./stream-messages.js`

6. **Add tests**
   - Test delta mode yields true deltas
   - Test code block detection across chunk boundaries
   - Test incomplete blocks
   - Use `rebuffer()` helper for arbitrary chunk sizes

## Test Strategy

### 1. `call-ai/tests/unit/code-block-detector.test.ts` (NEW)

Test the state machine in isolation with synthetic delta sequences:

```typescript
describe("CodeBlockDetector", () => {
  // Single fenced block
  it("detects single code block with language", () => {
    const detector = new CodeBlockDetector();
    const events = detector.feed("```ts\nconst x = 1;\n```", streamId, 0);
    // Expect: CODE_START(lang: "ts"), CODE_FRAGMENT, CODE_END
  });

  // Multiple blocks back-to-back
  it("handles multiple consecutive code blocks", () => {
    // ```js\nfoo()\n```\n```py\nbar()\n```
    // Expect proper transitions between blocks
  });

  // Incomplete fences (streaming mid-fence)
  it("buffers incomplete fence markers", () => {
    const detector = new CodeBlockDetector();
    detector.feed("text before `", streamId, 0);  // partial backtick
    detector.feed("``ts\n", streamId, 1);         // completes fence
    // Should not emit CODE_START until fence confirmed
  });

  // Escaped ``` inside code
  it("ignores escaped backticks inside code", () => {
    // Code containing: const s = "```";
    // Should not close the block early
  });

  // Mixed content: text → code → text
  it("emits residual text fragments correctly", () => {
    const events = detector.feed("Hello\n```js\ncode\n```\nGoodbye", streamId, 0);
    // Expect: TEXT_FRAGMENT("Hello\n"), CODE_START, CODE_FRAGMENT, CODE_END, TEXT_FRAGMENT("Goodbye")
  });

  // Plain text only (no code blocks)
  it("handles plain text without code blocks", () => {
    const events = detector.feed("Just some plain text", streamId, 0);
    // Expect: TEXT_FRAGMENT only
  });

  // finalize() with incomplete block
  it("emits CODE_END on finalize if block incomplete", () => {
    const detector = new CodeBlockDetector();
    detector.feed("```js\nincomplete code", streamId, 0);
    const events = detector.finalize(streamId);
    // Expect: CODE_END (marks incomplete block as closed)
  });
});
```

### 2. `call-ai/tests/unit/stream-parser.test.ts` (NEW)

Test `parseAIStream()` with mocked delta generator:

```typescript
describe("parseAIStream", () => {
  // Mock createStreamingGenerator to emit known deltas
  beforeEach(() => {
    vi.mock("./streaming.js", () => ({
      callAIStreaming: vi.fn(),
    }));
  });

  it("emits correct message sequence for text + code + text", async () => {
    // Mock yields: "Hello ", "```jsx\n", "const x = 1;", "\n```", " Done!"
    mockCallAIStreaming.mockImplementation(async function* () {
      yield "Hello ";
      yield "```jsx\n";
      yield "const x = 1;";
      yield "\n```";
      yield " Done!";
    });

    const messages = [];
    for await (const msg of parseAIStream("test", options)) {
      messages.push(msg);
    }

    expect(messages).toEqual([
      { type: "callai.stream.start", ... },
      { type: "callai.text.fragment", payload: { frag: "Hello " } },
      { type: "callai.code.start", payload: { language: "jsx" } },
      { type: "callai.code.fragment", payload: { frag: "const x = 1;" } },
      { type: "callai.code.end", ... },
      { type: "callai.text.fragment", payload: { frag: " Done!" } },
      { type: "callai.stream.end", ... },
    ]);
  });

  it("emits STREAM_ERROR when generator throws", async () => {
    mockCallAIStreaming.mockImplementation(async function* () {
      yield "partial";
      throw new Error("Network failure");
    });

    const messages = [];
    for await (const msg of parseAIStream("test", options)) {
      messages.push(msg);
    }

    expect(messages).toContainEqual({
      type: "callai.stream.error",
      payload: expect.objectContaining({
        message: "Network failure",
        recoverable: false,
      }),
    });
  });

  it("handles tool-call recovery gracefully", async () => {
    // Mock tool_calls finish_reason scenario
    // Verify no crash, emits appropriate messages
  });

  it("handles image payload placeholder", async () => {
    // Mock image generation response
    // Verify IMG message emitted
  });
});
```

### 3. Extend `call-ai/tests/unit/unit.no-await.test.ts` (EXISTING)

Add deltaMode configuration tests:

```typescript
describe("deltaMode option", () => {
  it("defaults deltaMode to false in request body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockStreamResponse);
    global.fetch = fetchMock;

    await callAI("test", { stream: true, apiKey: "key" });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.deltaMode).toBeUndefined(); // Not sent to API
  });

  it("can be toggled true in CallAIOptions", async () => {
    const options: CallAIOptions = {
      stream: true,
      deltaMode: true,
      apiKey: "key",
    };

    // Verify option is accepted without error
    expect(() => callAI("test", options)).not.toThrow();
  });

  it("yields deltas when deltaMode is true", async () => {
    // Mock reader returning two chunks: "Hello" and " World"
    const mockReader = createMockReader(["Hello", " World"]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const results = [];
    for await (const chunk of callAIStreaming("test", { deltaMode: true, ... })) {
      results.push(chunk);
    }

    // With deltaMode: true, expect separate yields
    expect(results).toEqual(["Hello", " World"]);
  });

  it("yields accumulated text when deltaMode is false (default)", async () => {
    // Same mock reader: "Hello" and " World"
    const mockReader = createMockReader(["Hello", " World"]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    });

    const results = [];
    for await (const chunk of callAIStreaming("test", { deltaMode: false, ... })) {
      results.push(chunk);
    }

    // With deltaMode: false, expect cumulative yields
    expect(results).toEqual(["Hello", "Hello World"]);
  });
});
```

### Test Coverage Summary

| Test File | Coverage |
|-----------|----------|
| `code-block-detector.test.ts` | State machine transitions, fence detection, language parsing, incomplete blocks, escaped backticks |
| `stream-parser.test.ts` | End-to-end message sequence, error propagation, tool-call handling |
| `unit.no-await.test.ts` | deltaMode configuration, yield behavior difference |

## Integration with Existing Layers

### Current Architecture Stack

```
┌──────────────────────────────────────────────────────────────────────────┐
│  sendMessage.ts (Application Layer)                                      │
│  sendChatMessage() -> calls streamAI() with onContent callback           │
├──────────────────────────────────────────────────────────────────────────┤
│  streamHandler.ts (Service Layer)                                        │
│  streamAI() -> calls callAI({ stream: true }) -> for-await loop          │
│  Current: for await (const content of generator) { onContent(content) }  │
├──────────────────────────────────────────────────────────────────────────┤
│  call-ai/api.ts + streaming.ts (Transport Layer)                         │
│  callAI() -> callAIStreaming() -> yields accumulated text strings        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Where parseAIStream Fits

The wrapper sits at the **call-ai level** as an alternative entry point:

```
                          ┌─────────────────────────┐
                          │  streamHandler.ts       │
                          │  (Consumer Choice)      │
                          └──────────┬──────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              │                                             │
              ▼                                             ▼
┌─────────────────────────────┐           ┌─────────────────────────────┐
│  callAI({ stream: true })   │           │  parseAIStream()            │
│  AsyncGenerator<string>     │           │  AsyncGenerator<StreamMsg>  │
│  (existing, unchanged)      │           │  (NEW wrapper)              │
└─────────────────────────────┘           └──────────────┬──────────────┘
                                                         │
                                                         │ wraps
                                                         ▼
                                          ┌─────────────────────────────┐
                                          │  callAIStreaming()          │
                                          │  (internal, unchanged)      │
                                          └─────────────────────────────┘
```

### Integration Option: streamHandler.ts

When ready to consume semantic messages, update `streamHandler.ts`:

```typescript
// vibes.diy/pkg/app/utils/streamHandler.ts

// Option A: Keep backward-compatible string callback
import { parseAIStream, StreamMessage, StreamTypes } from "call-ai";

export async function streamAI(
  model: string,
  // ... existing params ...
  onContent: (content: string) => void,  // Keep existing signature
  onStreamMessage?: (msg: StreamMessage) => void,  // NEW: optional semantic handler
): Promise<string> {
  // ... existing setup ...

  let accumulated = "";
  for await (const msg of parseAIStream(messages, options)) {
    // Forward semantic messages to new handler
    onStreamMessage?.(msg);

    // Maintain backward compatibility - accumulate text
    if (msg.type === StreamTypes.TEXT_FRAGMENT || msg.type === StreamTypes.CODE_FRAGMENT) {
      accumulated += msg.payload.frag;
      onContent(accumulated);
    }
  }
  return accumulated;
}
```

### Integration Option: React Hook

For React components, create a hook that consumes semantic messages:

```typescript
// vibes.diy/pkg/app/hooks/useStreamMessages.ts
export function useStreamMessages() {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [codeBlocks, setCodeBlocks] = useState<Map<string, string>>(new Map());

  const handleMessage = useCallback((msg: StreamMessage) => {
    setMessages(prev => [...prev, msg]);

    if (msg.type === StreamTypes.CODE_FRAGMENT) {
      setCodeBlocks(prev => {
        const updated = new Map(prev);
        const existing = updated.get(msg.payload.blockId) || "";
        updated.set(msg.payload.blockId, existing + msg.payload.frag);
        return updated;
      });
    }
  }, []);

  return { messages, codeBlocks, handleMessage };
}
```

### Key Integration Files

| File | Role | Change |
|------|------|--------|
| `call-ai/pkg/types.ts` | Types | Add `deltaMode?: boolean` to `CallAIOptions` |
| `call-ai/pkg/streaming.ts` | Core | Add `deltaMode` flag, yield deltas when true |
| `call-ai/pkg/stream-parser.ts` | NEW | Wrapper generator consuming deltas |
| `call-ai/pkg/code-block-detector.ts` | NEW | State machine for fence detection |
| `call-ai/pkg/index.ts` | Exports | Add `parseAIStream`, `StreamMessage`, `StreamTypes` |
| `vibes.diy/pkg/app/utils/streamHandler.ts` | Consumer | Optional: switch to `parseAIStream` |
| `vibes.diy/pkg/app/hooks/sendMessage.ts` | App | No change needed initially |

### Migration Path

1. **Phase 1**: Add `parseAIStream` to call-ai (this plan)
2. **Phase 2**: Add optional `onStreamMessage` to `streamHandler.ts`
3. **Phase 3**: Create React hooks for semantic message consumption
4. **Phase 4**: Update UI components to use code block events directly
