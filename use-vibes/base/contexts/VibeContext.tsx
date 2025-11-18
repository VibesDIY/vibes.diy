import React, { createContext, useContext, type ReactNode } from 'react';

export interface VibeMetadata {
  titleId: string;
  installId: string;
}

/**
 * Validates that VibeMetadata contains non-empty titleId and installId.
 * Throws an error if validation fails.
 *
 * @param metadata - The VibeMetadata object to validate
 * @throws {Error} If titleId or installId are missing or empty
 */
export function validateVibeMetadata(metadata: VibeMetadata): void {
  if (!metadata.titleId || !metadata.titleId.trim()) {
    throw new Error('VibeMetadata.titleId must be a non-empty string');
  }
  if (!metadata.installId || !metadata.installId.trim()) {
    throw new Error('VibeMetadata.installId must be a non-empty string');
  }
}

const VibeContext = createContext<VibeMetadata | null>(null);

export interface VibeContextProviderProps {
  metadata: VibeMetadata;
  children: ReactNode;
}

export function VibeContextProvider({ metadata, children }: VibeContextProviderProps) {
  return <VibeContext.Provider value={metadata}>{children}</VibeContext.Provider>;
}

export function useVibeContext(): VibeMetadata | null {
  return useContext(VibeContext);
}
