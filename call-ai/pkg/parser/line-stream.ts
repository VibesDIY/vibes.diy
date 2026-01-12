import { OnFunc } from "@adviser/cement";
import { setup, assign, emit, raise, createActor } from "xstate";

/**
 * LineStreamParser
 * -----------------
 * Rapid iteration warning: this parser is under active development. Expect
 * behaviour and APIs (onFragment/onLineEnd) to evolve without semver warnings
 * until we lock in the final SSE story.
 *
 * Today it exposes two complementary signals:
 * - `onFragment`: chunk-level events (non-accumulating) suitable for incremental UIs.
 * - `onLineEnd`: deterministic line-level events (one per newline or bracket EOL)
 *   that emit fully accumulated content.
 */

// TODO: optional implement []
// TODO: string " { ", " \"  } "
// emit events allow the reassembly of the json

export enum LineStreamState {
  WaitForOpeningCurlyBracket = "waitForOpeningCurlyBracket",
  WaitingForClosingCurlyBracket = "waitingForClosingCurlyBracket",
  WaitingForEOL = "waitingForEOL",
}

// Event types for external callbacks
export interface FragmentEvent {
  readonly type: "fragment";
  readonly lineNr: number;
  readonly fragment: string;
  readonly seq: number;
  readonly lineComplete: boolean;
}

export interface BracketOpenCloseEvent {
  readonly type: "bracket";
  readonly bracket: "open" | "close";
}

export interface InBracketEvent {
  readonly type: "inBracket";
  readonly seqStyle: "first" | "last" | "middle";
  readonly block: number;
  readonly seq: number;
  readonly content: string;
}

export type BracketEvent = BracketOpenCloseEvent | InBracketEvent;

// XState machine context
interface LineStreamContext {
  seq: number;
  lineNr: number;
  rest: string; // The accumulator for incoming chunks not yet fully processed
  blockId: number;
  chunk: string; // The current working string being processed
  depth: number; // Nesting depth for curly brackets
  scanIndex: number; // Index of the next significant character found by scanner
  lastChunk: string; // Tracks the raw chunk provided by the caller
}

// XState machine events
interface ProcessChunkEvent {
  readonly type: "PROCESS_CHUNK";
  readonly chunk: string;
}

interface ConsumeEvent {
  readonly type: "CONSUME";
}

type MachineEvents = ProcessChunkEvent | ConsumeEvent;

// Helper to find the next significant character
function scanForNextEvent(chunk: string, searchingFor: "open" | "both" | "eol"): number {
  if (searchingFor === "eol") {
    return chunk.indexOf("\n");
  }
  if (searchingFor === "open") {
    return chunk.indexOf("{");
  }
  // Searching for both { and }
  const openIdx = chunk.indexOf("{");
  const closeIdx = chunk.indexOf("}");

  if (openIdx === -1) return closeIdx;
  if (closeIdx === -1) return openIdx;
  return Math.min(openIdx, closeIdx);
}

// Create machine factory with configurable initial state
function createLineStreamMachine(initialStateName: string) {
  return setup({
    types: {
      context: {} as LineStreamContext,
      events: {} as MachineEvents,
      emitted: {} as FragmentEvent | BracketEvent,
    },
    actions: {
      // --- Emitters ---
      emitBracketOpen: emit({ type: "bracket", bracket: "open" } as const),
      emitBracketClose: emit({ type: "bracket", bracket: "close" } as const),

      emitInBracketContent: emit(({ context }) => {
        // Determine style based on sequence
        let style: "first" | "last" | "middle" = "middle";
        if (context.seq === 0) style = "first";
        // Note: 'last' is tough to know for sure in a stream until we hit the closing bracket
        // but the original logic emitted 'last' right before closing.
        // We will mimic original logic: if we are about to close a block (depth 1 -> 0), current content is 'last'.
        // However, if we are just flushing a chunk, it's 'middle' or 'first'.

        // This helper is for content *between* brackets or generic chunks.
        // Logic for 'last' is handled specifically in the close-bracket transition.

        return {
          type: "inBracket" as const,
          seqStyle: style,
          block: context.blockId,
          seq: context.seq,
          content: context.chunk.slice(0, context.scanIndex === -1 ? undefined : context.scanIndex),
        };
      }),

      emitInBracketLast: emit(({ context }) => ({
        type: "inBracket" as const,
        seqStyle: "last" as const,
        block: context.blockId,
        seq: context.seq,
        content: context.chunk.slice(0, context.scanIndex),
      })),

      emitFragmentComplete: emit(({ context }) => {
        // Non-accumulating: emit only the portion of lastChunk before the newline
        // scanIndex is position in chunk (which = rest + lastChunk)
        // restLen is how much of chunk came from rest (previous chunks)
        const restLen = context.chunk.length - context.lastChunk.length;
        const lastChunkNewlinePos = context.scanIndex - restLen;
        return {
          type: "fragment" as const,
          lineNr: context.lineNr,
          fragment: lastChunkNewlinePos > 0 ? context.lastChunk.slice(0, lastChunkNewlinePos) : "",
          seq: context.seq,
          lineComplete: true,
        };
      }),

      emitFragmentIncomplete: emit(({ context }) => ({
        type: "fragment" as const,
        lineNr: context.lineNr,
        fragment: context.lastChunk || context.chunk,
        seq: context.seq,
        lineComplete: false,
      })),

      // --- State Updates ---
      appendChunk: assign({
        chunk: ({ context, event }) => (event.type === "PROCESS_CHUNK" ? context.rest + event.chunk : context.chunk),
        rest: "", // Clear rest as it's now in chunk
        lastChunk: ({ event }) => (event.type === "PROCESS_CHUNK" ? event.chunk : ""),
      }),

      // Scan actions update the scanIndex context
      scanForOpen: assign({
        scanIndex: ({ context }) => scanForNextEvent(context.chunk, "open"),
      }),
      scanForBoth: assign({
        scanIndex: ({ context }) => scanForNextEvent(context.chunk, "both"),
      }),
      scanForEOL: assign({
        scanIndex: ({ context }) => scanForNextEvent(context.chunk, "eol"),
      }),

      // Consumption actions slice the chunk and update counters
      consumeToOpen: assign({
        // Slice up to scanIndex (exclusive), skip the '{' (+1)
        chunk: ({ context }) => context.chunk.slice(context.scanIndex + 1),
        depth: ({ context }) => context.depth + 1,
      }),

      consumeToNext: assign({
        // Consumes content up to the found bracket, ready to process the bracket itself next
        // Actually, simpler to consume the content AND the bracket if we know what it is.
        // But we need to check *which* bracket it was.
        // So we will just slice off the content *before* the bracket, and let the loop handle the bracket?
        // No, let's do it in one go if we can.

        // If we found a '{' at scanIndex:
        //   We might have content before it.
        //   We consume content + '{'.

        chunk: ({ context }) => context.chunk.slice(context.scanIndex + 1),
      }),

      incrementSeq: assign({
        seq: ({ context }) => context.seq + 1,
      }),

      incrementBlock: assign({
        blockId: ({ context }) => context.blockId + 1,
        seq: 0,
        depth: 0, // Should be 0 anyway, but reset to be safe
      }),

      decrementDepth: assign({
        depth: ({ context }) => context.depth - 1,
      }),

      consumeEOL: assign({
        chunk: ({ context }) => context.chunk.slice(context.scanIndex + 1),
        lineNr: ({ context }) => context.lineNr + 1,
        seq: 0,
        // Non-accumulating: keep lastChunk as remaining chunk content for multi-line chunks
        lastChunk: ({ context }) => context.chunk.slice(context.scanIndex + 1),
      }),

      saveRest: assign({
        rest: ({ context }) => context.chunk,
        chunk: "",
        lastChunk: "",
      }),

      consumeAll: assign({
        chunk: "",
        rest: "",
        lastChunk: "",
      }),

      // --- Internal Control ---
      raiseConsume: raise({ type: "CONSUME" }),
    },
    guards: {
      foundSomething: ({ context }) => context.scanIndex !== -1,

      foundOpenBracket: ({ context }) => context.scanIndex !== -1 && context.chunk[context.scanIndex] === "{",

      foundCloseBracket: ({ context }) => context.scanIndex !== -1 && context.chunk[context.scanIndex] === "}",

      isDepthOne: ({ context }) => context.depth === 1,
    },
  }).createMachine({
    id: "lineStream",
    context: {
      seq: 0,
      lineNr: 0,
      rest: "",
      blockId: 0,
      chunk: "",
      depth: 0,
      scanIndex: -1,
      lastChunk: "",
    },
    initial: initialStateName,
    states: {
      // ========================================================================
      // 1. Wait For Opening {
      // ========================================================================
      waitForOpeningCurlyBracket: {
        initial: "idle",
        states: {
          idle: {
            on: {
              PROCESS_CHUNK: {
                actions: ["appendChunk", "raiseConsume"],
              },
            },
          },
          scanning: {
            entry: ["scanForOpen"], // only look for {
            always: [
              {
                guard: "foundSomething",
                actions: ["consumeToOpen", "emitBracketOpen"], // Consumes content (ignored) and {
                target: "#lineStream.waitingForClosingCurlyBracket.scanning",
              },
              {
                // Nothing found, save rest and wait for more
                actions: ["saveRest"],
                target: "idle",
              },
            ],
          },
        },
        on: {
          CONSUME: ".scanning",
        },
      },

      // ========================================================================
      // 2. Wait For Closing } (Handles Nesting)
      // ========================================================================
      waitingForClosingCurlyBracket: {
        initial: "idle",
        states: {
          idle: {
            on: {
              PROCESS_CHUNK: {
                actions: ["appendChunk", "raiseConsume"],
              },
            },
          },
          scanning: {
            entry: ["scanForBoth"], // look for { or }
            always: [
              // --- Case A: Found Open Bracket '{' (Nesting) ---
              {
                guard: "foundOpenBracket",
                actions: [
                  "emitInBracketContent", // Emit anything before the {
                  "incrementSeq",
                  "consumeToNext", // Eat the content and the {
                ],
                target: "handlingNestedOpen",
              },

              // --- Case B: Found Close Bracket '}' ---
              {
                guard: "foundCloseBracket",
                // Check if this closes the whole block (depth == 1)
                target: "checkCloseDepth",
              },

              // --- Case C: Found Nothing (End of Chunk) ---
              {
                actions: [
                  "emitInBracketContent", // Emit everything we have so far
                  "incrementSeq",
                  "consumeAll", // Consumed it all
                ],
                target: "idle",
              },
            ],
          },

          handlingNestedOpen: {
            // We found a nested {, we need to increment depth.
            // The transition above used 'consumeToNext' which just slices.
            entry: assign({ depth: ({ context }) => context.depth + 1 }),
            always: { target: "scanning" },
          },

          checkCloseDepth: {
            always: [
              {
                guard: "isDepthOne", // This is the final closing bracket
                actions: [
                  "emitInBracketLast", // Emit content up to }
                  "consumeToNext", // Eat content and }
                  "decrementDepth", // depth becomes 0
                  "emitBracketClose",
                  "incrementBlock", // blockId++, seq=0
                ],
                target: "#lineStream.waitForOpeningCurlyBracket.scanning", // Look for next block
              },
              {
                // Just a nested closing bracket
                actions: ["emitInBracketContent", "incrementSeq", "consumeToNext", "decrementDepth"],
                target: "scanning",
              },
            ],
          },
        },
        on: {
          CONSUME: ".scanning",
        },
      },

      // ========================================================================
      // 3. Wait For EOL (Standard Line Processing)
      // ========================================================================
      waitingForEOL: {
        initial: "idle",
        states: {
          idle: {
            on: {
              PROCESS_CHUNK: {
                actions: ["appendChunk", "raiseConsume"],
              },
            },
          },
          scanning: {
            entry: ["scanForEOL"],
            always: [
              {
                guard: "foundSomething",
                target: "processing",
              },
              {
                // Still save rest internally to find newlines across chunk boundaries
                // But emitFragmentIncomplete only emits lastChunk (non-accumulating)
                actions: ["emitFragmentIncomplete", "incrementSeq", "saveRest"],
                target: "idle",
              },
            ],
          },
          processing: {
            entry: ["emitFragmentComplete", "consumeEOL"],
            always: { target: "scanning" },
          },
        },
        on: {
          CONSUME: ".scanning",
        },
      },
    },
  });
}

export class LineStreamParser {
  readonly onFragment = OnFunc<(event: FragmentEvent) => void>();
  readonly onBracket = OnFunc<(event: BracketEvent) => void>();

  private readonly actor: ReturnType<typeof createActor<ReturnType<typeof createLineStreamMachine>>>;

  constructor(initialState: LineStreamState) {
    const machine = createLineStreamMachine(initialState);
    this.actor = createActor(machine);

    this.actor.on("bracket", (event: BracketOpenCloseEvent) => {
      this.onBracket.invoke(event);
    });

    this.actor.on("inBracket", (event: InBracketEvent) => {
      this.onBracket.invoke(event);
    });

    this.actor.on("fragment", (event: FragmentEvent) => {
      this.onFragment.invoke(event);
    });

    this.actor.start();
  }

  processChunk(chunk: string): void {
    this.actor.send({ type: "PROCESS_CHUNK", chunk });
  }
}
