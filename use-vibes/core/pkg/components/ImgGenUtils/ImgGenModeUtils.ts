import type { PartialImageDocument } from '../../hooks/image-gen/types.js';

/**
 * Possible display modes for the ImgGen component
 */
export type ImgGenMode =
  | 'placeholder' // Initial state, no document or prompt
  | 'uploadWaiting' // Has document with uploaded files, but no prompt yet
  | 'generating' // Has prompt, is generating the image
  | 'display' // Has finished generating, displaying the result
  | 'error'; // Error state

/**
 * Pure function to determine the current mode of the ImgGen component
 * based on available document data and component state
 */
export function getImgGenMode({
  document,
  prompt,
  loading,
  error,
  debug,
}: {
  document?: PartialImageDocument | null;
  prompt?: string;
  loading: boolean;
  error?: Error;
  debug?: boolean;
}): ImgGenMode {
  if (error) {
    if (debug) console.log('[ImgGenModeUtils] Error present - error mode');
    return 'error';
  }

  // Special case: When we have a prompt and loading, always show generating
  // This helps during initial generation before document is created
  if (loading && prompt) {
    if (debug) console.log('[ImgGenModeUtils] Prompt + loading → generating');
    return 'generating';
  }

  // Check if we have versions (generated images)
  const hasVersions = !!document?.versions?.length;

  // Check if document has input files (uploaded images waiting for prompt)
  const hasInputFiles =
    document?._files && Object.keys(document._files).some((key) => key.startsWith('in'));

  // Check if document exists but has no input files or versions
  // This usually means it's a brand new document or an error case
  const hasEmptyDoc =
    !!document && (!document._files || Object.keys(document._files).length === 0) && !hasVersions;

  if (debug) {
    console.log('[ImgGenModeUtils] Determining mode:', {
      prompt: !!prompt,
      hasVersions,
      hasInputFiles,
      hasEmptyDoc,
      loading,
    });
  }

  // Case 1: Total blank slate - no prompt, no document
  if (!document) {
    if (debug) console.log('[ImgGenModeUtils] No document - placeholder mode');
    return 'placeholder';
  }

  // Case 2: Has input files but no prompt yet - stay in upload waiting mode
  if (hasInputFiles && !prompt && !hasVersions) {
    if (debug) console.log('[ImgGenModeUtils] Has input files but no prompt - uploadWaiting mode');
    return 'uploadWaiting';
  }

  // Case 3: Has prompt but no versions yet (or is currently loading) - generating mode
  if ((prompt || loading) && !hasVersions) {
    if (debug) console.log('[ImgGenModeUtils] Has prompt but no versions - generating mode');
    return 'generating';
  }

  // Case 4: Has versions - display mode
  if (hasVersions) {
    if (debug) console.log('[ImgGenModeUtils] Has versions - display mode');
    return 'display';
  }

  // Fallback - if we have an empty document or other invalid state, go back to placeholder
  if (debug) console.log('[ImgGenModeUtils] Fallback - placeholder mode');
  return 'placeholder';
}
