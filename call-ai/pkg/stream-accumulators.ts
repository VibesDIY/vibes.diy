/**
 * Stream Accumulators - Helpers for reconstructing content from StreamMessage events
 *
 * Provides both incremental (for streaming UIs) and one-shot (for batch processing)
 * APIs to accumulate code blocks and text from semantic stream events.
 */

import { StreamMessage, StreamTypes } from "./stream-messages.js";

/**
 * A reconstructed code block from CODE_START/CODE_FRAGMENT/CODE_END events
 */
export interface CodeBlock {
  blockId: string;
  language?: string;
  content: string;
  /** true if CODE_END received, false if still streaming */
  complete: boolean;
}

/**
 * State for incremental accumulation - pass to accumulateIncremental() repeatedly
 */
export interface AccumulatorState {
  blocks: CodeBlock[];
  text: string;
  nextIndex: number;
  /** Internal: tracks in-progress blocks by blockId */
  _blockMap: Map<string, CodeBlock>;
}

/**
 * Create initial state for incremental accumulation
 */
export function createAccumulatorState(): AccumulatorState {
  return {
    blocks: [],
    text: "",
    nextIndex: 0,
    _blockMap: new Map(),
  };
}

/**
 * Incremental accumulator - processes messages starting from state.nextIndex.
 * Returns updated state that can be passed to the next call.
 *
 * @example
 * ```typescript
 * let state = createAccumulatorState();
 * for await (const msg of stream) {
 *   messages.push(msg);
 *   state = accumulateIncremental(messages, state);
 *   render(state.blocks); // in-progress blocks have complete: false
 * }
 * ```
 */
export function accumulateIncremental(messages: StreamMessage[], state: AccumulatorState): AccumulatorState {
  // Deep clone state to avoid mutation
  const newBlockMap = new Map<string, CodeBlock>();
  for (const [key, block] of state._blockMap) {
    newBlockMap.set(key, { ...block });
  }

  const newState: AccumulatorState = {
    blocks: [],
    text: state.text,
    nextIndex: state.nextIndex,
    _blockMap: newBlockMap,
  };

  // Process only new messages
  for (let i = newState.nextIndex; i < messages.length; i++) {
    const msg = messages[i];
    processMessage(msg, newState);
    newState.nextIndex = i + 1;
  }

  // Rebuild blocks array from map to maintain order
  newState.blocks = Array.from(newState._blockMap.values());

  return newState;
}

/**
 * Process a single message and update state
 */
function processMessage(msg: StreamMessage, state: AccumulatorState): void {
  switch (msg.type) {
    case StreamTypes.CODE_START: {
      const payload = msg.payload as { blockId: string; language?: string };
      const block: CodeBlock = {
        blockId: payload.blockId,
        language: payload.language,
        content: "",
        complete: false,
      };
      state._blockMap.set(payload.blockId, block);
      break;
    }

    case StreamTypes.CODE_FRAGMENT: {
      const payload = msg.payload as { blockId: string; frag: string };
      const block = state._blockMap.get(payload.blockId);
      if (block) {
        block.content += payload.frag;
      }
      break;
    }

    case StreamTypes.CODE_END: {
      const payload = msg.payload as { blockId: string };
      const block = state._blockMap.get(payload.blockId);
      if (block) {
        block.complete = true;
      }
      break;
    }

    case StreamTypes.TEXT_FRAGMENT: {
      const payload = msg.payload as { frag: string };
      state.text += payload.frag;
      break;
    }
  }
}

/**
 * Simple one-shot accumulator for when you have all messages.
 * Processes entire array from scratch. Returns only code blocks.
 *
 * @example
 * ```typescript
 * const messages = await collectStreamMessages(prompt, options);
 * const blocks = accumulateCodeBlocks(messages);
 * blocks.forEach(b => console.log(b.language, b.content));
 * ```
 */
export function accumulateCodeBlocks(messages: StreamMessage[]): CodeBlock[] {
  const state = createAccumulatorState();
  const result = accumulateIncremental(messages, state);
  return result.blocks;
}

/**
 * Concatenate all TEXT_FRAGMENT and CODE_FRAGMENT content into a single string.
 * Useful for getting the full raw text output.
 */
export function accumulateText(messages: StreamMessage[]): string {
  let text = "";

  for (const msg of messages) {
    if (msg.type === StreamTypes.TEXT_FRAGMENT || msg.type === StreamTypes.CODE_FRAGMENT) {
      const payload = msg.payload as { frag: string };
      text += payload.frag;
    }
  }

  return text;
}
