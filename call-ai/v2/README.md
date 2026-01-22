# call-ai/v2 Stream Pipeline

A composable stream processing pipeline for parsing OpenRouter/OpenAI streaming API responses. Each transform stream handles one layer of parsing and emits typed messages that flow through the pipeline.

## Architecture Overview

```
Uint8Array (HTTP response body)
    │
    ▼
┌─────────────────────┐
│  StatsCollector     │  Injects stats.collect triggers at intervals
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  LineStream         │  Bytes → line.begin/line/end (SSE wire format)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  DataStream         │  Lines → data.begin/line/end (parses "data: {json}")
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  SseStream          │  JSON → sse.begin/line/end (validates OpenRouter schema)
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│  DeltaStream        │  SSE chunks → delta.begin/line/image/usage/end
└─────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  SectionsStream(streamId, createId)                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  On delta.begin, creates inner pipeline:           │ │
│  │                                                    │ │
│  │  delta.line content ──► LineStream ──► BlockStream │ │
│  │         (bytes)          (markdown)    (sections)  │ │
│  │                                                    │ │
│  │  BlockStream is not passthrough (prevents duplication) │
│  └────────────────────────────────────────────────────┘ │
│  Outputs: block.begin/toplevel/code/image/end           │
└─────────────────────────────────────────────────────────┘

createId: () => string  — any function returning unique IDs,
                          passed to DeltaStream, SectionsStream, BlockStream
```

## CLI Tool

Test the pipeline with captured SSE files or live API calls.

```bash
cd call-ai/v2

# Capture raw SSE to file for replay/testing
pnpm cli --prompt "Write a React counter app" --model openai/gpt-4o-mini --raw > captured.sse

# Live API call with delta output
pnpm cli --prompt "Hello world" --model openai/gpt-4o-mini --delta

# From captured file
pnpm cli --src captured.sse --block

# All events unfiltered
pnpm cli --src captured.sse --all

# Save images from vision model responses
pnpm cli --src captured-image.sse --image --image-dir ./output
```

**Flags:**
- `--line` - Show line-level events
- `--data` - Show data-level events
- `--sse` - Show SSE-level events
- `--delta` - Show delta-level events
- `--block` - Show block-level events
- `--full` - Accumulate and show complete sections
- `--all` - Show all events unfiltered
- `--stats` - Show stats events
- `--image` - Fetch and display image metadata
- `--image-dir <path>` - Save images to directory

## Pipeline Usage

```typescript
import {
  createStatsCollector,
  createLineStream,
  createDataStream,
  createSseStream,
  createDeltaStream,
  createSectionsStream,
  isDeltaLine,
  isCodeLine,
  isBlockImage,
} from "call-ai/v2";
import { ensureSuperThis } from "@fireproof/core-runtime";

const sthis = ensureSuperThis();
const streamId = sthis.nextId().str;
const createId = () => sthis.nextId().str;

const pipeline = response.body
  .pipeThrough(createStatsCollector(streamId, 1000))
  .pipeThrough(createLineStream(streamId))
  .pipeThrough(createDataStream(streamId))
  .pipeThrough(createSseStream(streamId))
  .pipeThrough(createDeltaStream(streamId, createId))
  .pipeThrough(createSectionsStream(streamId, createId));

for await (const msg of pipeline) {
  if (isDeltaLine(msg)) {
    // Raw content delta from LLM
    process.stdout.write(msg.content);
  }
  if (isCodeLine(msg)) {
    // Code block line with language info
    console.log(`[${msg.lang}] ${msg.line}`);
  }
  if (isBlockImage(msg)) {
    // Image URL from vision model
    console.log(`Image: ${msg.url}`);
  }
}
```

## Stream Modules

### stats-stream.ts
Injects `stats.collect` trigger messages at configurable intervals. Each downstream stream responds by emitting its own `*.stats` message with current counts.

**Messages:** `stats.collect`

### line-stream.ts
Converts raw bytes into newline-delimited lines.

**Input:** `Uint8Array | string`
**Messages:** `line.begin`, `line.line`, `line.end`, `line.stats`

### data-stream.ts
Parses SSE format, extracting JSON from `data: {json}` lines.

**Input:** `LineStreamMsg`
**Messages:** `data.begin`, `data.line`, `data.error`, `data.end`, `data.stats`

### sse-stream.ts
Validates JSON against OpenRouter's streaming chunk schema using Arktype.

**Input:** `DataStreamMsg`
**Messages:** `sse.begin`, `sse.line`, `sse.error`, `sse.end`, `sse.stats`

**Key types:**
- `SseChunk` - Validated OpenRouter response chunk
- `SseUsage` - Token usage stats
- `SSeImage` - Image URL from vision models

### delta-stream.ts
Extracts content deltas, images, and usage from validated SSE chunks.

**Input:** `SseStreamMsg`
**Messages:** `delta.begin`, `delta.line`, `delta.image`, `delta.usage`, `delta.end`, `delta.stats`

### sections-stream.ts
Parses markdown structure from accumulated content, detecting code fences and images.

**Input:** `DeltaStreamMsg`
**Messages:** `block.begin`, `block.toplevel.begin/line/end`, `block.code.begin/line/end`, `block.image`, `block.end`, `block.stats`

## The Passthrough Pattern

Streams use `passthrough()` to automatically forward all upstream messages while adding their own:

```typescript
import { passthrough } from "./passthrough.js";

new TransformStream({
  transform: passthrough((msg, controller) => {
    // Input is already enqueued by passthrough()
    // Only emit NEW messages for events you handle
    if (isSomeTrigger(msg)) {
      controller.enqueue({ type: "my.event", ... });
    }
  }),
});
```

This means consumers see ALL messages from every layer. Use type guards to filter:

```typescript
// See only delta-level events
if (isDeltaMsg(msg)) { ... }

// See only code blocks
if (isCodeLine(msg)) { ... }
```

## Type Guards

Every message type has a corresponding type guard with optional `streamId` filtering:

```typescript
// Check message type
if (isDeltaLine(msg)) {
  console.log(msg.content);  // TypeScript knows msg is DeltaLineMsg
}

// Filter by streamId (for multiplexed streams)
if (isDeltaLine(msg, "stream-123")) {
  // Only matches DeltaLineMsg where streamId === "stream-123"
}
```

## Message Naming Conventions

- `*Msg` suffix for message types: `DeltaLineMsg`, `SseLineMsg`
- `*Seq` suffix for sequence numbers: `deltaSeq`, `choiceSeq`, `imageSeq`
- `*Id` suffix for identifiers: `streamId`, `imageId`, `sectionId`
- `*Nr` suffix for counts: `lineNr`, `chunkNr`, `blockNr`

## Stats Collection

Stats flow through the pipeline:

1. `StatsCollector` injects `stats.collect` at intervals
2. Each stream responds with its own `*.stats` message
3. Final `stats.collect` emitted on stream close

```typescript
if (isLineStats(msg)) console.log("Line stats:", msg.stats);
if (isDataStats(msg)) console.log("Data stats:", msg.stats);
if (isSseStats(msg)) console.log("SSE stats:", msg.stats);
if (isDeltaStats(msg)) console.log("Delta stats:", msg.stats);
if (isBlockStats(msg)) console.log("Block stats:", msg.stats);
```

## Current Status

Currently used by:
- CLI tool (`cli.ts`) for testing and debugging
- Unit tests

Integration plans (not part of this package):
- vibes.diy chat using advanced API
- Auth for vibes iframe runtime
- Generated vibes legacy callAI wrapper

## TODO

- [ ] **Chunked image decoding**: Add `createImageDecodeStream` that fetches image URLs, decodes to bytes, and emits `image.begin`/`image.fragment`/`image.end` with shared `imageId` for streaming large images in fixed-size chunks
- [ ] **Production worker**: Deploy pipeline to Cloudflare Worker with events as network transport, client consumes typed events directly instead of raw SSE
- [ ] **Migrate vibes.diy chat**: Replace `call-ai` v1 + `segment-parser.ts` with v2 pipeline, consuming typed `isCodeLine`/`isToplevelLine` events instead of regex parsing
