import type { DocTypes } from 'use-fireproof';
import type { RuntimeError } from '../hooks/useRuntimeErrors';
import type { ViewType } from '../utils/ViewState'; // Import ViewType
export type { ViewType } from '../utils/ViewState'; // Re-export ViewType

// ===== Vibe Document Type =====
export interface VibeDocument {
  _id: 'vibe';
  title: string;
  encodedTitle: string;
  remixOf: string;
  created_at: number;
  slug?: string;
  favorite?: boolean;
  publishedUrl?: string;
  firehoseShared?: boolean;
}

// ===== Content Segment Types =====
export interface Segment {
  type: 'markdown' | 'code';
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
  type: 'user';
};

export type AiChatMessageDocument = BaseChatMessageDocument & {
  type: 'ai';
  model?: string; // The model used to generate this message
};

export type SystemChatMessageDocument = BaseChatMessageDocument & {
  type: 'system';
  errorType?: string; // Type of error if this is an error message
  errorCategory?: 'immediate' | 'advisory'; // Category of error
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
  type: 'screenshot';
  session_id: string;
  _files?: {
    screenshot: { file: () => Promise<File>; type: string };
  };
}

// Note: We already have a SessionDocument interface, so merged the properties
export interface SessionDocument extends DocTypes {
  _id?: string;
  type: 'session'; // Document type for Fireproof queries
  title?: string;
  created_at: number;
  favorite?: boolean; // Added favorite property for starring sessions
  publishedUrl?: string; // URL where the app is published
  messages?: {
    text: string;
    type: 'user' | 'ai' | 'system';
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
};

// User chat message type used in the UI
export type UserChatMessage = ChatMessage & {
  type: 'user';
};

// Enhanced AiChatMessage type with segments for structured display
export type AiChatMessage = ChatMessage & {
  type: 'ai' | "user";
  segments?: Segment[];
  isStreaming?: boolean;
  dependenciesString?: string;
};

// System message type for errors and important system notifications
export type SystemChatMessage = ChatMessage & {
  type: 'system';
  errorType?: string;
  errorCategory?: 'immediate' | 'advisory';
};

// ===== Component Props =====
export interface ChatState {
  isEmpty: boolean;
  docs: ChatMessageDocument[];
  input: string;
  setInput: (input: string) => void;
  isStreaming: boolean;
  codeReady: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  sendMessage: (text?: string) => Promise<void>;
  title: string;
  addScreenshot: (screenshot: string | null) => Promise<void>;
  sessionId?: string | null;
  setSelectedResponseId: (id: string) => void;
  selectedResponseDoc?: ChatMessageDocument;
  selectedSegments?: Segment[];
  selectedCode?: Segment;
  needsNewKey?: boolean;
  setNeedsNewKey: (value: boolean) => void;

  // Error tracking
  immediateErrors: RuntimeError[];
  advisoryErrors: RuntimeError[];
  addError: (error: RuntimeError) => void;
  vibeDoc?: VibeDocument;
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
