import { useState, useEffect, useMemo, useRef } from 'react';
import { Database, useFireproof } from 'use-fireproof';
import { ImageGenOptions, ImageResponse } from 'call-ai';
import type {
  UseImageGenOptions,
  UseImageGenResult,
  ImageDocument,
} from '@vibes.diy/use-vibes-types';

import {
  hashInput,
  addNewVersion,
  getVersionsFromDocument,
  getPromptsFromDocument,
  MODULE_STATE,
  cleanupRequestKey,
  getRelevantOptions,
  generateSafeFilename,
} from './utils.js';
import { createImageGenerator } from './image-generator.js';

/**
 * Hook for generating images with call-ai's imageGen
 * Provides automatic caching, reactive updates, and progress handling
 *
 * The hook allows for two modes of operation:
 * 1. Generate a new image with a prompt (no _id provided)
 * 2. Load or update an existing image document (_id provided)
 */
export function useImageGen({
  prompt,
  _id,
  _rev,
  options = {},
  database = 'ImgGen',
  skip = false, // Skip processing flag
  generationId, // Unique ID that changes for each new generation request
  editedPrompt, // Optional edited prompt that should override the document prompt on regeneration
}: Partial<UseImageGenOptions>): UseImageGenResult {
  // If both are provided, _id takes precedence
  // This silently prioritizes the document's internal prompt
  const [imageData, setImageData] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);
  const [document, setDocument] = useState<ImageDocument | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize Fireproof database
  const { database: db } = useFireproof(database);

  const size = options?.size || '1024x1024';
  const [width, height] = size.split('x').map(Number);

  // Memoize options to prevent unnecessary re-renders and regeneration
  const memoizedOptions = useMemo(
    () => ({
      size: options?.size,
      quality: options?.quality,
      model: options?.model,
      style: options?.style,
    }),
    [options?.size, options?.quality, options?.model, options?.style]
  );

  // Store reference to previous options to detect changes
  const prevOptionsRef = useRef<ReturnType<typeof getRelevantOptions>>(getRelevantOptions({}));

  // Determine if we should include options in generation ID based on regeneration flag
  const shouldConsiderOptions = useMemo(() => !generationId, [generationId]);

  // Create a unique request ID for loading by ID or new generation
  // For regeneration requests, we exclude options from the hash to prevent unwanted regeneration
  const requestId = useMemo(() => {
    return hashInput(
      prompt || _id || 'unknown',
      shouldConsiderOptions ? memoizedOptions : undefined
    );
  }, [prompt, _id, shouldConsiderOptions, memoizedOptions]);

  // Track ID and generation state changes
  const previousIdRef = useRef<string | undefined>(_id);
  const previousGenerationIdRef = useRef<string | undefined>(generationId);

  // Reset state when prompt, _id, or generationId changes
  useEffect(() => {
    // Keep track of whether _id has changed
    const idChanged = _id !== previousIdRef.current;

    // Detect when generationId changes - this indicates a request for regeneration
    const generationRequested = generationId !== previousGenerationIdRef.current;

    // Update refs for next check
    previousIdRef.current = _id;
    previousGenerationIdRef.current = generationId;

    // Only proceed with state resets when needed
    if (idChanged || generationRequested) {
      // Reset all state when inputs change
      setImageData(null);
      setError(null);
      setProgress(0);

      // Clear document state when ID changes
      // This ensures a clean start when navigating to a new document
      if (idChanged) {
        setDocument(null);
      }
    }

    // Clear any existing progress timer
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    };
  }, [prompt, _id, memoizedOptions]); // Dependencies that require state reset

  // Track the last request parameters to prevent duplicate requests
  const lastRequestRef = useRef<string>('');

  // Generate the image when prompt or options change or load by ID
  useEffect(() => {
    let isMounted = true;

    // Skip processing if explicitly told to or if both prompt and _id are falsy
    if (skip || (!prompt && !_id)) {
      setLoading(false);
      if (!skip) {
        setError(new Error('Either prompt or _id must be provided'));
      }
      return;
    }

    // Create a request signature to deduplicate identical requests
    const requestSignature = JSON.stringify({
      prompt,
      _id,
      generationId,
      options: shouldConsiderOptions ? getRelevantOptions(memoizedOptions) : undefined,
    });

    // Prevent duplicate requests with identical parameters
    if (requestSignature === lastRequestRef.current && document) {
      return;
    }

    // Update the last request signature
    lastRequestRef.current = requestSignature;

    // Check if only options have changed and we have an existing document
    const currentRelevantOptions = getRelevantOptions(memoizedOptions);
    const previousRelevantOptions = prevOptionsRef.current;
    const optionsChanged =
      JSON.stringify(currentRelevantOptions) !== JSON.stringify(previousRelevantOptions);

    // When only options change and we aren't explicitly regenerating,
    // skip regeneration for existing documents to prevent duplicate generations
    if (optionsChanged && !generationId && document?._id) {
      // Update our reference without triggering regeneration
      prevOptionsRef.current = currentRelevantOptions;
      setLoading(false);
      return;
    }

    // Track current options for future comparison
    prevOptionsRef.current = currentRelevantOptions;

    setLoading(true);
    setProgress(0);
    setError(null);

    // Create a generator function with the current request ID

    const loadImageTimer = setTimeout(() => {
      if (isMounted) {
        const callImageGeneration = createImageGenerator(requestId);
        loadOrGenerateImage({
          db,
          _id,
          options,
          prompt,
          callImageGeneration,
          setLoading,
          setProgress,
          setDocument,
          document,
          progressTimerRef,
          generationId,
          setImageData,
          loading,
          isMounted,
          setError,
          editedPrompt,
        });
      }
    }, 10); // Small delay to allow React to batch updates

    return () => {
      isMounted = false;
      if (loadImageTimer) {
        clearTimeout(loadImageTimer);
      }
    };
  }, [prompt, _id, memoizedOptions, requestId, database /* reflects in db */, skip, generationId]); // Dependencies that trigger image loading/generation

  return {
    imageData,
    loading,
    progress,
    error,
    size: { width, height },
    document,
  };
}

interface LoadOrGenerateImageProps {
  readonly isMounted: boolean;
  readonly loading: boolean;
  readonly options: Omit<ImageGenOptions, 'database'>;
  readonly editedPrompt?: string;
  readonly prompt?: string;
  readonly _id?: string;
  readonly db: Database;
  readonly document: ImageDocument | null;
  readonly setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  readonly callImageGeneration: (
    promptText: string,
    genOptions?: ImageGenOptions
  ) => Promise<ImageResponse>;
  readonly setProgress: React.Dispatch<React.SetStateAction<number>>;
  readonly setDocument: React.Dispatch<React.SetStateAction<ImageDocument | null>>;
  readonly setImageData: React.Dispatch<React.SetStateAction<string | null>>;
  readonly setError: React.Dispatch<React.SetStateAction<Error | null>>;
  readonly generationId?: string;
  readonly progressTimerRef: React.RefObject<ReturnType<typeof setInterval> | null>;
}

// Main function that handles the image loading/generation process
async function loadOrGenerateImage({
  db,
  _id,
  progressTimerRef,
  callImageGeneration,
  setProgress,
  setDocument,
  setLoading,
  setImageData,
  setError,
  options,
  document,
  generationId,
  loading,
  isMounted,
  editedPrompt,
  prompt,
}: LoadOrGenerateImageProps) {
  try {
    // Start the progress animation only when loading starts
    // Set up progress timer simulation (45 seconds to completion)
    // This is just for visual feedback and doesn't reflect actual progress
    // @jchris how many conncurrent intervals should run on this,
    // you need something like ResolveOnce from cement to do it right.
    const timer = setInterval(() => {
      setProgress((prev: number) => {
        const next = prev + (100 - prev) * 0.04;
        return next > 99 ? 99 : next;
      });
    }, 1000);
    progressTimerRef.current = timer;

    let data: ImageResponse | null = null;

    // Track whether this is a case where both prompt prop and _id are provided
    // This helps us avoid the race condition where we might generate two images
    const hasBothPromptAndId = !!prompt && !!_id;

    // Log the request for debugging

    try {
      // FIXED: Always try to load the document if we have an _id, regardless of regeneration state
      // We'll use the document for info even during regeneration
      const hasDocumentId = !!_id;

      // When both prompt and _id are provided, we want the document for its files and metadata,
      // but use the provided prompt for generation to avoid a race condition
      if (hasDocumentId) {
        const existingDoc = await db.get<ImageDocument>(_id).catch((err) => {
          console.error(`[loadOrGenerateImage] Failed to load document ${_id}:`, err);
          return null;
        });

        if (existingDoc && existingDoc._files) {
          // Document exists, set it
          setDocument(existingDoc as unknown as ImageDocument);

          // Extract prompt information from the document
          const { prompts, currentPromptKey } = getPromptsFromDocument(existingDoc);

          // Determine which prompt to use - prioritize passed prompt prop over document prompt
          // If prompt prop is provided, use it instead of document's prompt
          const currentPromptText =
            prompt ||
            (currentPromptKey && prompts[currentPromptKey]?.text) ||
            (existingDoc as unknown as ImageDocument).prompt ||
            '';

          // Check if we have a document with only an original file but no output files
          // This happens when someone uploads an image but it hasn't been processed yet
          const { versions } = getVersionsFromDocument(existingDoc);
          const hasOutputFiles =
            versions.length > 0 && versions.some((v) => existingDoc._files?.[v.id]);
          const hasOnlyOriginalFile = !hasOutputFiles && existingDoc._files?.original;

          // If we have a prompt and only an original file, generate an image
          if (hasOnlyOriginalFile && currentPromptText && !generationId) {
            setLoading(true);

            // Create options that include the document for access to the original file
            const editOptions = {
              ...options,
              document: existingDoc,
              _regenerationId: Date.now(), // Ensure unique generation
            };

            // Generate a new image using the document's prompt and original file
            data = await callImageGeneration(currentPromptText, editOptions);

            if (data?.data?.[0]?.b64_json) {
              // Handle the generated image
              const filename = generateSafeFilename(currentPromptText);
              const base64Data = data.data[0].b64_json;

              // Convert base64 to File using browser APIs
              const response = await fetch(`data:image/png;base64,${base64Data}`);
              const blob = await response.blob();
              const newImageFile = new File([blob], filename, { type: 'image/png' });

              // Add as a new version to the document
              const updatedDoc = addNewVersion(existingDoc, newImageFile, currentPromptText);
              await db.put(updatedDoc);

              // Update component state
              const refreshedDoc = await db.get(_id);
              setDocument(refreshedDoc as unknown as ImageDocument);
              setImageData(data.data[0].b64_json);
              setProgress(100);
              return;
            }
          }

          // If generationId is provided, we're creating a new version
          // Only attempt if we have a document with a prompt
          // Note: currentPromptText already prioritizes the prop prompt over the document prompt
          if (generationId && currentPromptText) {
            // Create a completely unique key for the regeneration request to avoid deduplication
            const timestamp = Date.now();
            const regenerationOptions = {
              ...options,
              _regenerationId: timestamp, // Add timestamp for uniqueness
            };

            // Clear any existing request with the same prompt from the cache
            // This ensures we don't get a cached result
            const requestKey = `${currentPromptText}-${JSON.stringify(
              getRelevantOptions(options)
            )}`;

            cleanupRequestKey(requestKey);

            // Generate a new image using the document's prompt
            data = await callImageGeneration(currentPromptText, regenerationOptions);

            if (data?.data?.[0]?.b64_json) {
              // Create a File object from base64 data using browser APIs
              const filename = generateSafeFilename(currentPromptText);
              const base64Data = data.data[0].b64_json;

              // Convert base64 to File using browser APIs
              const response = await fetch(`data:image/png;base64,${base64Data}`);
              const blob = await response.blob();
              const newImageFile = new File([blob], filename, { type: 'image/png' });

              // Ensure we preserve the original document ID
              const originalDocId = _id;

              // Add the new version to the document
              const updatedDoc = {
                ...addNewVersion(existingDoc, newImageFile, currentPromptText),
                _id: originalDocId,
              };

              // Save the updated document
              await db.put(updatedDoc);

              // Get the updated document with the new version using the original ID
              const refreshedDoc = await db.get(originalDocId);
              setDocument(refreshedDoc as unknown as ImageDocument);

              // Set the image data from the new version
              const reader = new FileReader();
              reader.readAsDataURL(newImageFile);
              await new Promise<void>((resolve) => {
                reader.onloadend = () => {
                  if (typeof reader.result === 'string') {
                    setImageData(reader.result);
                  }
                  resolve();
                };
              });

              // Set progress to 100%
              setProgress(100);
              return;
            }
          }

          handleNewDoc({ existingDoc, setImageData });
        } else if (existingDoc) {
          handleExistingDoc({
            existingDoc,
            callImageGeneration,
            _id,
            db,
            options,
            loading,
            setLoading,
            setDocument,
            setImageData,
          });
        }
      } else if (prompt && !hasBothPromptAndId) {
        // No document ID provided but we have a prompt - generate a new image
        // Skip this section if we have both prompt and ID - in that case we use the document path above

        // If we have a document in memory and a generationId, we should add a version
        // to the existing document instead of creating a new one
        if (document?._id && generationId) {
          let currentPromptText = '';

          if (editedPrompt) {
            // Use the edited prompt provided from the UI
            currentPromptText = editedPrompt;
          } else {
            // Otherwise extract the prompt from the document
            const { prompts, currentPromptKey } = getPromptsFromDocument(document);
            currentPromptText =
              (currentPromptKey && prompts[currentPromptKey]?.text) ||
              document.prompt ||
              '' ||
              prompt ||
              ''; // Fall back to provided prompt if document has none, ensure string type
          }

          // Create regeneration options with unique ID to force new API call
          const regenerationOptions = {
            ...options,
            _regenerationId: Date.now(),
          } as typeof options & { _regenerationId: number };

          // Clear any cached promise for the original prompt+options
          const requestKey = `${currentPromptText}-${JSON.stringify(getRelevantOptions(options))}`;
          cleanupRequestKey(requestKey);

          // Generate a new image
          data = await callImageGeneration(currentPromptText, regenerationOptions);

          if (data?.data?.[0]?.b64_json) {
            // Create a File object from the base64 data using browser APIs
            const filename = generateSafeFilename(currentPromptText);
            const base64Data = data.data[0].b64_json;

            // Convert base64 to File using browser APIs
            const response = await fetch(`data:image/png;base64,${base64Data}`);
            const blob = await response.blob();
            const newImageFile = new File([blob], filename, { type: 'image/png' });

            // Ensure we preserve the original document ID
            const originalDocId = document._id;

            // Add the new version to the document
            const updatedDoc = {
              ...addNewVersion(document, newImageFile, currentPromptText),
              _id: originalDocId,
            };

            // Make sure the _id is preserved
            updatedDoc._id = originalDocId;

            // Save the updated document
            await db.put(updatedDoc);

            // Get the updated document with the new version
            const refreshedDoc = await db.get(originalDocId);
            setDocument(refreshedDoc as unknown as ImageDocument);

            // Set the image data from the new version
            const reader = new FileReader();
            reader.readAsDataURL(newImageFile);
            await new Promise<void>((resolve) => {
              reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                  setImageData(reader.result);
                }
                resolve();
              };
            });

            // Set progress to 100%
            setProgress(100);
            return;
          }
        } else {
          // Regular prompt-only generation (no document in memory)

          // Build generation options; if this is a regeneration request (generationId present)
          // attach a unique _regenerationId to force a fresh network call and clear cached key.
          let generationOptions = options;
          if (generationId) {
            generationOptions = {
              ...options,
              _regenerationId: Date.now(),
            } as typeof options & { _regenerationId: number };

            // Clear any cached promise for the original prompt+options so that
            // imageGen will not re-use the previous response.
            const requestKey = `${prompt}-${JSON.stringify(getRelevantOptions(options))}`;
            cleanupRequestKey(requestKey);
          }

          // Generate the image
          data = await callImageGeneration(prompt, generationOptions);
        }

        // Process the data response
        if (data?.data?.[0]?.b64_json) {
          // Create a File object from base64 data (simple approach like working text file)
          const filename = generateSafeFilename(prompt);
          const base64Data = data.data[0].b64_json;

          // Convert base64 to blob using fetch (browser handles this correctly)
          const response = await fetch(`data:image/png;base64,${base64Data}`);
          const blob = await response.blob();

          // Create File from blob (like working text file approach)
          const imageFile = new File([blob], filename, { type: 'image/png' });

          // Define a stable key for deduplication based on all relevant parameters.
          // Include _id (if present) and current time for regeneration requests
          // to ensure each regeneration gets a unique key
          // Create a unique stable key for this request that changes with generationId
          // When generationId changes, we'll generate a new image
          const regenPart = generationId ? `gen-${generationId}` : '0';
          const stableKey = [
            prompt || '',
            _id || '',
            // For generation requests, use the generationId to ensure uniqueness
            // When there's no _id but there is a prompt, we still want regeneration to work
            regenPart,
            // Stringify only relevant options to avoid spurious cache misses
            JSON.stringify(getRelevantOptions(options)),
          ].join('|');

          // Schedule cleanup of this request from the cache maps
          // to ensure future requests don't reuse this one
          setTimeout(() => {
            cleanupRequestKey(stableKey);
          });

          // Schedule cleanup of this request from the cache maps
          // to ensure future requests don't reuse this one
          setTimeout(() => {
            cleanupRequestKey(stableKey);
          }, 100); // Clear after a short delay

          try {
            // First check if there's already a document ID for this request
            const existingDocId = MODULE_STATE.createdDocuments.get(stableKey);

            if (_id) {
              try {
                // Try to get the document from the database
                // If it exists, we'll use its internal prompts for display
                const existingDoc = await db.get(_id);

                // If the document has a prompt, use it as the prompt text
                // Need to check for prompt using 'in' operator to avoid TypeScript errors
                if (
                  'prompt' in existingDoc &&
                  typeof existingDoc.prompt === 'string' &&
                  existingDoc.prompt
                ) {
                  prompt = existingDoc.prompt;
                }

                setDocument(existingDoc as unknown as ImageDocument);
              } catch {
                // Error fetching existing document, ignore silently
              }
            }

            if (existingDocId) {
              try {
                // Try to get the existing document
                const existingDoc = await db.get(existingDocId);
                setDocument(existingDoc as unknown as ImageDocument);
                setImageData(data.data[0].b64_json);
                return; // Exit early, we're using the existing document
              } catch {
                // Error fetching existing document, ignore silently
                // Will continue to document creation below
              }
            }

            // Check if there's already a document creation in progress
            let documentCreationPromise = MODULE_STATE.pendingDocumentCreations.get(stableKey);

            if (!documentCreationPromise) {
              // No document creation in progress, start a new one

              // This promise will be shared by all subscribers requesting the same document
              documentCreationPromise = (async () => {
                // Create a new document with initial version and prompt
                const imgDoc: ImageDocument = {
                  _id: '', // Will be assigned by Fireproof
                  type: 'image',
                  created: Date.now(),
                  currentVersion: 0, // 0-based indexing for versions array
                  versions: [
                    {
                      id: 'v1',
                      created: Date.now(),
                      promptKey: 'p1',
                    },
                  ],
                  prompts: {
                    p1: {
                      text: prompt,
                      created: Date.now(),
                    },
                  },
                  currentPromptKey: 'p1',
                  _files: {
                    v1: imageFile,
                  },
                };

                // Save the new document to Fireproof
                const result = await db.put(imgDoc);

                // Store the document ID in our tracking map to prevent duplicates
                MODULE_STATE.createdDocuments.set(stableKey, result.id);

                // Get the document with the file attached
                const doc = (await db.get(result.id)) as unknown as ImageDocument;

                // Log document retrieval

                return { id: result.id, doc };
              })();

              // Store the promise for other subscribers
              MODULE_STATE.pendingDocumentCreations.set(stableKey, documentCreationPromise);
            } else {
              // Reusing existing document creation promise
              // No additional action needed
            }

            try {
              // Wait for the document creation to complete
              const { doc } = await documentCreationPromise;
              setDocument(doc);
              setImageData(data.data[0].b64_json);
            } catch (e) {
              // Still show the image even if document creation fails
              setImageData(data.data[0].b64_json);
              // Clean up the failed promise so future requests can try again
              MODULE_STATE.pendingDocumentCreations.delete(stableKey);
            }
            // Empty block - all document creation logic is now handled by the Promise
          } catch (e) {
            console.error('Error saving to Fireproof:', e);
            // Even if we fail to save to Fireproof, we still have the image data
            setImageData(data.data[0].b64_json);
          } finally {
            // Clean up processing flag
            MODULE_STATE.processingRequests.delete(stableKey);

            // Clean up the document creation promise if successful
            // This prevents memory leaks while preserving the document ID in createdDocuments
            if (MODULE_STATE.createdDocuments.has(stableKey)) {
              MODULE_STATE.pendingDocumentCreations.delete(stableKey);
              MODULE_STATE.requestTimestamps.delete(stableKey);
            }
          }
        }
      } else {
        console.error('[loadOrGenerateImage] Document loading failed - requirements not met:', {
          _id,
          hasPrompt: !!prompt,
          promptLength: prompt?.length,
          generationId,
        });
        throw new Error('Document not found and no prompt provided for generation');
      }
    } catch (error) {
      // Log the error
      console.error('Error retrieving from Fireproof:', error);

      // Only try image generation as fallback for document load failures when we have a prompt
      if (prompt && !data && _id) {
        try {
          data = await callImageGeneration(prompt, options);
          if (data?.data?.[0]?.b64_json) {
            setImageData(data.data[0].b64_json);
          }
        } catch (genError) {
          console.error('Fallback generation also failed:', genError);
          throw genError;
        }
      } else {
        throw error;
      }
    } finally {
      // Always reset loading state and progress indicators
      // This ensures UI progress bars are stopped even if an error occurs
      if (isMounted) {
        setLoading(false);
        setProgress(0); // Reset progress to 0 instead of null
      }
      // Clear progress timer
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }

    // Update state with the image data
    if (isMounted && data) {
      setProgress(100);

      // Clear progress timer
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      // Log completion time
    }
  } catch (err) {
    if (isMounted) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  } finally {
    if (isMounted) {
      // Clear progress timer if it's still running
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      setLoading(false);
    }
  }
}

async function handleNewDoc({
  existingDoc,
  setImageData,
}: {
  readonly existingDoc: ImageDocument;
  readonly setImageData: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  try {
    // Select the current version's file - extract directly instead of storing in state
    // This ensures we always have the latest version info straight from the document
    const { versions, currentVersion } = getVersionsFromDocument(existingDoc);

    if (versions.length > 0) {
      // Use the current version ID to get the file
      const versionId = versions[currentVersion]?.id || versions[0]?.id;
      if (!versionId || !existingDoc._files?.[versionId]) {
        throw new Error(`Version ${versionId} not found in document files`);
      }

      const imageFile = existingDoc._files[versionId];
      let fileObj: Blob;

      // Handle different file access methods
      if ('file' in imageFile && typeof imageFile.file === 'function') {
        // DocFileMeta interface from Fireproof
        fileObj = await imageFile.file();
      } else {
        // Direct File object
        fileObj = imageFile as unknown as File;
      }

      // Read the file as base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = reader.result as string;
          // Strip the data URL prefix if present
          const base64Data = base64.split(',')[1] || base64;
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(fileObj);
      const base64Data = await base64Promise;
      setImageData(base64Data);
    } else {
      // Handle legacy files structure
      if (existingDoc._files?.image) {
        const imageFile = existingDoc._files.image;
        let fileObj: Blob;

        if ('file' in imageFile && typeof imageFile.file === 'function') {
          fileObj = await imageFile.file();
        } else {
          fileObj = imageFile as unknown as File;
        }

        // Read the file as base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = reader.result as string;
            // Strip the data URL prefix if present
            const base64Data = base64.split(',')[1] || base64;
            resolve(base64Data);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(fileObj);
        const base64Data = await base64Promise;

        setImageData(base64Data);
      }
    }
  } catch (err) {
    console.error('Error loading image file:', err);
    throw new Error(
      `Failed to load image from document: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function handleExistingDoc({
  existingDoc,
  _id,
  options,
  loading,
  setLoading,
  setDocument,
  callImageGeneration,
  db,
  setImageData,
}: {
  readonly callImageGeneration: (
    promptText: string,
    genOptions?: ImageGenOptions
  ) => Promise<ImageResponse>;
  readonly existingDoc: ImageDocument;
  readonly db: Database;
  readonly _id: string;
  readonly options: ImageGenOptions;
  readonly loading: boolean;
  readonly setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  readonly setDocument: React.Dispatch<React.SetStateAction<ImageDocument | null>>;
  readonly setImageData: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  // Document exists but has no files - check if it has a prompt field we can use
  if ('prompt' in existingDoc && typeof existingDoc.prompt === 'string' && existingDoc.prompt) {
    // Use the document's prompt to generate an image

    // Extended debug info
    if (options?.debug) {
      console.log('[ImgGen Debug] Document found with prompt but no files:', {
        docId: existingDoc._id,
        docPrompt: existingDoc.prompt,
        settingLoading: true,
        settingDocument: true,
        loadingValue: loading,
      });
    }

    const docPrompt = existingDoc.prompt;

    // Set loading state to true to show progress indicator
    setLoading(true);

    // Set the document immediately so UI knows we have a document with a prompt
    // This prevents "Waiting for prompt" message
    setDocument(existingDoc as unknown as ImageDocument);

    // Generate image using the document's prompt
    const data = await callImageGeneration(docPrompt, options);
    if (data?.data?.[0]?.b64_json) {
      setImageData(data.data[0].b64_json);

      // Create a file object from the base64 data using browser APIs
      const base64Data = data.data[0].b64_json;
      const response = await fetch(`data:image/png;base64,${base64Data}`);
      const blob = await response.blob();
      const newImageFile = new File([blob], generateSafeFilename(docPrompt), {
        type: 'image/png',
      });

      // Add the file to the document
      // Use type assertion to help TypeScript understand this is an ImageDocument
      const typedDoc = existingDoc as unknown as ImageDocument;
      const updatedDoc = addNewVersion(typedDoc, newImageFile, docPrompt);
      await db.put(updatedDoc);
      setDocument(updatedDoc);
      return; // Exit early since we've handled this case
    }
  } else {
    // Document has no files and no usable prompt
    throw new Error(`Document exists but has no files: ${_id}`);
  }
}
