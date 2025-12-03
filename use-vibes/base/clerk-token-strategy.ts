import type {
  TokenStrategie,
  TokenAndClaims,
  ToCloudOpts,
} from '@fireproof/core-types-protocols-cloud';
import { Lazy, type Logger } from '@adviser/cement';
import type { SuperThis } from '@fireproof/core-types-base';
import { getKeyBag } from '@fireproof/core-keybag';
import { DashboardApi } from '@fireproof/core-protocols-dashboard';

/**
 * ClerkTokenStrategy implements the TokenStrategie pattern for Fireproof cloud sync.
 * It exchanges Clerk auth tokens for cloud session tokens via the dashboard API.
 * Cloud tokens are stored in KeyBag using the deviceId (local database name) as the key.
 */
export class ClerkTokenStrategy implements TokenStrategie {
  private getClerkToken: () => Promise<string | null>;
  private deviceId?: string;
  private opts?: ToCloudOpts;
  private tokenCache = Lazy(
    async () => {
      const sthis = this.sthis;
      const logger = this.logger;
      const opts = this.opts;
      const deviceId = this.deviceId;

      if (!sthis || !logger || !opts || !deviceId) return undefined;

      // Get KeyBag for storing/retrieving cloud tokens
      const kb = await getKeyBag(sthis);

      // Try to get existing cloud token from KeyBag
      const existingTokenResult = await kb.getJwt(deviceId);
      if (existingTokenResult.isOk()) {
        const { jwt } = existingTokenResult.Ok();
        return { token: jwt };
      }

      // Cloud token doesn't exist or is expired
      // Get fresh Clerk token to exchange for cloud token
      const clerkToken = await this.getClerkToken();
      if (!clerkToken) return undefined;

      // Create dashboard API client
      // Use environment variable or fallback to production
      const apiUrl: string =
        (typeof window !== 'undefined' &&
          (window as { __VIBES_CONNECT_API_URL__?: string }).__VIBES_CONNECT_API_URL__) ||
        'https://connect.fireproof.direct/api';

      const dashApi = new DashboardApi({
        apiUrl,
        getToken: async () => ({ type: 'clerk', token: clerkToken }),
        fetch: fetch.bind(window),
      });

      // Exchange Clerk token for cloud session token
      const cloudTokenResult = await dashApi.getCloudSessionToken({
        selected: {
          tenant: opts.tenant,
          ledger: opts.ledger,
        },
      });

      if (cloudTokenResult.isErr()) {
        logger.Error().Err(cloudTokenResult.Err()).Msg('Failed to get cloud session token');
        return undefined;
      }

      const cloudToken = cloudTokenResult.Ok().token;

      // Store the cloud token in KeyBag
      await kb.setJwt(deviceId, cloudToken);

      return { token: cloudToken };
    },
    { resetAfter: 30000 }
  );

  private sthis?: SuperThis;
  private logger?: Logger;

  constructor(getClerkToken: () => Promise<string | null>) {
    this.getClerkToken = getClerkToken;
  }

  readonly hash = Lazy(() => 'clerk-token-strategy');

  stop(): void {
    // No cleanup needed for Clerk tokens
    return;
  }

  open(sthis: SuperThis, logger: Logger, deviceId: string, opts: ToCloudOpts): void {
    // Store context for use in tokenCache
    this.sthis = sthis;
    this.logger = logger;
    this.deviceId = deviceId;
    this.opts = opts;
  }

  async tryToken(
    _sthis: SuperThis,
    _logger: Logger,
    _opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    return await this.tokenCache();
  }

  async waitForToken(
    sthis: SuperThis,
    logger: Logger,
    _deviceId: string,
    opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    return this.tryToken(sthis, logger, opts);
  }
}
