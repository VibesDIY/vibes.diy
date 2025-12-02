import { decodeJwt } from 'jose';
import type {
  TokenStrategie,
  TokenAndClaims,
  FPCloudClaim,
  ToCloudOpts,
} from '@fireproof/core-types-protocols-cloud';
import { Lazy, type Logger } from '@adviser/cement';
import { FPCloudClaimParseSchema } from '@fireproof/core-types-protocols-cloud';
import type { SuperThis } from '@fireproof/core-types-base';

/**
 * ClerkTokenStrategy implements the TokenStrategie pattern for Fireproof cloud sync.
 * It uses Clerk authentication to provide JWT tokens for secure sync operations.
 */
export class ClerkTokenStrategy implements TokenStrategie {
  private getToken: () => Promise<string | null>;

  constructor(getToken: () => Promise<string | null>) {
    this.getToken = getToken;
  }

  readonly hash = Lazy(() => 'clerk-token-strategy');

  stop(): void {
    // No cleanup needed for Clerk tokens
    return;
  }

  open(_sthis: SuperThis, _logger: Logger, _deviceId: string, _opts: ToCloudOpts): void {
    // No initialization needed for Clerk tokens
    return;
  }

  async tryToken(
    _sthis: SuperThis,
    _logger: Logger,
    _opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    const token = await this.getToken();
    if (!token) return undefined;

    try {
      const rawClaims = decodeJwt(token);
      const rParse = FPCloudClaimParseSchema.safeParse(rawClaims);

      return {
        token,
        claims: rParse.success ? rParse.data : this.getFallbackClaims(),
      };
    } catch (e) {
      return undefined;
    }
  }

  async waitForToken(
    _sthis: SuperThis,
    _logger: Logger,
    _deviceId: string,
    _opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    return this.tryToken(_sthis, _logger, _opts);
  }

  private getFallbackClaims(): FPCloudClaim {
    return {
      userId: 'unknown',
      email: 'unknown@unknown.com',
      created: new Date(),
      tenants: [],
      ledgers: [],
      selected: { tenant: '', ledger: '' },
    };
  }
}
