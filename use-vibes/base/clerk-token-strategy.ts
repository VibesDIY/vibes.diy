import type {
  TokenStrategie,
  TokenAndClaims,
  ToCloudOpts,
} from '@fireproof/core-types-protocols-cloud';
import { type Logger, Lazy, OnFunc, KeyedResolvOnce } from '@adviser/cement';
import type { SuperThis } from '@fireproof/core-types-base';
import { DashboardApi } from '@fireproof/core-protocols-dashboard';
import { hashObjectSync } from '@fireproof/core-runtime';
// Grace period before token expiration for auto-renewal
const _GRACE_PERIOD_MS = 5000; // 5 seconds before 30-second expiration

/**
 * Global event fired when DashboardApi is ready.
 * VibeContextProvider creates and invokes this with the DashboardApi instance.
 */
export const globalReadyDashApi = OnFunc<(dashApi: DashboardApi) => void>();

/**
 * Global singleton ClerkTokenStrategy instance.
 * Shared across all components to avoid per-component instance creation.
 */
export const globalClerkStrategy = Lazy(() => new ClerkTokenStrategy());

/**
 * ClerkTokenStrategy implements the TokenStrategie pattern for Fireproof cloud sync.
 * It exchanges Clerk auth tokens for cloud session tokens via the dashboard API's
 * ensureCloudToken endpoint, which auto-creates tenant/ledger/binding as needed.
 *
 * Uses global coordination via OnFunc to decouple from React lifecycle.
 */
export class ClerkTokenStrategy implements TokenStrategie {
  private dashApi?: DashboardApi;
  private deviceId?: string;
  readonly tokenCache = new KeyedResolvOnce<TokenAndClaims>();

  constructor() {
    // Listen for DashboardApi ready event - just store it
    globalReadyDashApi((dashApi) => {
      this.dashApi = dashApi;
    });
  }

  /**
   * Returns a hash for this strategy instance.
   * Uses Lazy to compute once and cache the result.
   */
  readonly hash = Lazy(() => {
    return hashObjectSync({ strategy: 'clerk' });
  });

  /**
   * Called by Fireproof to initialize the strategy with context
   * Note: Signature is (sthis, logger, deviceId, opts) - deviceId comes before opts
   */
  open(_sthis: SuperThis, _logger: Logger, deviceId: string, _opts: ToCloudOpts): void {
    // Store deviceId for token caching key
    this.deviceId = deviceId;
  }

  /**
   * Try to get a valid token. Called by Fireproof when a token is needed.
   * Uses KeyedResolvOnce to cache tokens per deviceId (appId).
   */
  async tryToken(
    sthis: SuperThis,
    logger: Logger,
    _opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    if (!this.dashApi || !this.deviceId) {
      return undefined;
    }

    // Use KeyedResolvOnce to cache token per deviceId
    return this.tokenCache.get(this.deviceId).once(async (_self) => {
      // Use deviceId directly as appId - it's already unique (vf-titleId-installId-dbName)
      // ensureCloudToken auto-creates tenant/ledger/binding per appId
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const result = await this.dashApi!.ensureCloudToken({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        appId: this.deviceId!,
        env: 'prod',
      });

      if (result.isErr()) {
        logger?.Error().Err(result.Err()).Msg('Failed to get cloud token via ensureCloudToken');
        throw result.Err();
      }

      const response = result.Ok();

      // TODO: Auto-renewal - waiting for setRestartAfter() API in cement
      // _self.setRestartAfter(response.expiresInSec * 1000 - _GRACE_PERIOD_MS);

      // Return the cloud token as a TokenAndClaims object
      return {
        token: response.cloudToken,
        // claims will be parsed from the JWT by Fireproof
      };
    });
  }

  /**
   * Wait for a token to become available. Called when tryToken returns undefined.
   */
  async waitForToken(
    sthis: SuperThis,
    logger: Logger,
    deviceId: string,
    opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    // For Clerk, we can just try again immediately
    // In the future, we could add exponential backoff or listen for auth state changes
    return this.tryToken(sthis, logger, opts);
  }

  /**
   * Called when the strategy should stop and clean up resources
   */
  stop(): void {
    // Keep dashApi alive for reuse across instances
    // Clear deviceId to prevent stale token access
    this.deviceId = undefined;
  }
}
