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
   * Returns a hash for this strategy instance
   */
  hash(): string {
    return 'clerk-token-strategy';
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

    // Initialize dashboard API client
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

    try {
      // Use ensureCloudToken which auto-creates tenant/ledger/binding
      // and returns a properly scoped cloud token
      const result = await this.dashApi.ensureCloudToken({
        appId: this.deviceId, // Use deviceId (database name) as appId
        env: 'prod',
        // Optional: if we want to specify tenant/ledger, we can pass them
        // tenant: opts.tenant,
        // ledger: opts.ledger,
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
    } catch (error) {
      logger?.Error().Err(error).Msg('Exception in ClerkTokenStrategy.tryToken');
      return undefined;
    }
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
    // No cleanup needed for this strategy
  }
}
