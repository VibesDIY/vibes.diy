import React, { createContext, useContext, type ReactNode } from 'react';

export interface VibeMetadata {
  titleId: string;
  installId: string;
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
