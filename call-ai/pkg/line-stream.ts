import { OnFunc } from "@adviser/cement";
import { setup, assign, emit, raise, createActor } from "xstate";

// TODO: implement Nesting { { }}
// TODO: optional implement []
// TODO: string " { ", " \"  } "
// emit events allow the reassembly of the json

export enum LineStreamState {
  WaitForOpeningCurlyBracket,
  WaitingForClosingCurlyBracket,
  WaitingForEOL,
}

// Event types for external callbacks
interface FragmentEvent {
  type: "fragment";
  lineNr: number;
  fragment: string;
  seq: number;
  lineComplete: boolean;
}

interface BracketOpenCloseEvent {
  type: "bracket";
  bracket: "open" | "close";
}

interface InBracketEvent {
  type: "inBracket";
  seqStyle: "first" | "last" | "middle";
  block: number;
  seq: number;
  content: string;
}

type BracketEvent = BracketOpenCloseEvent | InBracketEvent;

// XState machine context
interface LineStreamContext {
  seq: number;
  lineNr: number;
  rest: string;
  blockId: number;
  chunk: string;
}

// XState machine events
type MachineEvents = { type: "PROCESS_CHUNK"; chunk: string } | { type: "CONSUME" };

// Create machine factory with configurable initial state
function createLineStreamMachine(initialStateName: string) {
  return setup({
    types: {
      context: {} as LineStreamContext,
      events: {} as MachineEvents,
      emitted: {} as FragmentEvent | BracketEvent,
    },
    actions: {
      // Emission actions
      emitBracketOpen: emit({ type: "bracket", bracket: "open" } as const),
      emitBracketClose: emit({ type: "bracket", bracket: "close" } as const),
      emitInBracketFirst: emit(({ context }) => ({
        type: "inBracket" as const,
        seqStyle: "first" as const,
        block: context.blockId,
        seq: context.seq,
        content: context.chunk,
      })),
      emitInBracketMiddle: emit(({ context }) => ({
        type: "inBracket" as const,
        seqStyle: "middle" as const,
        block: context.blockId,
        seq: context.seq,
        content: context.chunk,
      })),
      emitInBracketLast: emit(({ context }) => ({
        type: "inBracket" as const,
        seqStyle: "last" as const,
        block: context.blockId,
        seq: context.seq,
        content: context.chunk.slice(0, context.chunk.indexOf("}")),
      })),
      emitFragmentComplete: emit(({ context }) => ({
        type: "fragment" as const,
        lineNr: context.lineNr,
        fragment: context.chunk.slice(0, context.chunk.indexOf("\n")),
        seq: context.seq,
        lineComplete: true,
      })),
      emitFragmentIncomplete: emit(({ context }) => ({
        type: "fragment" as const,
        lineNr: context.lineNr,
        fragment: context.chunk,
        seq: context.seq,
        lineComplete: false,
      })),

      // Context update actions
      loadChunk: assign({
        chunk: ({ context, event }) => (event.type === "PROCESS_CHUNK" ? context.rest + event.chunk : context.chunk),
      }),
      consumeOpenBracket: assign({
        rest: ({ context }) => context.chunk.slice(context.chunk.indexOf("{") + 1),
        chunk: ({ context }) => context.chunk.slice(context.chunk.indexOf("{") + 1),
      }),
      consumeCloseBracket: assign({
        rest: ({ context }) => context.chunk.slice(context.chunk.indexOf("}") + 1),
        chunk: ({ context }) => context.chunk.slice(context.chunk.indexOf("}") + 1),
        blockId: ({ context }) => context.blockId + 1,
        seq: 0,
      }),
      consumeEOL: assign({
        seq: 0,
        lineNr: ({ context }) => context.lineNr + 1,
        chunk: ({ context }) => context.chunk.slice(context.chunk.indexOf("\n") + 1),
      }),
      saveRest: assign({
        rest: ({ context }) => context.chunk,
      }),
      clearRestAndIncrementSeq: assign({
        rest: "",
        seq: ({ context }) => context.seq + 1,
      }),
      incrementSeq: assign({
        seq: ({ context }) => context.seq + 1,
      }),

      // Internal event triggers
      raiseConsume: raise({ type: "CONSUME" }),
    },
    guards: {
      hasOpenBracket: ({ context }) => context.chunk.indexOf("{") >= 0,
      hasCloseBracket: ({ context }) => context.chunk.indexOf("}") >= 0,
      hasNestedOpenBeforeClose: ({ context }) => {
        const closeIdx = context.chunk.indexOf("}");
        const openIdx = context.chunk.indexOf("{");
        return closeIdx >= openIdx && openIdx >= 0;
      },
      hasEOL: ({ context }) => context.chunk.indexOf("\n") >= 0,
      isFirstSeq: ({ context }) => context.seq === 0,
    },
  }).createMachine({
    id: "lineStream",
    context: {
      seq: 0,
      lineNr: 0,
      rest: "",
      blockId: 0,
      chunk: "",
    },
    initial: initialStateName,
    states: {
      // State: Looking for opening curly bracket
      waitForOpeningCurlyBracket: {
        initial: "idle",
        states: {
          idle: {
            on: {
              PROCESS_CHUNK: {
                actions: ["loadChunk", "raiseConsume"],
              },
            },
          },
          foundOpen: {
            // Entry: emit bracket open, then transition to closing bracket state
            entry: ["emitBracketOpen"],
            always: {
              target: "#lineStream.waitingForClosingCurlyBracket.consuming",
            },
          },
        },
        on: {
          CONSUME: [
            {
              guard: "hasOpenBracket",
              actions: ["consumeOpenBracket"],
              target: ".foundOpen",
            },
            {
              actions: ["saveRest"],
              target: ".idle",
            },
          ],
        },
      },

      // State: Looking for closing curly bracket
      waitingForClosingCurlyBracket: {
        initial: "idle",
        states: {
          idle: {
            on: {
              PROCESS_CHUNK: {
                actions: ["loadChunk", "raiseConsume"],
              },
            },
          },
          consuming: {
            // Transient state that immediately processes via CONSUME
            entry: ["raiseConsume"],
          },
          yieldingFirst: {
            entry: ["emitInBracketFirst", "clearRestAndIncrementSeq"],
            always: { target: "idle" },
          },
          yieldingMiddle: {
            entry: ["emitInBracketMiddle", "clearRestAndIncrementSeq"],
            always: { target: "idle" },
          },
          foundClose: {
            entry: ["emitInBracketLast", "consumeCloseBracket", "emitBracketClose"],
            always: {
              target: "#lineStream.waitForOpeningCurlyBracket",
              actions: ["raiseConsume"],
            },
          },
        },
        on: {
          CONSUME: [
            // Nested open bracket before close - delegate back to opening state
            {
              guard: "hasNestedOpenBeforeClose",
              target: "#lineStream.waitForOpeningCurlyBracket",
              actions: ["raiseConsume"],
            },
            // Found closing bracket
            {
              guard: "hasCloseBracket",
              target: ".foundClose",
            },
            // No closing bracket - yield content
            {
              guard: "isFirstSeq",
              target: ".yieldingFirst",
            },
            {
              target: ".yieldingMiddle",
            },
          ],
        },
      },

      // State: Looking for end of line
      waitingForEOL: {
        initial: "idle",
        states: {
          idle: {
            on: {
              PROCESS_CHUNK: {
                actions: ["loadChunk", "raiseConsume"],
              },
            },
          },
          yieldingComplete: {
            entry: ["emitFragmentComplete", "consumeEOL", "raiseConsume"],
            // Will transition based on next CONSUME event
          },
          yieldingIncomplete: {
            entry: ["emitFragmentIncomplete", "incrementSeq"],
            always: { target: "idle" },
          },
        },
        on: {
          CONSUME: [
            {
              guard: "hasEOL",
              target: ".yieldingComplete",
            },
            {
              target: ".yieldingIncomplete",
            },
          ],
        },
      },
    },
  });
}

// Map LineStreamState enum to XState state names
function getInitialStateName(state: LineStreamState): string {
  switch (state) {
    case LineStreamState.WaitForOpeningCurlyBracket:
      return "waitForOpeningCurlyBracket";
    case LineStreamState.WaitingForClosingCurlyBracket:
      return "waitingForClosingCurlyBracket";
    case LineStreamState.WaitingForEOL:
      return "waitingForEOL";
  }
}

export class LineStreamParser {
  readonly onFragment =
    OnFunc<(f: { type: "fragment"; lineNr: number; fragment: string; seq: number; lineComplete: boolean }) => void>();

  readonly onBracket = OnFunc<
    (
      b:
        | {
            type: "inBracket";
            seqStyle: "first" | "last" | "middle";
            block: number;
            seq: number;
            content: string;
          }
        | { type: "bracket"; bracket: "open" | "close" },
    ) => void
  >();

  private actor: ReturnType<typeof createActor<ReturnType<typeof createLineStreamMachine>>>;

  constructor(initialState: LineStreamState) {
    const stateName = getInitialStateName(initialState);
    const machine = createLineStreamMachine(stateName);

    this.actor = createActor(machine);

    // Subscribe to emitted events and forward to callbacks
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

  processChunk(chunk: string) {
    this.actor.send({ type: "PROCESS_CHUNK", chunk });
  }
}
