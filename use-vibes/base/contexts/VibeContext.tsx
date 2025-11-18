import React, { createContext, useContext, type ReactNode } from 'react';

export interface VibeMetadata {
  titleId: string;
  installId: string;
}

/**
 * Error codes for VibeMetadata validation failures.
 */
export const VIBE_METADATA_ERROR_CODES = {
  TITLEID_EMPTY: 'TITLEID_EMPTY',
  INSTALLID_EMPTY: 'INSTALLID_EMPTY',
  TITLEID_INVALID_CHARS: 'TITLEID_INVALID_CHARS',
  INSTALLID_INVALID_CHARS: 'INSTALLID_INVALID_CHARS',
} as const;

/**
 * Custom error class for VibeMetadata validation failures.
 * Includes error codes for programmatic detection.
 */
export class VibeMetadataValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'VibeMetadataValidationError';
    this.code = code;
  }
}

/**
 * Validates that VibeMetadata contains non-empty titleId and installId with valid characters.
 * Enforces alphanumeric characters and hyphens only to prevent heavy mangling during
 * ledger name generation.
 *
 * @param metadata - The VibeMetadata object to validate
 * @throws {VibeMetadataValidationError} If titleId or installId are missing, empty, or contain invalid characters
 */
export function validateVibeMetadata(metadata: VibeMetadata): void {
  // Non-empty checks
  if (!metadata.titleId || !metadata.titleId.trim()) {
    throw new VibeMetadataValidationError(
      'VibeMetadata.titleId must be a non-empty string',
      VIBE_METADATA_ERROR_CODES.TITLEID_EMPTY
    );
  }
  if (!metadata.installId || !metadata.installId.trim()) {
    throw new VibeMetadataValidationError(
      'VibeMetadata.installId must be a non-empty string',
      VIBE_METADATA_ERROR_CODES.INSTALLID_EMPTY
    );
  }

  // Character set validation to prevent heavy mangling during ledger name generation
  const validPattern = /^[a-z0-9-]+$/i;
  if (!validPattern.test(metadata.titleId)) {
    throw new VibeMetadataValidationError(
      'VibeMetadata.titleId must contain only alphanumeric characters and hyphens',
      VIBE_METADATA_ERROR_CODES.TITLEID_INVALID_CHARS
    );
  }
  if (!validPattern.test(metadata.installId)) {
    throw new VibeMetadataValidationError(
      'VibeMetadata.installId must contain only alphanumeric characters and hyphens',
      VIBE_METADATA_ERROR_CODES.INSTALLID_INVALID_CHARS
    );
  }
}

const VibeContext = createContext<VibeMetadata | null>(null);

export interface VibeContextProviderProps {
  readonly metadata: VibeMetadata;
  readonly children: ReactNode;
}

export function VibeContextProvider({ metadata, children }: VibeContextProviderProps) {
  return <VibeContext.Provider value={metadata}>{children}</VibeContext.Provider>;
}

export function useVibeContext(): VibeMetadata | null {
  return useContext(VibeContext);
}
