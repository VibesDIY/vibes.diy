import React, { createContext, useContext, type ReactNode } from 'react';
import { injectDefaultVibesCtx, VibesEnv } from '../index.js';
import { clerkDashApi, DashboardApiImpl } from '@fireproof/core-protocols-dashboard';
import { ClerkProvider, useClerk } from '@clerk/clerk-react';
import { ToCloudOpts, TokenAndClaims, TokenStrategie } from '@fireproof/core-types-protocols-cloud';
import { Database, SuperThis } from '@fireproof/use-fireproof';
import { Lazy, Logger, OnFunc, OnFuncReturn, ReturnOnFunc } from '@adviser/cement';
import z from 'zod';

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
  readonly dashApi: DashboardApiImpl<unknown>;
  readonly clerk: ReturnType<typeof useClerk>;
  sessionReady(): boolean;
  fpCloudStrategie(): TokenStrategie;
  onDatabaseOpen: ReturnOnFunc<[_db: Database], unknown>;
}

class DefVibe implements Vibe {
  #notReady<R>(action: string): R {
    throw new Error(`Vibe Provider is not Ready: ${action}`);
  }

  fpCloudStrategie(): TokenStrategie {
    return this.#notReady('fpCloudStrategie');
  }

  onDatabaseOpen = ((_fn: (...a: Database[]) => OnFuncReturn): (() => unknown) => {
    return this.#notReady('onDatabaseOpen');
  }) as ReturnOnFunc<[_db: Database], unknown>;
  //   return this.#notReady("onDatabaseOpen")
  // } as unknown as ReturnOnFunc<[_db: Database], unknown>

  sessionReady(): boolean {
    return this.#notReady('sessionReady');
  }

  get clerk(): Vibe['clerk'] {
    return this.#notReady('clerk');
  }

  get dashApi(): DashboardApiImpl<unknown> {
    return this.#notReady('dashApi');
  }

  get appSlug(): string {
    return this.#notReady('appSlug');
  }

  get titleId(): string {
    return this.#notReady('titleId');
  }
  get installId(): string {
    return this.#notReady('installId');
  }
  get env(): VibesEnv {
    return this.#notReady('env');
  }
}

const VibeContext = createContext<Vibe>(new DefVibe());

export interface VibeContextProviderProps {
  readonly mountParams: MountVibeParams;
  readonly children: ReactNode;
}

class UseVibesStrategie implements TokenStrategie {
  readonly ctx: Pick<Vibe, 'dashApi' | 'env'>;
  constructor(ctx: Pick<Vibe, 'dashApi' | 'env'>) {
    this.ctx = ctx;
  }

  hash(): string {
    return this.ctx.env.DASHBOARD_URL;
  }

  open(): void {
    /* */
  }
  tryToken(): Promise<TokenAndClaims | undefined> {
    return Promise.resolve(undefined);
  }

  // waitForToken(sthis: SuperThis, logger: Logger, deviceId: string, opts: ToCloudOpts): Promise<TokenAndClaims | undefined>;
  async waitForToken(
    sthis: SuperThis,
    logger: Logger,
    deviceId: string,
    opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    const rRes = await this.ctx.dashApi.ensureCloudToken({
      appId: opts.context.get('UseVibes.AppId') || deviceId,
    });
    if (rRes.isErr()) {
      logger.Error().Err(rRes).Msg();
      return undefined;
    }
    const res = rRes.Ok();
    return {
      token: res.cloudToken,
      ...res,
    };
  }
  stop(): void {
    throw new Error('Method not implemented.');
  }
}

const lazyFpCloudStrategie = Lazy(
  (ctx: Pick<Vibe, 'dashApi' | 'env'>) => new UseVibesStrategie(ctx)
);

function LiveCycleVibeContextProvider({ mountParams, children }: VibeContextProviderProps) {
  console.log('LiveCycleVibeContextProvider', mountParams);
  const clerk = useClerk();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dashApi = clerkDashApi(clerk as any, {
    apiUrl: mountParams.env.DASHBOARD_URL,
  });

  const fpCloudStrategie = lazyFpCloudStrategie({
    ...mountParams,
    dashApi,
  });
  const onDatabaseOpen = OnFunc<(_db: Database) => unknown>();
  const ctx = {
    dashApi,
    clerk,
    fpCloudStrategie: () => fpCloudStrategie,
    onDatabaseOpen,
    sessionReady: () => {
      return clerk.session?.status === 'active';
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
      <LiveCycleVibeContextProvider mountParams={mountParams}>
        {children}
      </LiveCycleVibeContextProvider>
    </ClerkProvider>
  );
}

export function useVibeContext(): Vibe {
  return useContext(VibeContext);
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
