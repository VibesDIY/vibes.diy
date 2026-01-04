# Call-AI Streaming API Usage Guide

This guide explains how to use the new semantic streaming API in `call-ai`. This API allows you to receive rich, structured events (text, code blocks, tool calls) in real-time, rather than just a raw string.

## Core Concepts

The streaming pipeline consists of three layers:

1.  **Transport:** `parseSSE` reads the raw HTTP stream and handles JSON parsing.
2.  **Semantics:** `detectCodeBlocks` converts text chunks into structured events (`StreamMessage`).
3.  **Accumulation:** Helper functions (`accumulateIncremental`, etc.) reconstruct the state for your UI.

## Basic Usage (Iterating Events)

To consume the stream directly, use the `semantic` stream option. This yields `StreamMessage` objects.

```typescript
import { callAi, StreamTypes } from "call-ai";

const prompt = "Write a Python script to say hello.";
const options = { stream: "semantic" };

for await (const msg of await callAi(prompt, options)) {
  switch (msg.type) {
    case StreamTypes.TEXT_FRAGMENT:
      process.stdout.write(msg.payload.frag);
      break;
    
    case StreamTypes.CODE_START:
      console.log(`\n[Starting ${msg.payload.language} block]`);
      break;
      
    case StreamTypes.CODE_FRAGMENT:
      process.stdout.write(msg.payload.frag);
      break;
      
    case StreamTypes.CODE_END:
      console.log("\n[End of code block]");
      break;
  }
}
```

## Using Accumulators (Recommended for UIs)

Manually handling `CODE_START`/`FRAGMENT`/`END` events can be tedious. We provide accumulator helpers to maintain the state for you.

### 1. One-Shot Accumulation (Batch)

If you have collected all messages (e.g., for logging or post-processing), use `accumulateCodeBlocks`:

```typescript
import { collectStreamMessages, accumulateCodeBlocks } from "call-ai";

// Gather all events into an array (uses semantic streaming internally)
const messages = await collectStreamMessages(prompt, options);

// Extract just the code blocks
const blocks = accumulateCodeBlocks(messages);

blocks.forEach(block => {
  console.log(`Language: ${block.language}`);
  console.log(`Content: ${block.content}`);
  console.log(`Complete: ${block.complete}`);
});
```

### 2. Incremental Accumulation (Streaming UI)

For a React component or any real-time UI, use `createAccumulatorState` and `accumulateIncremental`. This function is efficient and immutable-friendly.

**Example: React Hook**

```typescript
import { useState, useEffect } from 'react';
import { callAi, createAccumulatorState, accumulateIncremental } from 'call-ai';

function useSemanticStream(prompt) {
  const [state, setState] = useState(createAccumulatorState());
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    let active = true;
    
    async function start() {
      setIsStreaming(true);
      // Local mutable collection for the batch processor
      const messages = []; 
      // State container to persist across renders
      let currentState = createAccumulatorState();

      try {
        const stream = await callAi(prompt, { stream: "semantic" });
        
        for await (const msg of stream) {
          if (!active) break;
          messages.push(msg);
          
          // Efficiently computes next state based on new messages
          currentState = accumulateIncremental(messages, currentState);
          setState(currentState);
        }
      } finally {
        if (active) setIsStreaming(false);
      }
    }

    start();
    return () => { active = false; };
  }, [prompt]);

  return { ...state, isStreaming };
}

// Usage in Component
function CodeViewer({ prompt }) {
  const { text, blocks, isStreaming } = useSemanticStream(prompt);

  return (
    <div>
      <div className="markdown-preview">{text}</div>
      
      {blocks.map(block => (
        <div key={block.blockId} className="code-block">
          <div className="header">
            {block.language} 
            {!block.complete && <span className="spinner">⏳</span>}
          </div>
          <pre>{block.content}</pre>
        </div>
      ))}
    </div>
  );
}
```

## Legacy Compatibility

The default `stream: true` behavior remains unchanged. It yields simple strings (the accumulated text so far).

```typescript
// Legacy mode (still supported)
const stream = await callAi(prompt, { stream: true });
for await (const text of stream) {
  console.log("Full text so far:", text);
}
```

This legacy mode is now powered by the same semantic engine under the hood, ensuring consistency between the two approaches.

```