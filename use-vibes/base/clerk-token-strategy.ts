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
  private cachedToken?: string;
  private cachedTokenExpiresAt?: number;

  constructor(getClerkToken: () => Promise<string | null>) {
    this.getClerkToken = getClerkToken;
  }

  readonly hash = Lazy(() => 'clerk-token-strategy');

  stop(): void {
    // No cleanup needed for Clerk tokens
    return;
  }

  open(_sthis: SuperThis, _logger: Logger, deviceId: string, opts: ToCloudOpts): void {
    // Store deviceId and opts for later use in tryToken/waitForToken
    this.deviceId = deviceId;
    this.opts = opts;
  }

  private isCachedTokenValid(): boolean {
    if (!this.cachedToken || this.cachedTokenExpiresAt === undefined) {
      return false;
    }

    return Date.now() < this.cachedTokenExpiresAt;
  }

  private updateCacheFromClaims(jwt: string, claims?: { exp?: unknown }): void {
    const now = Date.now();

    if (claims && typeof claims.exp === 'number') {
      const expireTime = claims.exp * 1000;

      // Respect the token's own expiry when available, with a small
      // safety window to refresh slightly before it actually expires.
      const safetyExpiry = expireTime - 30000;
      if (safetyExpiry > now) {
        this.cachedToken = jwt;
        this.cachedTokenExpiresAt = safetyExpiry;
        return;
      }
    }

    // Fallback: simple 30s in-memory TTL when we don't have a usable exp.
    this.cachedToken = jwt;
    this.cachedTokenExpiresAt = now + 30000;
  }

  async tryToken(
    sthis: SuperThis,
    logger: Logger,
    opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    const deviceId = this.deviceId;
    if (!deviceId) return undefined;

    // First, reuse any valid in-memory token to avoid unnecessary
    // dashboard or Clerk calls.
    if (this.isCachedTokenValid()) {
      return { token: this.cachedToken as string };
    }

    // Get KeyBag for storing/retrieving cloud tokens
    const kb = await getKeyBag(sthis);

    // Try to get existing cloud token from KeyBag
    const existingTokenResult = await kb.getJwt(deviceId);
    if (existingTokenResult.isOk()) {
      const { jwt, claims } = existingTokenResult.Ok();

      this.updateCacheFromClaims(jwt, claims as { exp?: unknown } | undefined);

      if (this.isCachedTokenValid()) {
        return { token: this.cachedToken as string };
      }
    }

    // Cloud token doesn't exist or is expired
    // Get fresh Clerk token to exchange for cloud token
    const clerkToken = await this.getClerkToken();
    if (!clerkToken) return undefined;

    // Create dashboard API client
    const dashApi = new DashboardApi({
      apiUrl: 'https://connect.fireproof.direct/api',
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

    // Store the cloud token in KeyBag (it will parse claims automatically)
    await kb.setJwt(deviceId, cloudToken);

    // Cache the new token in-memory with a short TTL so repeated
    // tryToken calls do not immediately re-hit Clerk or dashboard.
    this.updateCacheFromClaims(cloudToken);

    // Return the cloud token
    return { token: cloudToken };
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
