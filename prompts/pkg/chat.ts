import type { DocTypes } from "@fireproof/core-types-base";
import type { RuntimeError } from "use-vibes";
import { ViewType } from "./view-state.js";

// ===== Vibe Document Type =====
export interface VibeDocument {
  _id: "vibe";
  title: string;
  encodedTitle: string;
  remixOf: string;
  created_at: number;
  slug?: string;
  favorite?: boolean;
  publishedUrl?: string;
  firehoseShared?: boolean;
  titleSetManually?: boolean;
  /**
   * Optional per‑chat model override. When set to a valid model id
   * from app/data/models.json it will be used for subsequent LLM calls
   * in this session. When absent or invalid, fall back to user settings
   * (global) model and finally the default.
   */
  selectedModel?: string;
  /**
   * Per‑vibe selected dependency modules (by catalog name).
   * These control which helper libraries and docs are injected into prompts.
   */
  dependencies?: string[];
  /**
   * When true, treat `dependencies` as a user override and bypass any
   * automatic/catalog-based module selection.
   */
  dependenciesUserOverride?: boolean;
  /**
   * AI-selected dependencies from last prompt analysis.
   * These are displayed in the UI when user hasn't made an override.
   */
  aiSelectedDependencies?: string[];
  /**
   * When true, enable instructional text in prompts regardless of LLM decision.
   * When false, disable instructional text regardless of LLM decision.
   * When undefined, use LLM decision.
   */
  instructionalTextOverride?: boolean;
  /**
   * When true, enable demo data in prompts regardless of LLM decision.
   * When false, disable demo data regardless of LLM decision.
   * When undefined, use LLM decision.
   */
  demoDataOverride?: boolean;
  /**
   * Screenshot and source code file attachments for catalog storage.
   * Stored in the catalog database for persistent vibe screenshots and source.
   */
  _files?: {
    screenshot: File;
    source: File;
  };
}

// ===== Content Segment Types =====
export interface Segment {
  type: "markdown" | "code";
  content: string;
}

// ===== Document Types =====

export interface BaseChatMessageDocument {
  _id?: string;
  session_id: string;
  text: string;
  created_at: number;
}

export type UserChatMessageDocument = BaseChatMessageDocument & {
  type: "user";
};

export type AiChatMessageDocument = BaseChatMessageDocument & {
  type: "ai";
  model?: string; // The model used to generate this message
  isEditedCode?: boolean; // Flag to indicate this message contains edited code
};

export type SystemChatMessageDocument = BaseChatMessageDocument & {
  type: "system";
  errorType?: string; // Type of error if this is an error message
  errorCategory?: "immediate" | "advisory"; // Category of error
};

export type ChatMessageDocument =
  | UserChatMessageDocument
  | AiChatMessageDocument
  | SystemChatMessageDocument;

/**
 * Base document interface with common properties
 */
export interface DocBase {
  _id: string;
}

/**
 * Document type for screenshot entries
 */
export interface ScreenshotDocument extends DocBase {
  type: "screenshot";
  session_id: string;
  cid?: string; // Content identifier for deduplication
  _files?: {
    screenshot: File;
  };
}

// Note: We already have a SessionDocument interface, so merged the properties
export interface SessionDocument extends DocTypes {
  _id?: string;
  type: "session"; // Document type for Fireproof queries
  title?: string;
  created_at: number;
  favorite?: boolean; // Added favorite property for starring sessions
  publishedUrl?: string; // URL where the app is published
  messages?: {
    text: string;
    type: "user" | "ai" | "system";
    code?: string;
    dependencies?: Record<string, string>;
  }[];
}

/**
 * Union type for documents returned by query
 */
export type SessionOrScreenshot = SessionDocument | ScreenshotDocument;

// ===== UI Enhanced Types =====
// Enhanced types with additional UI properties
export type ChatMessage = ChatMessageDocument & {
  text: string;
  timestamp?: number;
  dependenciesString?: string;
};

// User chat message type used in the UI
export type UserChatMessage = ChatMessage & {
  type: "user";
};

// Enhanced AiChatMessage type with segments for structured display
export type AiChatMessage = ChatMessage & {
  type: "ai";
  segments?: Segment[];
  isStreaming?: boolean;
};

// System message type for errors and important system notifications
export type SystemChatMessage = ChatMessage & {
  type: "system";
  errorType?: string;
  errorCategory?: "immediate" | "advisory";
};

// ===== Component Props =====
export interface BaseChatState {
  isEmpty: boolean;
  docs: ChatMessageDocument[];
  input: string;
  setInput: (input: string) => void;
  isStreaming: boolean;
  codeReady: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  sendMessage: (text?: string) => Promise<void>;
  saveCodeAsAiMessage: (
    code: string,
    currentMessages: ChatMessageDocument[],
  ) => Promise<string>;
  title: string;
  updateTitle: (title: string, isManual?: boolean) => Promise<void>;
  addScreenshot: (screenshot: string | null) => Promise<void>;
  setSelectedResponseId: (id: string) => void;
  selectedResponseDoc?: ChatMessageDocument;
  selectedSegments?: Segment[];
  selectedCode?: Segment;
  // Per‑chat model selection
  selectedModel?: string;
  updateSelectedModel?: (modelId: string) => Promise<void>;
  effectiveModel?: string;
  globalModel?: string;
  showModelPickerInChat?: boolean;

  // Error tracking
  immediateErrors: RuntimeError[];
  advisoryErrors: RuntimeError[];
  addError: (error: RuntimeError) => void;
  vibeDoc?: VibeDocument;
}

export interface ChatState extends BaseChatState {
  sessionId: string;
}

export interface NewSessionChatState extends BaseChatState {
  sessionId: null;
}

export interface ChatInterfaceProps extends ChatState {
  // chatState is now extended
  // sessionId is part of ChatState
  onSessionCreated?: (newSessionId: string) => void;
  navigateToView: (view: ViewType) => void;
  setMobilePreviewShown: (shown: boolean) => void;
}

/**
 * Props for the SessionSidebar component
 */
export interface SessionSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  sessionId: string;
}
