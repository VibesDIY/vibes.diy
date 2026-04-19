import React from "react";
import { Database, DocWithId } from "use-fireproof";

export interface VersionInfo {
  readonly id: string; // Version identifier (e.g. "v1", "v2")
  readonly created: number; // Timestamp when this version was created
  readonly promptKey?: string; // Reference to the prompt used for this version (e.g. "p1")
}

export interface PromptEntry {
  readonly text: string; // The prompt text content
  readonly created: number; // Timestamp when this prompt was created
}

export interface ImageDocumentPlain {
  readonly _rev?: string;
  readonly type: "image"; // Document type identifier
  readonly prompt?: string; // Legacy field, superseded by prompts/currentPromptKey
  readonly prompts?: Record<string, PromptEntry>; // Prompts keyed by ID (p1, p2, etc.)
  readonly created: number;
  readonly currentVersion: number; // The currently active version index (0-based)
  readonly versions: VersionInfo[]; // Array of version metadata
  readonly currentPromptKey: string; // The currently active prompt key
}

export type PartialImageDocument = DocWithId<Partial<ImageDocumentPlain>>;

export interface ImgVibesOptions {
  /**
   * Style of the generated image
   */
  readonly style?: string;

  /**
   * For image editing: array of File objects to be edited
   */
  readonly images?: File[];

  /**
   * Custom base URL for the image generation API
   * Can also be set via window.CALLAI_IMG_URL or callAiEnv.CALLAI_IMG_URL
   */
  readonly imgUrl?: string;

  /**
   * Direct API endpoint to use for image generation
   * When provided, this takes precedence over imgUrl and bypasses
   * the default endpoint construction (useful for calling OpenAI directly)
   */
  readonly endpoint?: string;

  /**
   * Enable debug logging
   */
  readonly debug?: boolean;

  //   readonly mock?: Mocks;
}

export interface UseImgVibesResult {
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

export interface ImgVibesClasses {
  /** Root container class */
  readonly root: string;
  /** Image container class */
  readonly container: string;
  /** Image element class */
  readonly image: string;
  /** Overlay panel class */
  readonly overlay: string;
  /** Progress indicator class */
  readonly progress: string;
  /** Placeholder element class */
  readonly placeholder: string;
  /** Error container class */
  readonly error: string;
  /** Control buttons container class */
  readonly controls: string;
  /** Button class */
  readonly button: string;
  /** Prompt container class */
  readonly prompt: string;
  /** Delete confirmation overlay class */
  readonly deleteOverlay: string;
  /** Drop zone class for file uploads */
  readonly dropZone: string;
  /** Upload waiting container class */
  readonly uploadWaiting: string;
}

/** Input options for the useImgVibes hook */
export interface UseImgVibesOptions {
  /** Prompt text for image generation */
  readonly prompt: string;

  /** Document ID for fetching existing image */
  readonly _id: string;

  readonly _rev?: string;

  /** Fireproof database name or instance */
  readonly database: string | Database;

  /** Image generator options */
  readonly options: Partial<ImgVibesOptions>;

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

export interface UseImgVibesResult {
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

export interface ImgVibesProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onError" | "className"> {
  /** Text prompt for image generation (required unless _id is provided) */
  readonly prompt: string;

  /** Document ID to load a specific image instead of generating a new one */
  readonly _id: string;

  /** Classname(s) to apply to the image */
  readonly className: string;

  /** Alt text for the image */
  readonly alt: string;

  /** Array of images to edit or combine with AI */
  readonly images: File[];

  /** Image generation options */
  readonly options: ImgVibesOptions;

  /** Database name or instance to use for storing images */
  readonly database: string | Database;

  readonly useImgVibes: (options: Partial<UseImgVibesOptions>) => UseImgVibesResult;

  /** Callback when image load completes successfully */
  readonly onComplete: () => void;

  /** Callback when image load fails */
  readonly onError: (error: Error) => void;

  /** Callback when document is deleted */
  readonly onDelete: (id: string) => void;

  /** Callback when prompt is edited */
  readonly onPromptEdit: (id: string, newPrompt: string) => void;

  /** Custom CSS classes for styling component parts */
  readonly classes: ImgVibesClasses;

  /** Callback when a new document is created via drop or file picker */
  readonly onDocumentCreated: (docId: string) => void;

  /** Enable debug logging */
  readonly debug: boolean;
}
