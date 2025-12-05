import type {
  TokenStrategie,
  TokenAndClaims,
  ToCloudOpts,
} from '@fireproof/core-types-protocols-cloud';
import { type Logger } from '@adviser/cement';
import type { SuperThis } from '@fireproof/core-types-base';
import type { DashboardApiImpl } from '@fireproof/core-protocols-dashboard';

/**
 * Simplified ClerkTokenStrategy - just calls dashApi.ensureCloudToken()
 * No caching, no Future pattern - DashboardApi handles everything
 */
export class ClerkTokenStrategy implements TokenStrategie {
  private deviceId?: string;

  constructor(private dashApi: DashboardApiImpl<unknown>) {}

  readonly hash = () => 'clerk-strategy';

  open(_sthis: SuperThis, _logger: Logger, deviceId: string, _opts: ToCloudOpts): void {
    this.deviceId = deviceId;
  }

  async tryToken(
    _sthis: SuperThis,
    logger: Logger,
    _opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    if (!this.dashApi || !this.deviceId) return undefined;

    const result = await this.dashApi.ensureCloudToken({
      appId: this.deviceId,
      env: 'prod',
    });

    if (result.isErr()) {
      logger?.Error().Err(result.Err()).Msg('ensureCloudToken failed');
      return undefined;
    }

    return { token: result.Ok().cloudToken };
  }

  async waitForToken(
    sthis: SuperThis,
    logger: Logger,
    _deviceId: string,
    opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    return this.tryToken(sthis, logger, opts);
  }

  stop(): void {
    this.deviceId = undefined;
  }
}
