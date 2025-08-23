import { ImageDocument, PartialImageDocument } from '../../hooks/image-gen/types.js';

/**
 * Utility functions for the ImgGenDisplay component
 */

// For legacy document structure
interface DocumentWithPromptMap extends ImageDocument {
  promptMap?: Record<string, string>;
}

// For legacy version structure with embedded prompt
interface VersionWithLegacyPrompt {
  id: string;
  created?: number;
  promptKey?: string;
  prompt?: string;
}

// Enhanced version info type that includes optional prompt fields for legacy support
export interface EnhancedVersionInfo {
  id: string;
  created?: number;
  promptKey?: string;
  prompt?: string;
}

interface VersionInfoResult {
  versions: EnhancedVersionInfo[];
  currentVersion: number;
}

/**
 * Get version information from document or create defaults
 */
export function getVersionInfo(document?: PartialImageDocument): VersionInfoResult {
  // Check if document has proper version structure
  if (document?.versions && document.versions.length > 0) {
    // Convert to enhanced version info with possible prompt fields
    // Define type for document version entries to avoid using 'any'
    const enhancedVersions: EnhancedVersionInfo[] = document.versions.map(
      (v: { id: string; created?: number; promptKey?: string }) => {
        // Check if this version has a direct prompt property (legacy format)
        // Use our typed interface for legacy format
        const versionWithPrompt = v as VersionWithLegacyPrompt;
        const prompt = versionWithPrompt.prompt || undefined;

        return {
          ...v,
          prompt,
        };
      }
    );

    return {
      versions: enhancedVersions,
      // Use currentVersion directly (now 0-based) or default to last version
      currentVersion:
        typeof document.currentVersion === 'number'
          ? document.currentVersion
          : document.versions.length - 1,
    };
  }

  // Legacy document with just an 'image' file - treat as single version
  if (document?._files && document._files.image) {
    return {
      versions: [{ id: 'image', created: document.created || Date.now() }],
      currentVersion: 0, // Now 0-based
    };
  }

  // No versions found
  return { versions: [], currentVersion: 0 };
}

/**
 * Get prompt information from the document
 * @param document The image document
 * @param versionIndex Optional index of the version to get prompt for
 */
export function getPromptInfo(document?: PartialImageDocument, versionIndex?: number) {
  try {
    // If versionIndex is provided, try to get the version-specific prompt
    if (typeof versionIndex === 'number') {
      const { versions } = getVersionInfo(document);

      // Make sure we have valid data
      if (
        versions &&
        Array.isArray(versions) &&
        versionIndex >= 0 &&
        versionIndex < versions.length
      ) {
        const version = versions[versionIndex];

        // APPROACH 1: Check if this version has a promptKey defined
        const promptKey = version.promptKey || 'p1';

        // First check if we have prompts and this version's promptKey
        if (document?.prompts && promptKey && document.prompts[promptKey]) {
          return {
            currentPrompt: document.prompts[promptKey].text || '',
            prompts: document.prompts,
            currentPromptKey: promptKey,
          };
        }

        // APPROACH 2: Check for version.prompt in EnhancedVersionInfo
        if (version.prompt) {
          return {
            currentPrompt: version.prompt,
            prompts: { ...(document?.prompts || {}), legacy: { text: version.prompt } },
            currentPromptKey: 'legacy',
          };
        }

        // APPROACH 3: Check for promptMap in the document (legacy format)
        // Use our typed interface for legacy format
        const docWithPromptMap = document as DocumentWithPromptMap;
        if (docWithPromptMap.promptMap && version.id && docWithPromptMap.promptMap[version.id]) {
          const legacyPrompt = docWithPromptMap.promptMap[version.id];
          return {
            currentPrompt: legacyPrompt,
            prompts: { legacy: { text: legacyPrompt } },
            currentPromptKey: 'legacy',
          };
        }
      }
    }
  } catch (e) {
    console.error('Error getting version-specific prompt:', e);
  }

  // If we don't have a specific version prompt or there was an error, fall back to default behavior

  // If we have the new prompts structure
  if (document?.prompts && document.currentPromptKey) {
    return {
      currentPrompt: document.prompts[document.currentPromptKey]?.text || '',
      prompts: document.prompts,
      currentPromptKey: document.currentPromptKey,
    };
  }

  // Legacy document with just a prompt field
  if (document?.prompt) {
    return {
      currentPrompt: document.prompt,
      prompts: { p1: { text: document.prompt, created: document.created || Date.now() } },
      currentPromptKey: 'p1',
    };
  }

  // No prompt found
  return { currentPrompt: '', prompts: {}, currentPromptKey: '' };
}

/**
 * Get the current version file key
 */
export function getCurrentFileKey(
  document: PartialImageDocument | null | undefined,
  versionIndex: number,
  versions: EnhancedVersionInfo[]
) {
  if (!versions || versions.length === 0) return null;

  // If we have versions, use the ID from the current version index
  if (versions.length > versionIndex) {
    const versionId = versions[versionIndex].id;
    if (document?._files && document._files[versionId]) {
      return versionId;
    }
  }

  // Fallback to 'image' for legacy docs
  if (document?._files && document._files.image) {
    return 'image';
  }

  return null;
}
