import { ImageGenOptions } from 'call-ai';
import type {
  ModuleState,
  ImageDocument,
  VersionInfo,
  PromptEntry,
} from '@vibes.diy/use-vibes-types';

// Module-level state for tracking and preventing duplicate calls
export const MODULE_STATE: ModuleState = {
  pendingImageGenCalls: new Map(),
  pendingPrompts: new Set(),
  processingRequests: new Set(),
  requestTimestamps: new Map(),
  requestCounter: 0,
  createdDocuments: new Map(), // Track document IDs created for each generation request
  pendingDocumentCreations: new Map(), // Track document creation promises
};

// Helper to safely remove a key from all tracking collections
export function cleanupRequestKey(key: string) {
  MODULE_STATE.pendingImageGenCalls.delete(key);
  MODULE_STATE.processingRequests.delete(key);
  MODULE_STATE.pendingPrompts.delete(key);
  // We also clean up the document creation promise to prevent memory leaks
  MODULE_STATE.pendingDocumentCreations.delete(key);
  // Keep the createdDocuments entry as it's the actual deduplication map
  // But do clean up the timestamp to prevent memory leaks
  MODULE_STATE.requestTimestamps.delete(key);
}

/**
 * Synchronous hash function to create a key from the prompt string and options
 * @param prompt The prompt string to hash
 * @param options Optional image generation options
 * @returns A hash string for the input
 */
export function hashInput(prompt: string, options?: ImageGenOptions): string {
  // Create a string that includes both prompt and relevant options
  const inputString = JSON.stringify({
    prompt,
    // Only include relevant options properties to avoid unnecessary regeneration
    options,
    /*
    : options
      ? {
          size: options.size,
          quality: options.quality,
          model: options.model,
          style: options.style,
        }
      : undefined,
      */
  });

  // Use a fast non-crypto hash for immediate results (FNV-1a algorithm)
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < inputString.length; i++) {
    hash ^= inputString.charCodeAt(i);
    // Multiply by the FNV prime (32-bit)
    hash = Math.imul(hash, 16777619);
  }

  // Convert to hex string and take first 12 chars
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
  const requestId = hashHex.slice(0, 12);

  // Add a timestamp to make the ID unique even for identical requests
  return `${requestId}-${Date.now().toString(36)}`;
}

// Convert base64 to File object
export function base64ToFile(base64Data: string, filename: string): File {
  const byteString = atob(base64Data);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  const blob = new Blob([ab], { type: 'image/png' });
  return new File([blob], filename, { type: 'image/png' });
}

/**
 * Generate a version ID for the file namespace
 * @param versionNumber - The numeric version (1-based)
 * @returns A formatted version string like "v1", "v2", etc.
 */
export function generateVersionId(versionNumber: number): string {
  return `v${versionNumber}`;
}

/**
 * Get all version information from a document, or create a default if none exists
 * @param document - The image document
 * @returns Array of version info objects
 */
export function getVersionsFromDocument(document: Partial<ImageDocument>): {
  versions: VersionInfo[];
  currentVersion: number;
} {
  // Check if document has proper version structure
  if (document?.versions && document.versions.length > 0) {
    return {
      versions: document.versions,
      currentVersion: document.currentVersion ?? document.versions.length,
    };
  }

  // Legacy document with just an 'image' file - convert to version format
  if (document?._files?.image) {
    return {
      versions: [{ id: 'v1', created: document.created || Date.now() }],
      currentVersion: 1,
    };
  }

  // No versions found
  return { versions: [], currentVersion: 0 };
}

/**
 * Generate a prompt key for the prompts namespace
 * @param promptNumber - The numeric prompt (1-based)
 * @returns A formatted prompt string like "p1", "p2", etc.
 */
export function generatePromptKey(promptNumber: number): string {
  return `p${promptNumber}`;
}

/**
 * Get all prompt information from a document, or create a default if none exists
 * @param document - The image document
 * @returns Object with prompts record and currentPromptKey
 */
export function getPromptsFromDocument(document: Partial<ImageDocument>): {
  prompts: Record<string, PromptEntry>;
  currentPromptKey: string;
} {
  // Check if document has proper prompts structure
  if (document?.prompts && document?.currentPromptKey) {
    return {
      prompts: document.prompts,
      currentPromptKey: document.currentPromptKey,
    };
  }

  // Legacy document with just a 'prompt' string - convert to prompts format
  if (document?.prompt) {
    return {
      prompts: {
        p1: { text: document.prompt, created: document.created || Date.now() },
      },
      currentPromptKey: 'p1',
    };
  }

  // No prompts found
  return { prompts: {}, currentPromptKey: '' };
}

/**
 * Add a new version to an image document
 * @param document - The existing image document
 * @param newImageFile - The new image file to add as a version
 * @param newPrompt - Optional new prompt to use for this version
 * @returns Updated document with the new version added
 */
export function addNewVersion(
  document: ImageDocument,
  newImageFile: File,
  newPrompt?: string
): ImageDocument {
  // Get existing versions or initialize
  const { versions } = getVersionsFromDocument(document);
  const versionCount = versions.length + 1;
  const newVersionId = generateVersionId(versionCount);

  // Get existing prompts or initialize
  const { prompts, currentPromptKey } = getPromptsFromDocument(document);

  // Handle prompt versioning
  const updatedPrompts = { ...prompts };
  let updatedCurrentPromptKey = currentPromptKey;

  // If a new prompt is provided and it's different from the current one, create a new prompt version
  if (newPrompt && (!currentPromptKey || newPrompt !== prompts[currentPromptKey]?.text)) {
    const promptCount = Object.keys(updatedPrompts).length + 1;
    updatedCurrentPromptKey = generatePromptKey(promptCount);
    updatedPrompts[updatedCurrentPromptKey] = {
      text: newPrompt,
      created: Date.now(),
    };
  } else if (!updatedCurrentPromptKey && document.prompt) {
    // Legacy migration - create p1 from document.prompt
    updatedCurrentPromptKey = 'p1';
    updatedPrompts['p1'] = {
      text: document.prompt,
      created: document.created || Date.now(),
    };
  }

  // Copy existing files and add the new version
  const updatedFiles = { ...(document._files || {}) };
  updatedFiles[newVersionId] = newImageFile;

  // Handle legacy documents by migrating 'image' to 'v1' if needed
  if (versionCount === 1 && document._files?.image) {
    updatedFiles['v1'] = document._files.image;
    delete updatedFiles.image;
  }

  return {
    ...document,
    currentVersion: versionCount - 1, // Make it 0-based
    versions: [
      ...versions,
      {
        id: newVersionId,
        created: Date.now(),
        promptKey: updatedCurrentPromptKey,
      },
    ],
    prompts: updatedPrompts,
    currentPromptKey: updatedCurrentPromptKey,
    _files: updatedFiles,
  };
}

/**
 * Extract only the options properties that matter for image generation
 * to avoid unnecessary re-renders or regenerations
 */
export function getRelevantOptions(options?: ImageGenOptions): Record<string, unknown> {
  if (!options) return {};

  const relevantOptions: Record<string, unknown> = {};

  if (options.size) relevantOptions.size = options.size;
  if (options.quality) relevantOptions.quality = options.quality;
  if (options.model) relevantOptions.model = options.model;
  if (options.style) relevantOptions.style = options.style;

  return relevantOptions;
}

/**
 * Generate a safe filename based on prompt text and timestamp
 * @param promptText - The prompt text to include in the filename
 * @returns A formatted filename like "prompt-text-20250518-2117.png"
 */
export function generateSafeFilename(promptText: string): string {
  // Limit prompt length to avoid extremely long filenames
  const maxPromptChars = 40;

  // Clean the prompt by removing special characters and converting to lowercase
  const cleanedPrompt = promptText
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Keep only alphanumeric, spaces, and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .substring(0, maxPromptChars) // Limit length
    .replace(/-+$/g, ''); // Remove trailing hyphens

  // Generate date part in format YYYYMMDD-HHMM
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const timePart = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0'
  )}`;

  // Construct filename
  return `${cleanedPrompt}-${datePart}-${timePart}.png`;
}
