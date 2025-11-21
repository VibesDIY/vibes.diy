import React, { createContext, useContext, type ReactNode } from 'react';
import { z } from 'zod';

/**
 * Error codes for VibeMetadata validation failures.
 * Preserved for backward compatibility.
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
 * Zod schema for VibeMetadata validation.
 * Enforces alphanumeric characters and hyphens only to prevent heavy mangling
 * during ledger name generation.
 */
const VibeMetadataSchema = z.object({
  titleId: z
    .string()
    .trim()
    .min(1, 'VibeMetadata.titleId must be a non-empty string')
    .regex(
      /^[a-z0-9-]+$/i,
      'VibeMetadata.titleId must contain only alphanumeric characters and hyphens'
    ),
  installId: z
    .string()
    .trim()
    .min(1, 'VibeMetadata.installId must be a non-empty string')
    .regex(
      /^[a-z0-9-]+$/i,
      'VibeMetadata.installId must contain only alphanumeric characters and hyphens'
    ),
});

/**
 * Type inference from Zod schema
 */
export type VibeMetadata = z.infer<typeof VibeMetadataSchema>;

/**
 * Validates that VibeMetadata contains non-empty titleId and installId with valid characters.
 * Uses Zod for validation but preserves backward-compatible error codes.
 *
 * @param metadata - The VibeMetadata object to validate
 * @throws {VibeMetadataValidationError} If titleId or installId are missing, empty, or contain invalid characters
 */
export function validateVibeMetadata(metadata: unknown): asserts metadata is VibeMetadata {
  try {
    VibeMetadataSchema.parse(metadata);
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Map Zod errors to our custom error codes for backward compatibility
      const firstIssue = error.issues[0];
      let code: string;
      const message: string = firstIssue.message;

      if (firstIssue.path[0] === 'titleId') {
        code =
          firstIssue.code === 'too_small'
            ? VIBE_METADATA_ERROR_CODES.TITLEID_EMPTY
            : VIBE_METADATA_ERROR_CODES.TITLEID_INVALID_CHARS;
      } else if (firstIssue.path[0] === 'installId') {
        code =
          firstIssue.code === 'too_small'
            ? VIBE_METADATA_ERROR_CODES.INSTALLID_EMPTY
            : VIBE_METADATA_ERROR_CODES.INSTALLID_INVALID_CHARS;
      } else {
        code = 'UNKNOWN_ERROR';
      }

      throw new VibeMetadataValidationError(message, code);
    }
    throw error;
  }
}

export interface VibeContextValue {
  readonly metadata?: VibeMetadata;
  readonly syncEnabled?: boolean;
}

const VibeContext = createContext<VibeContextValue | undefined>(undefined);

export interface VibeContextProviderProps {
  readonly metadata: VibeMetadata;
  readonly syncEnabled?: boolean;
  readonly children: ReactNode;
}

export function VibeContextProvider({ metadata, syncEnabled, children }: VibeContextProviderProps) {
  const value: VibeContextValue = { metadata, syncEnabled };
  return <VibeContext.Provider value={value}>{children}</VibeContext.Provider>;
}

export function useVibeContext(): VibeContextValue | undefined {
  return useContext(VibeContext);
}

/**
 * Hook to get VibeMetadata only (for backward compatibility)
 */
export function useVibeMetadata(): VibeMetadata | undefined {
  return useContext(VibeContext)?.metadata;
}
