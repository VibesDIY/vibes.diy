import * as React from 'react';
import { v4 as uuid } from 'uuid';
import type { ImageGenOptions } from 'call-ai';
import { useImageGen as defaultUseImageGen } from '../hooks/image-gen/use-image-gen.js';
import { useFireproof, Database } from 'use-fireproof';
import type {
  ImageDocument,
  UseImageGenOptions,
  UseImageGenResult,
} from '../hooks/image-gen/types.js';
import {
  ImgGenPromptWaiting,
  ImgGenDisplayPlaceholder,
  ImgGenDisplay,
  ImgGenError,
} from './ImgGenUtils.js';
// Import from direct file since the main index.ts might not be updated yet
import { ImgGenUploadWaiting } from './ImgGenUtils/ImgGenUploadWaiting.js';
import { getImgGenMode } from './ImgGenUtils/ImgGenModeUtils.js';
import { ImgGenClasses, defaultClasses } from '../utils/style-utils.js';
import { logDebug } from '../utils/debug.js';
import './ImgGen.css';

export interface ImgGenProps {
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
  readonly options: ImageGenOptions;

  /** Database name or instance to use for storing images */
  readonly database: string | Database;

  readonly useImageGen: (options: Partial<UseImageGenOptions>) => UseImageGenResult;

  /** Callback when image load completes successfully */
  readonly onComplete: () => void;

  /** Callback when image load fails */
  readonly onError: (error: Error) => void;

  /** Callback when document is deleted */
  readonly onDelete: (id: string) => void;

  /** Callback when prompt is edited */
  readonly onPromptEdit: (id: string, newPrompt: string) => void;

  /** Custom CSS classes for styling component parts */
  readonly classes: ImgGenClasses;

  /** Callback when a new document is created via drop or file picker */
  readonly onDocumentCreated: (docId: string) => void;

  /** Enable debug logging */
  readonly debug: boolean;
}

/**
 * Core implementation of ImgGen component
 * This is the component that gets remounted when the document ID or prompt changes
 */
function ImgGenCore(props: Partial<ImgGenProps>): React.ReactElement {
  // Destructure the props for cleaner code
  const {
    prompt,
    _id,
    className,
    alt,
    images,
    options,
    database,
    onComplete,
    onError,
    onDelete,
    onPromptEdit,
    onDocumentCreated,
    classes = defaultClasses,
    debug,
    useImageGen,
  } = props;

  // Get access to the Fireproof database directly
  const { database: db } = useFireproof(database || 'ImgGen');

  // Use a unique generationId to trigger regeneration
  // This provides a clearer signal when regeneration is needed
  const [generationId, setGenerationId] = React.useState<string | undefined>(undefined);

  // Track the edited prompt to pass to the image generator and show in UI
  const [currentEditedPrompt, setCurrentEditedPrompt] = React.useState<string | undefined>(
    undefined
  );

  // Track the document for image generation - use ImageDocument type or Record
  const [imageGenDocument, setImageGenDocument] = React.useState<ImageDocument | null>(null);

  // Merge options with images into a single options object for the hook
  const mergedOptions = React.useMemo(
    () => (images ? { ...options, images } : options),
    [options, images]
  );

  // Determine the effective prompt to use - either from form submission or props
  const effectivePrompt = currentEditedPrompt || prompt || '';

  // Check if we should skip image generation based on whether we have prompt or id
  // Use effectivePrompt instead of just props.prompt
  const shouldSkipGeneration = !effectivePrompt && !_id;

  // Use the custom hook for all the image generation logic
  const { imageData, loading, error, progress, document } = (useImageGen || defaultUseImageGen)({
    // Use the effective prompt that prioritizes form submission
    prompt: effectivePrompt,
    _id: _id,
    options: {
      ...mergedOptions,
      // Include the document with uploaded files for image generation
      ...(imageGenDocument ? { document: imageGenDocument } : {}),
    },
    database,
    // Use the generationId to signal when we want a new image
    generationId,
    // We no longer need editedPrompt since we're using effectivePrompt as the main prompt
    // Skip processing if neither prompt nor _id is provided
    skip: shouldSkipGeneration,
  });

  // Determine the current display mode based on document state
  const mode = React.useMemo(() => {
    return getImgGenMode({
      document,
      prompt: effectivePrompt, // Use effectivePrompt instead of just props.prompt
      loading,
      error: error || undefined,
      debug,
    });
  }, [document, effectivePrompt, loading, error, debug]); // Update dependency array

  if (debug) {
    logDebug('[ImgGenCore] Current mode:', mode, {
      document: !!document,
      documentId: document?._id,
      prompt: !!prompt,
      loading,
      error: !!error,
    });
  }

  // When document is generated, use its ID for subsequent operations
  // This is done through the parent component's remounting logic with uuid()
  React.useEffect(() => {
    if (onComplete && imageData && !loading && !error) {
      onComplete();
    }
  }, [onComplete, imageData, loading, error]);

  // Handle errors from the image generation hook
  React.useEffect(() => {
    if (onError && error) {
      onError(error);
    }
  }, [onError, error]);

  // Handle regeneration
  const handleRegen = React.useCallback(() => {
    if (document?._id || _id || prompt) {
      // Create a new unique ID to trigger regeneration
      const newGenId = crypto.randomUUID();
      setGenerationId(newGenId);
    }
  }, [document, _id, prompt]);

  // Handle prompt editing
  const handlePromptEdit = React.useCallback(
    async (id: string, newPrompt: string) => {
      // Update the tracked edited prompt
      setCurrentEditedPrompt(newPrompt);

      try {
        // First, update the document in the database with the new prompt
        const doc = await db.get(id);
        if (!doc) {
          logDebug('Document not found:', id);
          return;
        }

        // Update prompt structure based on existing document pattern
        // Support both 'prompt' field (legacy) and new structured 'prompts' pattern
        const updatedDoc: Record<string, unknown> = { ...doc };

        if (updatedDoc.prompts) {
          // Handle new structured prompts with versioning
          const promptKey = `p${Date.now()}`;
          updatedDoc.prompts = {
            ...updatedDoc.prompts,
            [promptKey]: { text: newPrompt },
          };
          updatedDoc.currentPromptKey = promptKey;
        } else {
          // Handle simple legacy prompt field
          updatedDoc.prompt = newPrompt;
        }

        // Save the updated document
        await db.put(updatedDoc);

        // Notify parent component
        if (onPromptEdit) {
          onPromptEdit(id, newPrompt);
        }

        // Store the document to be used for generation
        // This ensures that when the regeneration happens, we have access to the document with uploaded images
        const refreshedDoc = await db.get<ImageDocument>(id);

        // Set the document in options before triggering regeneration
        if (refreshedDoc) {
          // Set a local state variable for the document to be used during regeneration
          setImageGenDocument(refreshedDoc);

          if (debug) {
            logDebug(
              '[ImgGen] Setting document for image generation:',
              refreshedDoc._id,
              'with files:',
              Object.keys(refreshedDoc._files || {}).filter((key) => key.startsWith('in'))
            );
          }
        }

        // Now trigger regeneration with the updated prompt
        handleRegen();
      } catch (error) {
        logDebug('Error updating prompt:', error);
      }
    },
    [db, handleRegen, onPromptEdit]
  );

  // Handle document deletion
  const handleDelete = React.useCallback(
    async (id: string) => {
      logDebug('[ImgGen] Attempting to delete document:', id);
      try {
        // Use await to ensure the operation completes
        const result = await db.del(id);

        if (debug) {
          logDebug('[ImgGen] Document deletion result:', result);
        }

        // Notify parent component about deletion
        if (onDelete) {
          if (debug) {
            logDebug('[ImgGen] Calling onDelete callback with id:', id);
          }
          onDelete(id);
        }
      } catch (error) {
        logDebug('Error deleting document:', error);
      }
    },
    [db, onDelete, debug]
  );

  // Handle document creation from file uploads
  const handleDocCreated = React.useCallback(
    (docId: string) => {
      if (debug) {
        logDebug('[ImgGenCore] Document created:', docId);
      }

      // Call user's callback if provided
      if (onDocumentCreated) {
        onDocumentCreated(docId);
      }
    },
    [onDocumentCreated, debug]
  );

  // Render function that determines what to show based on current mode
  function renderContent() {
    if (debug) {
      logDebug('[ImgGen Debug] Render state:', {
        mode,
        document: document?._id,
        loading,
        error: error?.message,
        currentEditedPrompt: currentEditedPrompt || null,
        imageData: !!imageData,
      });
    }

    // Render different components based on the current mode
    switch (mode) {
      case 'placeholder': {
        // Initial state - no document, no prompt
        // Use the same ImgGenUploadWaiting component that's used in uploadWaiting mode
        // but without a document (this creates a consistent UI for both entry points)
        return (
          <ImgGenUploadWaiting
            className={className}
            classes={classes}
            debug={debug}
            database={database}
            onDocumentCreated={handleDocCreated}
            onPromptSubmit={(newPrompt: string) => {
              // When a user enters a prompt directly in the initial state
              if (debug) {
                logDebug('[ImgGenCore] Prompt submitted from initial view:', newPrompt);
              }

              // Update the edited prompt and generate a new generationId to trigger generation
              setCurrentEditedPrompt(newPrompt);
              setGenerationId(uuid());
            }}
          />
        );
      }

      case 'uploadWaiting': {
        // We have a document with uploaded files, waiting for prompt input
        if (!document || !document._id) {
          // This shouldn't happen - go back to placeholder if no document
          return <ImgGenPromptWaiting className={className} classes={classes} />;
        }

        // If loading has started, switch to generating view to show progress
        if (loading) {
          const displayPrompt = currentEditedPrompt || prompt;
          return (
            <ImgGenDisplayPlaceholder
              prompt={displayPrompt || ''}
              loading={loading}
              progress={progress}
              error={error}
              className={className}
              classes={classes}
            />
          );
        }

        return (
          <>
            <ImgGenUploadWaiting
              document={document}
              className={className}
              classes={classes}
              debug={debug}
              database={database}
              onFilesAdded={() => {
                // Just log if new files were added to the same document
                if (debug) {
                  logDebug('[ImgGenCore] Files added to existing document:', document._id);
                }
              }}
              onPromptSubmit={(newPrompt: string, docId?: string) => {
                // Use the docId that's passed from the component if available,
                // otherwise fall back to the current document._id
                const targetDocId = docId || (document && document._id);

                if (debug) {
                  logDebug('[ImgGenCore] Prompt submitted for existing uploads:', newPrompt);
                  logDebug('[ImgGenCore] Using document ID:', targetDocId);
                }

                if (targetDocId) {
                  // Use the document ID to ensure we're using the correct document with the uploaded images
                  handlePromptEdit(targetDocId, newPrompt);
                }
              }}
            />
          </>
        );
      }

      case 'generating': {
        // Document with prompt, waiting for generation to complete
        // Use the edited prompt during generation if available, or fall back to document prompt
        // Look in three places: 1) edited prompt 2) direct prop 3) document's prompt
        let displayPrompt = currentEditedPrompt || prompt;

        // If we still don't have a prompt but have a document with a prompt, use that
        if (
          !displayPrompt &&
          document &&
          'prompt' in document &&
          typeof document.prompt === 'string'
        ) {
          displayPrompt = document.prompt;
        }

        if (debug) {
          logDebug('[ImgGen Debug] Generating state prompt sources:', {
            currentEditedPrompt: currentEditedPrompt || null,
            propPrompt: prompt || null,
            documentPrompt: document?.prompt || null,
            finalDisplayPrompt: displayPrompt || null,
          });
        }

        return (
          <ImgGenDisplayPlaceholder
            prompt={displayPrompt || ''}
            loading={loading}
            progress={progress}
            error={error}
            className={className}
            classes={classes}
          />
        );
      }

      case 'display': {
        // Document with generated images
        if (!document || !document._id) {
          return <ImgGenError message="Missing document" />;
        }

        return (
          <>
            <ImgGenDisplay
              document={document as ImageDocument & { _id: string }}
              loading={loading}
              progress={progress}
              onPromptEdit={handlePromptEdit}
              onDelete={handleDelete}
              onRegen={handleRegen}
              alt={alt || ''}
              className={className}
              classes={classes}
              debug={debug}
              error={error}
            />

            {/* ImgGenDisplay handles the progress bar internally */}
          </>
        );
      }

      case 'error': {
        // Error state
        return (
          <ImgGenError message={error ? error.message : 'Unknown error'} className={className} />
        );
      }

      default: {
        // Fallback for any unexpected state
        return <ImgGenError message="Unknown state" />;
      }
    }
  }

  // Always render through the render function - no conditional returns in the main component body
  return renderContent();
}

/**
 * Main component for generating images with call-ai's imageGen
 * Provides automatic caching, reactive updates, and placeholder handling
 * Uses a mountKey to ensure clean state when switching documents
 */
export function ImgGen(props: Partial<ImgGenProps>): React.ReactElement {
  // Destructure key props for identity-change tracking
  // classes prop is used via the props spread to ImgGenCore
  const { _id, prompt, debug, onDocumentCreated } = props;

  // Generate a unique mountKey for this instance
  const [mountKey, setMountKey] = React.useState(() => uuid());

  // Track document creation from uploads for remounting
  const [uploadedDocId, setUploadedDocId] = React.useState<string | undefined>(undefined);

  // Handle document creation callback - combines user callback with internal state
  const handleDocCreated = React.useCallback(
    (docId: string) => {
      if (debug) logDebug('[ImgGen] Document created:', docId);

      // Update internal state to trigger remount
      setUploadedDocId(docId);

      // Call user's callback if provided
      if (onDocumentCreated) {
        if (debug) logDebug('[ImgGen] Calling onDocumentCreated callback');
        onDocumentCreated(docId);
      }
    },
    [debug, onDocumentCreated]
  );

  // Track previous props/state to detect identity changes
  const prevIdRef = React.useRef<string | undefined>(_id);
  const prevPromptRef = React.useRef<string | undefined>(prompt);
  const prevUploadedDocIdRef = React.useRef<string | undefined>(uploadedDocId);

  // Update mountKey when document identity changes
  React.useEffect(() => {
    const idChanged = _id !== prevIdRef.current;
    const promptChanged = prompt && prompt !== prevPromptRef.current;
    const uploadedDocIdChanged = uploadedDocId !== prevUploadedDocIdRef.current;

    // Reset mountKey if we switched documents, or if we're showing a new prompt
    // with no document ID (which means a brand new generation),
    // or if we got a new document ID from uploads
    if (idChanged || (!_id && promptChanged) || uploadedDocIdChanged) {
      if (debug) {
        logDebug('[ImgGen] Identity change detected, generating new mountKey:', {
          idChanged,
          _id,
          prevId: prevIdRef.current,
          promptChanged: !_id && promptChanged,
          prompt,
          prevPrompt: prevPromptRef.current,
          uploadedDocIdChanged,
          uploadedDocId,
          prevUploadedDocId: prevUploadedDocIdRef.current,
        });
      }
      setMountKey(uuid()); // Force a remount of ImgGenCore
    }

    // Update refs for next comparison
    prevIdRef.current = _id;
    prevPromptRef.current = prompt;
    prevUploadedDocIdRef.current = uploadedDocId;
  }, [_id, prompt, uploadedDocId, debug]);

  // Create a merged props object with the document creation handler
  const coreProps = {
    ...props,
    onDocumentCreated: handleDocCreated,
  };

  // Handle different cases for document identity
  if (uploadedDocId && !_id) {
    // Always pass the uploadedDocId to ImgGenCore so it can access the document
    // This ensures the document with uploaded files is accessible
    coreProps._id = uploadedDocId;
  }

  // Render the core component with a key to force remount when identity changes
  return <ImgGenCore {...coreProps} key={mountKey} />;
}

// Simple export - no memoization or complex structure
export default ImgGen;
