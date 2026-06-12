import { SetURLSearchParams } from "react-router";
import { type } from "arktype";
import { isPromptBlockBegin, isPromptBlockEnd, LLMChatEntry, PromptAndBlockMsgs } from "@vibes.diy/api-types";
import { isCodeBegin } from "@vibes.diy/call-ai-v2";
import type { VibesTheme } from "@vibes.diy/prompts";

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
  | ClearChat;

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
      };

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

    case isPromptBlockEnd(block):
      // console.log(`PromptBlock-End`, block);
      return { ...state, running: false };
    case isCodeBegin(block):
      if (!state.current) return state;
      return {
        ...state,
        hasCode: true,
        current: { ...state.current, msgs: [...state.current.msgs, block] },
        blocks: state.blocks.map((b, i) => (i === state.blocks.length - 1 ? { ...b, msgs: [...b.msgs, block] } : b)),
      };
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
