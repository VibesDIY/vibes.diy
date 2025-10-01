import { ComponentType } from 'react';

/**
 * Generic props type for generated components
 */
export type GeneratedComponentProps = Record<string, unknown>;

/**
 * Options for the useVibes hook
 */
export interface UseVibesOptions {
  /** Database name to use for storing vibes (default: 'vibes') */
  database?: string;

  /** AI model to use for generation */
  model?: string;

  /** Skip generation if true */
  skip?: boolean;

  /** Force regeneration even if cached version exists */
  regenerate?: boolean;

  /** Helper libraries/dependencies to include in the generation */
  dependencies?: string[];

  /** Load existing vibe by document ID instead of generating new */
  _id?: string;
}

/**
 * Result object returned by useVibes hook
 */
export interface UseVibesResult {
  /** The generated React component (ready to render) */
  App: ComponentType<GeneratedComponentProps> | null;

  /** Raw JSX source code */
  code: string | null;

  /** Whether generation is in progress */
  loading: boolean;

  /** Any error that occurred during generation */
  error: Error | null;

  /** Generation progress (0-100) */
  progress: number;

  /** Function to force regeneration */
  regenerate: () => void;

  /** Full document from database (available after loading) */
  document?: VibeDocument | null;
}

/**
 * Document structure stored in Fireproof database
 */
export interface VibeDocument {
  /** Document ID (hash of prompt + options) */
  _id: string;

  /** Original prompt used to generate the component */
  prompt: string;

  /** Generated JSX source code */
  code: string;

  /** Component title (extracted or generated) */
  title: string;

  /** Dependencies used during generation */
  dependencies: string[];

  /** AI model used for generation */
  model: string;

  /** Timestamp when created */
  created_at: number;

  /** Document version (for future versioning) */
  version: number;

  /** Additional metadata */
  metadata?: {
    /** Tokens used during generation */
    tokens_used?: number;

    /** Time taken to generate (milliseconds) */
    generation_time?: number;

    /** Hash of options used */
    options_hash?: string;
  };
}

/**
 * Internal state used by the hook
 */
export interface UseVibesState {
  App: ComponentType<GeneratedComponentProps> | null;
  code: string | null;
  loading: boolean;
  error: Error | null;
  progress: number;
  document: VibeDocument | null;
}
