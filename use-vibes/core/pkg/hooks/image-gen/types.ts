import type { Database, DocWithId } from 'use-fireproof';
import { ImageGenOptions, ImageResponse } from 'call-ai';

// Interface for our image documents in Fireproof
// Interface for prompt entry
export interface PromptEntry {
  readonly text: string; // The prompt text content
  readonly created: number; // Timestamp when this prompt was created
}

export interface ImageDocumentPlain {
  readonly _rev?: string;
  readonly type: 'image'; // Document type identifier
  readonly prompt?: string; // Legacy field, superseded by prompts/currentPromptKey
  readonly prompts?: Record<string, PromptEntry>; // Prompts keyed by ID (p1, p2, etc.)
  readonly created: number;
  readonly currentVersion: number; // The currently active version index (0-based)
  readonly versions: VersionInfo[]; // Array of version metadata
  readonly currentPromptKey: string; // The currently active prompt key
}

export type ImageDocument = DocWithId<ImageDocumentPlain>;

export type PartialImageDocument = DocWithId<Partial<ImageDocumentPlain>>;

// Interface for version information
//         { fileKey: 'image-v0', promptKey: 'prompt-0', timestamp: 1620000000000 },
export interface VersionInfo {
  readonly id: string; // Version identifier (e.g. "v1", "v2")
  readonly created: number; // Timestamp when this version was created
  readonly promptKey?: string; // Reference to the prompt used for this version (e.g. "p1")
}

export type GenerationPhase = 'idle' | 'generating' | 'complete' | 'error';

/** Input options for the useImageGen hook */
export interface UseImageGenOptions {
  /** Prompt text for image generation */
  readonly prompt: string;

  /** Document ID for fetching existing image */
  readonly _id: string;

  readonly _rev?: string;

  /** Fireproof database name or instance */
  readonly database: string | Database;

  /** Image generator options */
  readonly options: Partial<ImageGenOptions>;

  /**
   * Generation ID - a unique identifier that changes ONLY when a fresh request is made.
   * This replaces the regenerate flag with a more explicit state change signal.
   */
  readonly generationId: string;

  /** Flag to skip processing when neither prompt nor _id is valid */
  readonly skip: boolean;

  readonly type?: string;
  readonly currentVersion?: number;
  readonly versions?: {
    readonly id: string;
    readonly created: number;
    readonly promptKey: string;
  }[];
  readonly _files?: Record<string, File>;

  readonly prompts?: Record<string, PromptEntry>;

  /**
   * Edited prompt that should override the document prompt on regeneration
   * This is used when the user edits the prompt in the UI before regenerating
   */
  readonly editedPrompt: string;
}

export interface UseImageGenResult {
  /** Base64 image data */
  readonly imageData?: string | null;

  /** Whether the image is currently loading */
  readonly loading: boolean;

  /** Progress percentage (0-100) */
  readonly progress: number;

  /** Error if image generation failed */
  readonly error?: Error | null;

  /** Size information parsed from options */
  readonly size?: {
    readonly width: number;
    readonly height: number;
  };

  /** Document for the generated image */
  readonly document?: PartialImageDocument | null;
}

// Module state type for tracking pending requests and their results
export interface ModuleState {
  readonly pendingImageGenCalls: Map<string, Promise<ImageResponse>>;
  readonly pendingPrompts: Set<string>;
  readonly processingRequests: Set<string>;
  readonly requestTimestamps: Map<string, number>;
  requestCounter: number;
  // Track which image generation requests have already created documents
  // Map from prompt+options hash to document ID
  readonly createdDocuments: Map<string, string>;
  // Track pending document creation promises to deduplicate db.put operations
  readonly pendingDocumentCreations: Map<string, Promise<{ id: string; doc: ImageDocument }>>;
}
