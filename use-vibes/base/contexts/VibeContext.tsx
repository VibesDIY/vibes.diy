import React, { createContext, useContext, type ReactNode } from 'react';
import { VibesEnv } from '../index.js';
import { FPApiInterface } from '@fireproof/core-protocols-dashboard';

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

export interface MountVibeParams {
  readonly appSlug: string;
  readonly titleId: string;
  readonly installId: string;
  readonly env: VibesEnv;
}

export interface Vibe extends MountVibeParams {
  readonly dashApi: FPApiInterface
}

class DefVibe implements Vibe {
  notReady<R>(action: string): R {
    throw new Error(`Vibe Provider is not Ready: ${action}`)
  }

  get dashApi(): FPApiInterface {
    return this.notReady("dashApi")
  }

  get appSlug(): string { 
    return this.notReady("appSlug") 
  }

  get titleId(): string {
    return this.notReady("titleId")
  }
  get installId(): string {
    return this.notReady("installId");
  }
  get env(): VibesEnv {
    return this.notReady("env")
  }
}

const VibeContext = createContext<Vibe>(new DefVibe);



export interface VibeContextProviderProps {
  readonly mountParams: MountVibeParams;
  readonly children: ReactNode;
}

export function VibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  return <VibeContext.Provider value={mountParams}>{children}</VibeContext.Provider>;
}

export function useVibeContext(): Vibe {
  return useContext(VibeContext);
}
