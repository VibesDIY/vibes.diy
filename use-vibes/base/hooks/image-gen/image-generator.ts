import {
  ImageGenOptions as BaseImageGenOptions,
  ImageResponse,
  imageGen as originalImageGen,
} from 'call-ai';
import { MODULE_STATE, getRelevantOptions } from './utils.js';

// Import ImageDocument type
import { ImageDocument } from './types.js';

// Extend the ImageGenOptions type to include our regeneration ID and other properties
interface ImageGenOptions extends BaseImageGenOptions {
  readonly _regenerationId: number;
  readonly images: File[];
  readonly document: Partial<ImageDocument>;
  readonly debug: boolean;
}

/**
 * Wrapper for imageGen that prevents duplicate calls
 * This function maintains a module-level cache to prevent duplicate API calls
 */
export async function imageGen(
  prompt: string,
  options?: Partial<ImageGenOptions>
): Promise<ImageResponse> {
  // Get the relevant options to form a stable key
  const relevantOptions = getRelevantOptions(options);

  // Track regeneration requests when an ID is provided
  // This was previously used for logging, which has been removed

  // Create a stable key for the request cache
  // Include regeneration ID if present to ensure unique keys for regeneration requests
  const stableKey = options?._regenerationId
    ? `${prompt}-${JSON.stringify(relevantOptions)}-regen-${options._regenerationId}`
    : `${prompt}-${JSON.stringify(relevantOptions)}`;

  // Create a unique ID for this specific request instance (for logging)
  const requestId = ++MODULE_STATE.requestCounter;

  // Check if this prompt+options combination is already being processed
  if (MODULE_STATE.pendingPrompts.has(stableKey)) {
    // Return the existing promise for this prompt+options combination
    if (MODULE_STATE.pendingImageGenCalls.has(stableKey)) {
      return MODULE_STATE.pendingImageGenCalls.get(stableKey) as Promise<ImageResponse>;
    }
  }

  // Mark this prompt+options as being processed
  MODULE_STATE.pendingPrompts.add(stableKey);
  MODULE_STATE.processingRequests.add(stableKey);
  MODULE_STATE.requestTimestamps.set(stableKey, Date.now());

  // Log complete request details if debug is true
  if (options?.debug) {
    console.log(`[ImgGen Debug] Generating image with prompt: "${prompt}"`, {
      requestId,
      options,
      hasImages: options.images ? options.images.length + ' files' : 'No',
      stableKey,
    });
  }

  let promise: Promise<ImageResponse>;

  try {
    // Check if we need to extract images from document
    const enhancedOptions = { ...options };

    // Extract input files from document._files if present
    if (!enhancedOptions.images && enhancedOptions.document && enhancedOptions.document._files) {
      const imageFiles: File[] = [];

      // Look for files with keys starting with 'in' (input files) or the 'original' file
      for (const key of Object.keys(enhancedOptions.document._files)) {
        if (key.startsWith('in') || key === 'original') {
          const file = enhancedOptions.document._files[key];
          if (file) {
            // Handle both direct File objects and Fireproof's DocFileMeta
            if (file instanceof File) {
              imageFiles.push(file);
            } else if (typeof file.file === 'function') {
              try {
                // For DocFileMeta objects, we need to call the file() method
                const fileObj = await file.file();
                imageFiles.push(fileObj);
              } catch (e) {
                console.error(`Error getting file from DocFileMeta for key ${key}:`, e);
              }
            }
          }
        }
      }

      // If we found image files, add them to the images option
      if (imageFiles.length > 0) {
        enhancedOptions.images = imageFiles;

        if (enhancedOptions.debug) {
          console.log('[ImgGen Debug] Extracted images from document:', {
            count: imageFiles.length,
            keys: Object.keys(enhancedOptions.document._files).filter(
              (k) => k.startsWith('in') || k === 'original'
            ),
          });
        }
      }
    }

    // Direct import from call-ai - this works consistently with test mocks
    promise = originalImageGen(prompt, enhancedOptions);
  } catch (e) {
    console.error(`[ImgGen Debug] Error with imageGen for request #${requestId}:`, e);
    promise = Promise.reject(e);
  }

  // Store the promise so other requests for the same prompt+options can use it
  MODULE_STATE.pendingImageGenCalls.set(stableKey, promise);

  // Clean up after the promise resolves or rejects
  promise
    .then((response) => {
      // Remove from processing set but KEEP in pendingPrompts to ensure deduplication persists
      // until page reload
      MODULE_STATE.processingRequests.delete(stableKey);
      return response;
    })
    .catch((error) => {
      console.error(
        `[ImgGen Debug] Request #${requestId} failed [key:${stableKey.slice(0, 12)}...]: ${error}`
      );
      // Even on failure, we'll keep the key in pendingPrompts to prevent repeated failures
      // but remove it from processing to allow potential retries after page reload
      MODULE_STATE.processingRequests.delete(stableKey);
      return Promise.reject(error);
    });

  return promise;
}

/**
 * Create a wrapper function for generating images with logging and tracking
 */
export function createImageGenerator(requestHash: string) {
  return async (
    promptText: string,
    genOptions?: Partial<ImageGenOptions>
  ): Promise<ImageResponse> => {
    // Options key no longer used for logging
    JSON.stringify(getRelevantOptions(genOptions)); // Still generate to maintain behavior

    // Check if the document has input files that should be included
    const debug = genOptions?.debug;

    // Look for input files in the document
    if (genOptions && 'document' in genOptions && genOptions.document) {
      const document = genOptions.document;
      const imageFiles: File[] = [];

      // Extract input files from document._files
      if (document._files) {
        // Find files with keys starting with 'in' (input files)
        for (const key of Object.keys(document._files)) {
          if (key.startsWith('in')) {
            const file = document._files[key];
            if (file) {
              // Handle both direct File objects and Fireproof's DocFileMeta
              if (file instanceof File) {
                imageFiles.push(file);
              } else if (typeof file.file === 'function') {
                try {
                  // For DocFileMeta objects, we need to call the file() method
                  const fileObj = await file.file();
                  imageFiles.push(fileObj);
                } catch (e) {
                  console.error(`Error getting file from DocFileMeta for key ${key}:`, e);
                }
              }
            }
          }
        }
      }

      // If we found image files, add them to options
      if (imageFiles.length > 0) {
        if (debug) {
          console.log('[imageGenerator] Found images to include:', {
            count: imageFiles.length,
            fileTypes: imageFiles.map((f) => f.type),
          });
        }

        // Update options with images array
        genOptions = {
          ...genOptions,
          images: imageFiles,
        };
      }
    }

    try {
      // Log a debug message if debug is enabled
      if (debug) {
        console.log(
          `[imageGenerator] Generating image with prompt: "${promptText.slice(
            0,
            30
          )}...", options:`,
          {
            ...genOptions,
            hasImages: genOptions?.images ? 'Yes' : 'No',
            imageCount: genOptions?.images ? genOptions.images.length : 0,
          }
        );
      }

      const response = await imageGen(promptText, genOptions);
      return response;
    } catch (error) {
      console.error(`[ImgGen Debug] Failed request [ID:${requestHash}]: ${error}`);
      throw error;
    }
  };
}
