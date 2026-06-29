import { SetURLSearchParams } from "react-router";
import { type } from "arktype";
import {
  isPromptBlockBegin,
  isPromptBlockEnd,
  isPromptError,
  isPromptReq,
  LLMChatEntry,
  PromptAndBlockMsgs,
} from "@vibes.diy/api-types";
import { isBlockEnd, isCodeBegin } from "@vibes.diy/call-ai-v2";
import type { VibesTheme } from "@vibes.diy/prompts";

export type StreamConnection = "live" | "reconnecting" | "failed";

export interface PromptState {
  chat: LLMChatEntry;
  running: boolean;
  current?: PromptBlock;
  blocks: PromptBlock[];
  hasCode: boolean;
  title: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  // Source-of-truth code for a given fsId when no ChatSections exist for it
  // (e.g. after a remix where the Apps row was pointer-copied without a
  // replayed prompt). CodeEditor falls back to this when getCode returns no
  // blocks for the current fsId.
  hydratedSource?: { fsId: string; code: string[] };
  // Canonical file-system snapshot for the currently-loaded fsId. The code
  // panel renders from this structure in file-system-primary mode.
  hydratedFileSystem?: {
    fsId: string;
    files: HydratedCodeViewFile[];
  };
  // Block IDs whose save originated from the agent autosave (end-of-aider-
  // turn) rather than a manual editor save. Populated only for the lifetime
  // of an open chat session — chat reload loses these tags and the MessageList
  // falls back to "User edited code" for old auto-saves. Acceptable: the
  // alternative would require a wire-format change.
  agentSavedBlockIds: ReadonlySet<string>;
  icon?: { cid: string; mime: string };
  // The selected theme (catalog or imported). Sourced from app_settings
  // alongside title/icon so a single dispatch updates all three.
  theme?: VibesTheme | null;
  // Optional colorset slug. When set, the codegen pipeline composes this
  // colorset's palette with the structural `theme`. Defaults to the same
  // slug as `theme` (matching today's behavior).
  colorTheme?: string | null;
  // WebSocket section-stream health. "reconnecting" drives the re-open/replay
  // convergence loop; "failed" surfaces the reload affordance after the loop
  // gives up. The streamId of the turn in flight pins convergence to the right
  // prompt — replayed ends of historical turns must not flip us back to live.
  connection: StreamConnection;
  inFlightStreamId?: string;
  // The just-submitted user prompt, shown immediately as an optimistic chat
  // bubble so the message is visible the instant the user hits Code (or clicks
  // a suggestion) — not after the server round-trips the prompt.req back. The
  // server echo (prompt.req) clears it: the real message then renders in its
  // place. A failed chat.prompt() also clears it (route dispatches undefined).
  optimisticPrompt?: string;
}

export interface HydratedCodeViewFile {
  fileName: string;
  lang: string;
  code: string[];
  entryPoint?: boolean;
}

export interface PromptBlock {
  // reqs: PromptReq[]
  msgs: PromptAndBlockMsgs[];
}

const InitChat = type({
  type: "'initChat'",
  chat: LLMChatEntry,
});
type InitChat = typeof InitChat.infer;

function isInitChat(msg: unknown): msg is InitChat {
  return !(InitChat(msg) instanceof type.errors);
}

const SetTitle = type({
  type: "'setTitle'",
  title: "string",
});
type SetTitle = typeof SetTitle.infer;

function isSetTitle(msg: unknown): msg is SetTitle {
  return !(SetTitle(msg) instanceof type.errors);
}

const SetIcon = type({
  type: "'setIcon'",
  icon: type({ cid: "string", mime: "string" }),
});
type SetIcon = typeof SetIcon.infer;

function isSetIcon(msg: unknown): msg is SetIcon {
  return !(SetIcon(msg) instanceof type.errors);
}

// SetTheme accepts a nullable theme so a single action can either set or clear
// the selection. Imported (custom) .md themes use the same shape — they're not
// in the catalog but the in-memory record is the same VibesTheme structure.
interface SetTheme {
  type: "setTheme";
  theme: VibesTheme | null;
}
function isSetTheme(msg: unknown): msg is SetTheme {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "setTheme";
}

// SetColorTheme stores just the slug — the colorset is composed at codegen
// time on the backend, so the frontend doesn't need the full color values
// in state. Nullable so the same action can clear the override (falling back
// to the colorset matching the structural theme's slug).
interface SetColorTheme {
  type: "setColorTheme";
  colorTheme: string | null;
}
function isSetColorTheme(msg: unknown): msg is SetColorTheme {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "setColorTheme";
}

const SetHydratedSource = type({
  type: "'setHydratedSource'",
  fsId: "string",
  code: "string[]",
});
type SetHydratedSource = typeof SetHydratedSource.infer;

function isSetHydratedSource(msg: unknown): msg is SetHydratedSource {
  return !(SetHydratedSource(msg) instanceof type.errors);
}

interface SetHydratedFileSystem {
  type: "setHydratedFileSystem";
  fsId: string;
  files: HydratedCodeViewFile[];
}

function isSetHydratedFileSystem(msg: unknown): msg is SetHydratedFileSystem {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "setHydratedFileSystem";
}

const MarkAgentSaved = type({
  type: "'markAgentSaved'",
  blockId: "string",
});
type MarkAgentSaved = typeof MarkAgentSaved.infer;

function isMarkAgentSaved(msg: unknown): msg is MarkAgentSaved {
  return !(MarkAgentSaved(msg) instanceof type.errors);
}

interface ClearChat {
  type: "clearChat";
  appSlug: string;
}

function isClearChat(msg: unknown): msg is ClearChat {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "clearChat";
}

interface StreamDisconnected {
  type: "streamDisconnected";
}
function isStreamDisconnected(msg: unknown): msg is StreamDisconnected {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "streamDisconnected";
}

// Clears stream-derived state before consuming a re-opened chat's replay so
// replayed blocks don't double up. Settings-derived fields (title/icon/theme)
// and inFlightStreamId survive — the replay/refresh re-deliver or consume them.
interface ReplayReset {
  type: "replayReset";
}
function isReplayReset(msg: unknown): msg is ReplayReset {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "replayReset";
}

interface ReconnectFailed {
  type: "reconnectFailed";
}
function isReconnectFailed(msg: unknown): msg is ReconnectFailed {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "reconnectFailed";
}

interface SetInFlightStreamId {
  type: "setInFlightStreamId";
  streamId: string;
}
function isSetInFlightStreamId(msg: unknown): msg is SetInFlightStreamId {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "setInFlightStreamId";
}

// Set (or clear, when `text` is undefined) the optimistic prompt bubble. The
// route dispatches this with the submitted text right before chat.prompt(),
// and with undefined if that call errors before the server echoes prompt.req.
interface SetOptimisticPrompt {
  type: "setOptimisticPrompt";
  text?: string;
}
function isSetOptimisticPrompt(msg: unknown): msg is SetOptimisticPrompt {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "setOptimisticPrompt";
}

// Codegen admission roll (cold-start design). When chat.prompt() returns
// `shard-overloaded`, the client has rolled to the next shard in the user's
// family and dropped the old socket — but the new socket has NO chat context
// bound (the server requires openChat on the same connection). Unlike a bare
// idle `streamDisconnected` (a no-op), this FORCES `connection: "reconnecting"`
// so the reconnect loop re-opens the chat on the rolled shard; the route then
// re-queues the prompt to retry there. Without this, an overload-triggered roll
// would strand the chat on a context-less socket. (Charlie review, #2829)
interface RollReconnect {
  type: "rollReconnect";
}
function isRollReconnect(msg: unknown): msg is RollReconnect {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "rollReconnect";
}

export type PromptAction =
  | PromptAndBlockMsgs
  | InitChat
  | SetTitle
  | SetIcon
  | SetTheme
  | SetColorTheme
  | SetHydratedSource
  | SetHydratedFileSystem
  | MarkAgentSaved
  | ClearChat
  | StreamDisconnected
  | ReplayReset
  | ReconnectFailed
  | RollReconnect
  | SetInFlightStreamId
  | SetOptimisticPrompt;

export function promptReducer(state: PromptState, block: PromptAction): PromptState {
  switch (true) {
    case isClearChat(block):
      return {
        ...state,
        chat: {} as LLMChatEntry,
        blocks: [],
        running: false,
        hasCode: false,
        current: undefined,
        title: block.appSlug,
        icon: undefined,
        theme: null,
        colorTheme: null,
        agentSavedBlockIds: new Set<string>(),
        hydratedSource: undefined,
        hydratedFileSystem: undefined,
        connection: "live",
        inFlightStreamId: undefined,
        optimisticPrompt: undefined,
      };

    case isStreamDisconnected(block): {
      // A turn is in flight once the prompt is acknowledged (inFlightStreamId
      // set when chat.prompt() resolves) or the first block-begin has arrived
      // (running). `running` flips true only on block-begin, so guarding on it
      // alone drops a disconnect in the ack→block-begin window and the
      // reconnect loop never starts. A bare idle disconnect (no turn) is a no-op.
      const turnInFlight = state.running || state.inFlightStreamId !== undefined;
      if (!turnInFlight || state.connection !== "live") return state;
      return { ...state, connection: "reconnecting" };
    }

    case isRollReconnect(block):
      // Force reconnect regardless of turn state. A shard-overloaded roll happens
      // before any block arrives (running=false, no inFlightStreamId), so the
      // turnInFlight guard in streamDisconnected would drop it — but the socket
      // DID change shards and needs openChat re-run. Idempotent: already
      // reconnecting/failed stays as-is.
      if (state.connection === "reconnecting") return state;
      return { ...state, connection: "reconnecting" };

    case isReplayReset(block):
      return { ...state, blocks: [], current: undefined, running: false, hasCode: false };

    case isReconnectFailed(block):
      return { ...state, connection: "failed", running: false };

    case isSetInFlightStreamId(block):
      return { ...state, inFlightStreamId: block.streamId };

    case isSetOptimisticPrompt(block):
      return { ...state, optimisticPrompt: block.text };

    case isInitChat(block):
      // console.log(`initChat`, block.chat)
      return { ...state, chat: block.chat };

    case isSetTitle(block):
      return { ...state, title: block.title };

    case isSetIcon(block):
      return { ...state, icon: block.icon };

    case isSetTheme(block):
      return { ...state, theme: block.theme };

    case isSetColorTheme(block):
      return { ...state, colorTheme: block.colorTheme };

    case isSetHydratedSource(block):
      return { ...state, hydratedSource: { fsId: block.fsId, code: block.code } };

    case isSetHydratedFileSystem(block):
      return { ...state, hydratedFileSystem: { fsId: block.fsId, files: block.files } };

    case isMarkAgentSaved(block): {
      const next = new Set(state.agentSavedBlockIds);
      next.add(block.blockId);
      return { ...state, agentSavedBlockIds: next };
    }

    // case isPromptReq(block):
    //   if (!state.current) return state;
    //   // console.log(`promptMsg`, block)
    //   return { ...state,
    //     current: { ...state.current, reqs: [...state.current.reqs, block]},
    //     blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, reqs: [...b.reqs, block] } : b)),
    //   };

    case isPromptBlockBegin(block): {
      const newBlock: PromptBlock = { msgs: [] };
      return {
        ...state,
        running: true,
        blocks: [...state.blocks, newBlock],
        current: newBlock,
      };
    }

    case isPromptBlockEnd(block): {
      // `prompt.block-end` is emitted EARLY — when generation finishes, before
      // the server's R2/DB persist (VibesDIY/vibes.diy#2472). It flips `running`
      // off so the overlay drops / chips render / submit re-enables the instant
      // generation is done. It intentionally does NOT settle
      // connection/inFlightStreamId: a disconnect in the gap before the canonical
      // post-persist `block.end` would otherwise be left without a convergence
      // anchor. The settle moves to the `block.end` case below.
      return { ...state, running: false };
    }
    case isBlockEnd(block): {
      // The canonical post-persist terminal (BlockStreamMsg) carries fsRef and is
      // the event replayed on reconnect-after-completion — so it, not the early
      // `prompt.block-end`, owns convergence: settle `connection: "live"` + clear
      // `inFlightStreamId` for the in-flight turn (matched by streamId, gated on a
      // present fsRef). It must still be appended for the fsRef consumers
      // (first-paint nav / iframe repoint / code snapshots) to find it in blocks.
      const isInFlight = state.inFlightStreamId !== undefined && block.streamId === state.inFlightStreamId && !!block.fsRef;
      const connectionPatch = isInFlight ? { connection: "live" as const, inFlightStreamId: undefined } : {};
      if (!state.current) return { ...state, ...connectionPatch };
      return {
        ...state,
        ...connectionPatch,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
    }
    case isPromptError(block): {
      // A generation that errors is terminal, exactly like block-end: flip
      // `running` off so the input re-enables, and (when this is the in-flight
      // turn) release it so the reconnect loop settles back to "live". The
      // server persists prompt.error on any thrown generation error, so this
      // also recovers chats already stuck in "Writing code..." — a prompt.error
      // replayed after an orphaned block-begin would otherwise leave `running`
      // true forever (#2057). The error block is still appended so MessageList
      // renders it (with its retry affordance).
      const isInFlight = state.inFlightStreamId !== undefined && block.streamId === state.inFlightStreamId;
      const connectionPatch = isInFlight ? { connection: "live" as const, inFlightStreamId: undefined } : {};
      if (!state.current) return { ...state, running: false, ...connectionPatch };
      return {
        ...state,
        running: false,
        ...connectionPatch,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
    }
    case isCodeBegin(block):
      if (!state.current) return state;
      return {
        ...state,
        hasCode: true,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
    case isPromptReq(block): {
      // The server echoes the submitted prompt back as prompt.req; the real
      // <Prompt> bubble then renders, so retire the optimistic one in the same
      // dispatch — no flash, no duplicate. But a reconnect replays older turns'
      // prompt.reqs first (replayReset keeps optimisticPrompt + inFlightStreamId),
      // so clearing on ANY prompt.req would drop the just-submitted bubble before
      // its own echo replays. Match this turn's echo by streamId instead.
      // inFlightStreamId is unset only on a fresh first turn whose echo can race
      // the prompt() ack — clearing then is safe (no replay in flight) and avoids
      // leaving a duplicate bubble.
      const ownEcho = state.inFlightStreamId === undefined || block.streamId === state.inFlightStreamId;
      const optimisticPrompt = ownEcho ? undefined : state.optimisticPrompt;
      if (!state.current) return { ...state, optimisticPrompt };
      return {
        ...state,
        optimisticPrompt,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
    }
    default:
      if (!state.current) return state;
      // console.log("reqs", state.current?.reqs)
      // if (isBlockEnd(block)) {
      //   console.log(`recv:`, block)
      // }
      return {
        ...state,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
  }
}
