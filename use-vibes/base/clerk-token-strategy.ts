import type {
  TokenStrategie,
  TokenAndClaims,
  ToCloudOpts,
} from '@fireproof/core-types-protocols-cloud';
import { type Logger, Lazy, ResolveOnce, Future } from '@adviser/cement';
import type { SuperThis } from '@fireproof/core-types-base';
import { DashboardApi } from '@fireproof/core-protocols-dashboard';
import { hashObjectSync } from '@fireproof/core-runtime';

/**
 * Minimal Clerk interface for type safety.
 * Only defines the addListener method we need for session change notifications.
 */
interface ClerkIf {
  addListener: (
    callback: (resources: {
      session?: { getToken: (opts?: { template?: string }) => Promise<string | null> } | null;
    }) => void
  ) => () => void;
}

/**
 * Lazy factory that creates a DashboardApi with automatic token refresh via Clerk listener.
 * Uses Future + ResolveOnce for async token resolution and caching.
 *
 * @param clerk - Clerk instance with addListener method
 * @param apiUrl - Dashboard API base URL
 * @returns DashboardApi instance that auto-refreshes tokens via Clerk
 */
export const clerkDashApi = Lazy((clerk: ClerkIf, apiUrl: string) => {
  const getDashApi = new ResolveOnce<DashboardApi>();
  let futureToken = new Future<string>();

  const getToken = () =>
    getDashApi.once(async () => {
      const token = await futureToken.asPromise();
      return { type: 'clerk' as const, token };
    });

  const opts = {
    apiUrl,
    getToken,
    fetch: fetch.bind(globalThis),
  };

  const dashApi = new DashboardApi(opts);

  // Clerk listener handles token refresh automatically
  clerk.addListener(({ session }) => {
    if (session) {
      session.getToken({ template: 'with-email' }).then((token) => {
        if (token) {
          getDashApi.reset(() => dashApi);
          futureToken.resolve(token);
          futureToken = new Future<string>();
        }
      });
    }
  });

  return dashApi;
});

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
 * Uses clerkDashApi Lazy factory for DashboardApi creation with automatic token refresh.
 */
export class ClerkTokenStrategy implements TokenStrategie {
  private dashApi?: DashboardApi;
  private deviceId?: string;

  /**
   * Sets the DashboardApi instance for this strategy.
   * Called by VibeContextProvider after creating DashboardApi via clerkDashApi factory.
   */
  setDashboardApi(dashApi: DashboardApi): void {
    this.dashApi = dashApi;
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
   * DashboardApi.ensureCloudToken already has built-in caching via KeyedResolvOnce.
   */
  async tryToken(
    _sthis: SuperThis,
    logger: Logger,
    _opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    if (!this.dashApi || !this.deviceId) {
      return undefined;
    }

    // Use deviceId directly as appId - it's already unique (vf-titleId-installId-dbName)
    // ensureCloudToken auto-creates tenant/ledger/binding per appId and caches internally
    const result = await this.dashApi.ensureCloudToken({
      appId: this.deviceId,
      env: 'prod',
    });

    if (result.isErr()) {
      logger?.Error().Err(result.Err()).Msg('Failed to get cloud token via ensureCloudToken');
      throw result.Err();
    }

    const response = result.Ok();

    // Return the cloud token as a TokenAndClaims object
    return {
      token: response.cloudToken,
      // claims will be parsed from the JWT by Fireproof
    };
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
