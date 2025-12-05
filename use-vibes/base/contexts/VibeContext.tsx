import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { z } from 'zod';
import type { Clerk } from '@clerk/clerk-js';
import { useClerk, useSession } from '@clerk/clerk-react';
import { clerkDashApi, type DashboardApiImpl } from '@fireproof/core-protocols-dashboard';

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

const VibeContext = createContext<VibeMetadata | undefined>(undefined);

export interface VibeContextProviderProps {
  readonly metadata: VibeMetadata;
  readonly children: ReactNode;
}

export function VibeContextProvider({ metadata, children }: VibeContextProviderProps) {
  return <VibeContext.Provider value={metadata}>{children}</VibeContext.Provider>;
}

export function useVibeContext(): VibeMetadata | undefined {
  return useContext(VibeContext);
}

// DashboardApi Context for Clerk integration
const DashboardApiContext = createContext<DashboardApiImpl<unknown> | null>(null);

export function useDashboardApi() {
  return useContext(DashboardApiContext);
}

/**
 * VibeClerkIntegration - Provider component that sets up Clerk + DashboardApi
 * Wraps children and provides dashApi instance via context
 * When dashApi is present, useFireproof will automatically enable cloud sync
 */
export function VibeClerkIntegration({ children }: { children: ReactNode }) {
  const { session, isLoaded } = useSession();
  const clerk = useClerk();
  const [dashApi, setDashApi] = useState<DashboardApiImpl<unknown> | null>(null);

  useEffect(() => {
    // Wait for Clerk to be fully loaded before creating dashApi
    if (isLoaded && session && clerk) {
      const apiUrl = 'https://connect.fireproof.direct/fp/cloud/api';
      const api = clerkDashApi(clerk as unknown as Clerk, { apiUrl });
      setDashApi(api);
    }
  }, [isLoaded, session, clerk]);

  return <DashboardApiContext.Provider value={dashApi}>{children}</DashboardApiContext.Provider>;
}
