import React, { createContext, useContext, type ReactNode } from "react";
import { type } from "arktype";
import { injectDefaultVibesCtx, VibeBindings, VibesDiyMountParams, VibesEnv } from "../index.js";
import { clerkDashApi, DashboardApiImpl } from "@vibes.diy/identity";
import { ClerkProvider, useClerk } from "@clerk/react";
import { TokenStrategie } from "@fireproof/core-types-protocols-cloud";
import { Database } from "@fireproof/use-fireproof";
import { OnFunc, OnFuncReturn, ReturnOnFunc } from "@adviser/cement";

type ClerkDashApiClerk = Parameters<typeof clerkDashApi>[0];

/**
 * Error codes for VibeMetadata validation failures.
 * Preserved for backward compatibility.
 */
export const VIBE_METADATA_ERROR_CODES = {
  TITLEID_EMPTY: "TITLEID_EMPTY",
  INSTALLID_EMPTY: "INSTALLID_EMPTY",
  TITLEID_INVALID_CHARS: "TITLEID_INVALID_CHARS",
  INSTALLID_INVALID_CHARS: "INSTALLID_INVALID_CHARS",
} as const;

/**
 * Custom error class for VibeMetadata validation failures.
 * Includes error codes for programmatic detection.
 */
export class VibeMetadataValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "VibeMetadataValidationError";
    this.code = code;
  }
}

export interface Vibe extends VibesDiyMountParams {
  // readonly dashApi: DashboardApiImpl<unknown>;
  readonly clerk: ReturnType<typeof useClerk>;
  sessionReady(): boolean;
  // fpCloudStrategie(): TokenStrategie;
  onDatabaseOpen: ReturnOnFunc<[_db: Database], unknown>;
}

class DefVibe implements Vibe {
  get bindings(): VibeBindings {
    throw new Error(`Vibe Provider is not Ready: bindings`);
  }
  #notReady<R>(action: string): R {
    throw new Error(`Vibe Provider is not Ready: ${action}`);
  }

  fpCloudStrategie(): TokenStrategie {
    return this.#notReady("fpCloudStrategie");
  }

  onDatabaseOpen = ((_fn: (...a: Database[]) => OnFuncReturn): (() => unknown) => {
    return this.#notReady("onDatabaseOpen");
  }) as ReturnOnFunc<[_db: Database], unknown>;
  //   return this.#notReady("onDatabaseOpen")
  // } as unknown as ReturnOnFunc<[_db: Database], unknown>

  sessionReady(): boolean {
    return this.#notReady("sessionReady");
  }

  get clerk(): Vibe["clerk"] {
    return this.#notReady("clerk");
  }

  get dashApi(): DashboardApiImpl<unknown> {
    return this.#notReady("dashApi");
  }

  get appSlug(): string {
    return this.#notReady("appSlug");
  }

  get titleId(): string {
    return this.#notReady("titleId");
  }
  get installId(): string {
    return this.#notReady("installId");
  }
  get env(): VibesEnv {
    return this.#notReady("env");
  }
}

const VibeContext = createContext<Vibe>(new DefVibe());

export interface VibeContextProviderProps {
  readonly mountParams: VibesDiyMountParams;
  readonly children: ReactNode;
}

function LiveCycleVibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  const clerk = useClerk();
  const dashApi = clerkDashApi(clerk as unknown as ClerkDashApiClerk, {
    apiUrl: mountParams.env.DASHBOARD_URL,
  });

  const onDatabaseOpen = OnFunc<(_db: Database) => unknown>();
  const ctx = {
    dashApi,
    clerk,
    onDatabaseOpen,
    sessionReady: () => {
      return clerk.session?.status === "active";
    },
    ...mountParams,
  };
  injectDefaultVibesCtx(ctx);
  return <VibeContext.Provider value={ctx}>{children}</VibeContext.Provider>;
}

export function VibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  // const dashApi = clerkDashApi(clerk, { apiUrl: mountParams.env.DASHBOARD_URL })
  return (
    <ClerkProvider publishableKey={mountParams.env.CLERK_PUBLISHABLE_KEY}>
      <LiveCycleVibeContextProvider mountParams={mountParams}>{children}</LiveCycleVibeContextProvider>
    </ClerkProvider>
  );
}

export function useVibeContext(): Vibe {
  return useContext(VibeContext);
}

/**
 * ArkType schema for VibeMetadata validation.
 * Enforces alphanumeric characters and hyphens only to prevent heavy mangling
 * during ledger name generation.
 */
const VibeMetadataSchema = type({
  titleId: /^[a-z0-9-]+$/i,
  installId: /^[a-z0-9-]+$/i,
});

/**
 * Type inference from ArkType schema
 */
export type VibeMetadata = typeof VibeMetadataSchema.infer;

/**
 * Validates that VibeMetadata contains non-empty titleId and installId with valid characters.
 * Uses ArkType for validation but preserves backward-compatible error codes.
 *
 * @param metadata - The VibeMetadata object to validate
 * @throws {VibeMetadataValidationError} If titleId or installId are missing, empty, or contain invalid characters
 */
export function validateVibeMetadata(metadata: unknown): asserts metadata is VibeMetadata {
  const result = VibeMetadataSchema(metadata);
  if (result instanceof type.errors) {
    throw new VibeMetadataValidationError(result.toLocaleString(), VIBE_METADATA_ERROR_CODES.TITLEID_EMPTY);
  }
}
