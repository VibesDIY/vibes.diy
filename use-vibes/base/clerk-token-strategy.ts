import type {
  TokenStrategie,
  TokenAndClaims,
  ToCloudOpts,
} from '@fireproof/core-types-protocols-cloud';
import { type Logger } from '@adviser/cement';
import type { SuperThis } from '@fireproof/core-types-base';
import { DashboardApi } from '@fireproof/core-protocols-dashboard';

/**
 * ClerkTokenStrategy implements the TokenStrategie pattern for Fireproof cloud sync.
 * It exchanges Clerk auth tokens for cloud session tokens via the dashboard API's
 * ensureCloudToken endpoint, which auto-creates tenant/ledger/binding as needed.
 */
export class ClerkTokenStrategy implements TokenStrategie {
  private getClerkToken: () => Promise<string | null>;
  private deviceId?: string;
  private opts?: ToCloudOpts;
  private sthis?: SuperThis;
  private logger?: Logger;
  private dashApi?: DashboardApi;

  constructor(getClerkToken: () => Promise<string | null>) {
    this.getClerkToken = getClerkToken;
  }

  /**
   * Update the token getter without recreating the strategy instance
   */
  updateTokenGetter(getClerkToken: () => Promise<string | null>): void {
    this.getClerkToken = getClerkToken;
  }

  /**
   * Returns a hash for this strategy instance
   */
  hash(): string {
    return 'clerk-token-strategy';
  }

  /**
   * Compute stable appId from deviceId (which includes vf- prefix) + domain + path
   */
  private computeAppId(deviceId: string): string {
    if (typeof window === 'undefined') {
      return deviceId; // Fallback for SSR
    }

    const domain = window.location.hostname;
    const firstPathPart = window.location.pathname.split('/')[1] || '';

    // Simple hash function to create stable appId
    const str = `${deviceId}-${domain}-${firstPathPart}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `app-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Called by Fireproof to initialize the strategy with context
   * Note: Signature is (sthis, logger, deviceId, opts) - deviceId comes before opts
   */
  open(sthis: SuperThis, logger: Logger, deviceId: string, opts: ToCloudOpts): void {
    this.sthis = sthis;
    this.logger = logger;
    this.opts = opts;
    this.deviceId = deviceId;

    // Only create DashboardApi if it doesn't exist (reuse existing instance)
    if (!this.dashApi) {
      const apiUrl: string =
        (typeof window !== 'undefined' &&
          (window as { __VIBES_CONNECT_API_URL__?: string }).__VIBES_CONNECT_API_URL__) ||
        'https://connect.fireproof.direct/api';

      this.dashApi = new DashboardApi({
        apiUrl,
        getToken: async () => {
          const clerkToken = await this.getClerkToken();
          if (!clerkToken) {
            throw new Error('No Clerk token available');
          }
          return { type: 'clerk', token: clerkToken };
        },
        fetch: fetch.bind(window),
      });
    }
  }

  /**
   * Try to get a valid token. Called by Fireproof when a token is needed.
   */
  async tryToken(
    sthis: SuperThis,
    logger: Logger,
    _opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    if (!this.dashApi || !this.deviceId) {
      return undefined;
    }

    // Compute stable appId from deviceId (with vf- prefix) + domain + path
    const appId = this.computeAppId(this.deviceId);

    // Use ensureCloudToken which auto-creates tenant/ledger/binding
    // and returns a properly scoped cloud token
    const result = await this.dashApi.ensureCloudToken({
      appId,
      env: 'prod',
    });

    if (result.isErr()) {
      logger?.Error().Err(result.Err()).Msg('Failed to get cloud token via ensureCloudToken');
      return undefined;
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
    // Clean up DashboardApi instance
    if (this.dashApi) {
      this.dashApi = undefined;
    }

    // Clear other references
    this.deviceId = undefined;
    this.opts = undefined;
    this.sthis = undefined;
    this.logger = undefined;
  }
}
