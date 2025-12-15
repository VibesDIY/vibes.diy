import type { ToCloudAttachable, TokenStrategie } from '@fireproof/core-types-protocols-cloud';
import { useCallback, useEffect, useState } from 'react';
import {
  Attached,
  fireproof,
  ImgFile,
  isDatabase,
  toCloud as originalToCloud,
  useFireproof as originalUseFireproof,
  UseFireproof,
  UseFPConfig,
  type Database,
  type UseFpToCloudParam,
} from '@fireproof/use-fireproof';
import { useVibeContext, Vibe } from './contexts/VibeContext.js';
import { callAI } from 'call-ai';
import z from 'zod';
import { ResolveOnce } from '@adviser/cement';

export * from './contexts/VibeContext.js';

export { fireproof, ImgFile };

// Re-export all types under a namespace
export type * as Fireproof from '@fireproof/use-fireproof';

export const VibesEnvSchema = z.object({
  FPCLOUD_URL: z.string(),
  DASHBOARD_URL: z.string(),
  CLERK_PUBLISHABLE_KEY: z.string(),
  CALLAI_API_KEY: z.string(),
  CALLAI_CHAT_URL: z.string(),
  CALLAI_IMG_URL: z.string(),
});

export type VibesEnv = z.infer<typeof VibesEnvSchema>;

// Extended options for toCloud with Clerk token support
interface ToCloudWithClerkOpts extends UseFpToCloudParam {
  readonly env: VibesEnv;
  readonly fpCloudStrategie?: TokenStrategie;
}

let injectedVibesCtx: Vibe | undefined = undefined;

function defVibesCtx(): Vibe {
  if (!injectedVibesCtx) {
    throw new Error('VibesCtx not injected. Please call injectDefaultVibes');
  }
  return injectedVibesCtx;
}

export function injectDefaultVibesCtx(ctx: Vibe) {
  injectedVibesCtx = ctx;
}

// Helper function to create toCloud configuration
export function toCloud(iopts?: ToCloudWithClerkOpts): ToCloudAttachable {
  const defCtx = defVibesCtx();
  const opts = {
    ...defCtx,
    ...iopts,
  };
  // console.log('[toCloud] Creating cloud config with opts:', opts);

  const attachable = originalToCloud({
    strategy: opts.strategy,
    dashboardURI: opts.env.DASHBOARD_URL,
    urls: { base: opts.env.FPCLOUD_URL },
  });
  return attachable;
}

export interface AttachState {
  readonly state: 'detached' | 'attaching' | 'attached' | 'detaching' | 'error';
  readonly error?: Error;
  readonly attach?: Attached;
}

export interface UseVibesFireproof extends UseFireproof {
  readonly doAttach: () => void;
  readonly doDetach: () => void;
  readonly attachState: AttachState;
}

// Custom useFireproof hook with implicit cloud sync and button integration
export function useFireproof(
  nameOrDatabase: string | Database,
  config?: UseFPConfig
): UseVibesFireproof {
  // Read vibe context if available (for inline rendering with proper ledger naming)
  const vibeCtx = useVibeContext();

  let dbName = nameOrDatabase;
  if (isDatabase(nameOrDatabase)) {
    dbName = nameOrDatabase.ledger.ctx.get('UseVibes.AppId') || nameOrDatabase.name;
  }
  if (!dbName) {
    dbName = `db-${vibeCtx.appSlug}`;
  }

  let fpRet: UseFireproof;
  if (isDatabase(nameOrDatabase)) {
    fpRet = originalUseFireproof(nameOrDatabase, config);
  } else {
    fpRet = originalUseFireproof(dbName, config);
  }
  if (!fpRet.database.ledger.ctx.get('UseVibes.AppId')) {
    fpRet.database.ledger.ctx.set('UseVibes.AppId', dbName as string);
  }
  if (!fpRet.database.ledger.ctx.get('UseVibes.Mutex')) {
    fpRet.database.ledger.ctx.set('UseVibes.Mutex', new ResolveOnce());
  }

  const mutexAttachState = fpRet.database.ledger.ctx.get('UseVibes.Mutex') as ResolveOnce<void>;
  const [attachState, setAttachState] = useState<AttachState>({ state: 'detached' });
  const doAttach = useCallback(
    (/* in future we will be able to override defVibesCtx */) => {
      if (!vibeCtx.sessionReady()) {
        console.error('Session not ready for attach');
        setAttachState({ state: 'error', error: new Error('Session not ready for attach') });
      }
      setAttachState({ state: 'attaching' });
      mutexAttachState.once(() => {
        vibeCtx.dashApi.ensureUser({}).then((rUser) => {
          if (rUser.isErr()) {
            console.error('Failed to ensure user for attach:', rUser);
            setAttachState({ state: 'error', error: rUser.Err() });
            return;
          }
          const user = rUser.unwrap();
          console.log('Ensured user for attach:', user);
        });

        console.log('attach invoked', defVibesCtx());
        fpRet.database
          .attach(
            toCloud({
              env: defVibesCtx().env,
              strategy: defVibesCtx().fpCloudStrategie(),
            })
          )
          .then((at) => {
            console.log('Database attached');
            setAttachState({ state: 'attached', attach: at });
          })
          .catch((err) => {
            console.error('Database attach failed:', err);
            setAttachState({ state: 'error', error: err });
          });
      });
    },
    []
  );

  const doDetach = useCallback(() => {
    if (attachState.state !== 'attached') {
      return;
    }
    console.log('doDetach invoked');
    setAttachState({ ...attachState, state: 'detaching' });
    mutexAttachState.reset(() => {
      attachState.attach
        ?.detach()
        .then(() => {
          console.log('Database detached');
          setAttachState({ state: 'detached' });
        })
        .catch((err) => {
          console.error('Database detach failed:', err);
          setAttachState({ state: 'error', error: err });
        });
    });
  }, []);

  useEffect(() => {
    if (vibeCtx.sessionReady()) {
      doAttach();
    } else {
      doDetach();
    }
  });
  return {
    ...fpRet,
    doAttach,
    doDetach,
    attachState,
  };
}

// Re-export specific functions and types from call-ai

export { callAI, callAI as callAi };

// Re-export all types under a namespace
export type * as CallAI from 'call-ai';

// Export ImgGen component - the primary export
export { default as ImgGen } from './components/ImgGen.js';
export type { ImgGenProps } from './components/ImgGen.js';

// Export all components for testing and advanced usage
export { ControlsBar } from './components/ControlsBar.js';
export { PromptBar } from './components/PromptBar.js';

// Export hooks
export { hashInput, useImageGen } from './hooks/image-gen/index.js';
export { useThemeDetection } from './hooks/useThemeDetection.js';
export { useMobile } from './hooks/useMobile.js';

// Export style utilities
export { defaultClasses } from './utils/style-utils.js';

export type { ImgGenClasses } from '@vibes.diy/use-vibes-types';

// Export utility functions
export { base64ToFile } from './utils/base64.js';
export { constructVibesDatabaseName } from './utils/databaseName.js';

// Export ImgGen sub-components
export { ImgGenDisplay } from './components/ImgGenUtils/ImgGenDisplay.js';
export { ImgGenDisplayPlaceholder } from './components/ImgGenUtils/ImgGenDisplayPlaceholder.js';
export { ImgGenModal, type ImgGenModalProps } from './components/ImgGenUtils/ImgGenModal.js';
export { ImageOverlay } from './components/ImgGenUtils/overlays/ImageOverlay.js';

// Export internal utilities and constants
export { addNewVersion, MODULE_STATE } from './hooks/image-gen/utils.js';

// Export types for testing and advanced usage
export type {
  ImageDocument,
  PartialImageDocument,
  UseImageGenOptions,
  UseImageGenResult,
} from '@vibes.diy/use-vibes-types';

// Export useVibes hook and types
export type { UseVibesOptions, UseVibesResult, VibeDocument } from '@vibes.diy/use-vibes-types';
export { useVibes } from './hooks/vibes-gen/index.js';

// App-specific components moved to vibes.diy/pkg/app - no longer exported

// Export app slug utilities
export {
  getAppSlug,
  getInstanceId,
  getFullAppIdentifier,
  isDevelopmentEnvironment,
  isProductionEnvironment,
  generateRandomInstanceId,
  generateFreshDataUrl,
  generateRemixUrl,
  generateInstallId,
} from './utils/appSlug.js';

// Export VibeContext for inline rendering with proper ledger naming (needed by useFireproof)
export {
  VibeContextProvider,
  useVibeContext,
  VibeMetadataValidationError,
} from './contexts/VibeContext.js';

// export type { VibeMetadata } from './contexts/VibeContext.js';

// Mounting utilities moved to vibes.diy/pkg/app - no longer exported
