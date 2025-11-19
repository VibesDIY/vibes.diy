// Manual redirect strategy for Fireproof authentication
import type { Logger } from '@adviser/cement';
import type { SuperThis } from '@fireproof/core-types-base';
import type { ToCloudOpts, TokenAndClaims } from '@fireproof/core-types-protocols-cloud';
import { hashObjectSync } from '@fireproof/core-runtime';
import { RedirectStrategy } from 'use-fireproof';
import { AUTH_OVERLAY_READY_EVENT, AUTH_OVERLAY_HIDDEN_CLASS } from './events.js';
import type { AuthOverlayReadyDetail } from './events.js';
import { type VibeMetadata, validateVibeMetadata } from './contexts/VibeContext.js';

interface BuildURIBuilder {
  from: (uri: string) => URLBuilder;
}

interface URLBuilder {
  setParam: (key: string, value: string) => URLBuilder;
  toString: () => string;
}

// Generate ledger name combining titleId, installId, and database name
export function generateLedgerName(dbName: string, vibeMetadata?: VibeMetadata): string {
  // Priority 1: Use React Context metadata if provided (inline rendering)
  if (vibeMetadata) {
    // Validate metadata before using it to prevent malformed ledger names
    validateVibeMetadata(vibeMetadata);

    const { installId, titleId } = vibeMetadata;
    // NOTE: Validation (via validateVibeMetadata) ensures non-empty strings with valid characters.
    // This sanitization is defensive normalization - ensures any edge cases are safe for ledger names.
    const safeInstallId = String(installId).replace(/[^a-z0-9-]/gi, '-');
    const safeTitleId = String(titleId).replace(/[^a-z0-9-]/gi, '-');
    const safeDb = String(dbName).replace(/[^a-z0-9-]/gi, '-');
    console.log(`Generated ledger name: ${safeInstallId}-${safeTitleId}-${safeDb}`);
    return `${safeInstallId}-${safeTitleId}-${safeDb}`;
  }

  // Priority 2: Fallback to origin-based naming (when context not available)
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin.replace(/[^a-z0-9]/gi, '-')
      : 'unknown-origin';
  const safeDb = String(dbName).replace(/[^a-z0-9-]/gi, '-');
  return `${origin}-${safeDb}`;
}

// Parse JWT token to extract claims
function parseJWT(token: string): unknown {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return undefined;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    // Replace URL-safe characters and add padding if needed
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    // Decode base64
    const jsonString = atob(paddedBase64);
    return JSON.parse(jsonString);
  } catch {
    return undefined;
  }
}

// Check if JWT token is expired
export function isJWTExpired(token: string): boolean {
  try {
    const claims = parseJWT(token) as { exp?: number };
    if (!claims || typeof claims.exp !== 'number') {
      // No expiration claim, assume expired for safety
      return true;
    }

    // exp is in seconds, Date.now() is in milliseconds
    const expirationTime = claims.exp * 1000;
    const currentTime = Date.now();

    // Add a 60-second buffer to avoid edge cases
    return currentTime >= expirationTime - 60000;
  } catch {
    // Parse error, assume expired
    return true;
  }
}

/**
 * Configuration options for ManualRedirectStrategy.
 */
export interface ManualRedirectStrategyOptions {
  /** Custom HTML generator for the auth overlay */
  readonly overlayHtml?: (url: string) => string;
  /** Custom CSS for the auth overlay */
  readonly overlayCss?: string;
  /** Vibe metadata for ledger name generation */
  readonly vibeMetadata?: VibeMetadata;
}

export class ManualRedirectStrategy extends RedirectStrategy {
  private authOpened = false;
  private pollingStarted = false;
  private resolveToken?: (value: TokenAndClaims | undefined) => void;
  private readonly vibeMetadata?: VibeMetadata;

  // Override the hash property to return a proper hash of the configuration
  // This ensures different strategy instances with different configs get different hashes
  readonly hash = (): string => {
    return hashObjectSync({
      overlayCss: this.overlayCss,
      overlayHtml: this.overlayHtml('X').toString(),
      vibeMetadata: this.vibeMetadata,
    });
  };

  // Public method to set an external token (e.g., from localStorage)
  setToken(token: string): void {
    // Parse JWT to extract claims
    const claims = parseJWT(token) as TokenAndClaims['claims'];

    // Set the parent class's currentToken property
    // Using type assertion to access private property
    (this as unknown as { currentToken?: TokenAndClaims }).currentToken = {
      token,
      claims,
    };
  }

  constructor(opts: ManualRedirectStrategyOptions = {}) {
    // Create custom CSS for subtle bottom slide-up
    const customCss =
      opts.overlayCss ||
      `
      .fpOverlay {
        display: none;
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: auto;
        height: auto;
        background-color: transparent;
        z-index: 9999;
        animation: slideUp 0.3s ease-out;
        pointer-events: none; /* Allow clicking through the overlay container */
      }
      
      /* Hidden/minimized state toggled from outside */
      .fpOverlay.${AUTH_OVERLAY_HIDDEN_CLASS} {
        display: none !important;
      }
      
      .fpOverlay[style*="block"] {
        display: block !important;
      }
      
      .fpOverlayContent {
        pointer-events: auto; /* But allow interaction with the content */
        background-color: white;
        color: black;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
        max-width: 320px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
      }
      
      .fpCloseButton {
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 18px;
        cursor: pointer;
        color: #999;
        background: none;
        border: none;
        padding: 4px;
        line-height: 1;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      
      .fpCloseButton:hover {
        opacity: 1;
      }
      
      @keyframes slideUp {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;

    // Create custom HTML for subtle notification
    const customHtml =
      opts.overlayHtml ||
      ((url: string) => `
      <div class="fpOverlayContent">
        <div class="fpCloseButton">&times;</div>
        <div style="
          width: 32px;
          height: 32px;
          min-width: 32px;
          background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
        ">🔥</div>
        
        <div style="flex: 1;">
          <div style="
            font-weight: 600;
            color: #333;
            margin-bottom: 4px;
          ">Enable Sync</div>
          
          <div style="
            color: #666;
            font-size: 13px;
            margin-bottom: 8px;
          ">Sign in to sync across devices</div>
          
          <a href="${url}" style="
            display: inline-block;
            background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
            color: white;
            text-decoration: none;
            padding: 6px 14px;
            border-radius: 6px;
            font-weight: 500;
            font-size: 13px;
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          " onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 8px rgba(255, 107, 53, 0.3)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            Sign In
          </a>
        </div>
      </div>
    `);

    super({ overlayCss: customCss, overlayHtml: customHtml });
    this.vibeMetadata = opts.vibeMetadata;
  }

  // Override the open method to not automatically open the popup
  open(sthis: SuperThis, logger: Logger, deviceId: string, opts: ToCloudOpts): void {
    // Call parent open but we'll override the window.open behavior
    const originalWindowOpen = window.open;

    // Temporarily replace window.open with a no-op to prevent auto-popup
    window.open = () => null;

    // Call parent's open method which sets up everything including the overlay
    super.open(sthis, logger, deviceId, opts);

    // Restore original window.open
    window.open = originalWindowOpen;

    // Check for existing token asynchronously and hide overlay if found
    super.tryToken(sthis, logger, opts).then((existingToken) => {
      if (existingToken && this.overlayNode) {
        // Token exists, hide overlay immediately
        this.overlayNode.style.display = 'none';
      } else {
        // No token, setup manual trigger
        this.setupManualTrigger(sthis, logger, deviceId, opts);
      }
    });
  }

  // Override waitForToken to delay polling until user clicks (unless token exists)
  async waitForToken(
    sthis: SuperThis,
    logger: Logger,
    deviceId: string,
    opts: ToCloudOpts
  ): Promise<TokenAndClaims | undefined> {
    // Check if a token already exists (either set via setToken() or from previous session)
    const existingToken = await super.tryToken(sthis, logger, opts);
    if (existingToken) {
      // Token exists, return it immediately
      return existingToken;
    }

    // No existing token, wait for user interaction
    if (!this.pollingStarted) {
      return new Promise((resolve) => {
        this.resolveToken = resolve;
        // Polling will start when user clicks the sign-in button
      });
    }

    // If polling was already started, use parent's implementation
    return super.waitForToken(sthis, logger, deviceId, opts);
  }

  private setupManualTrigger(
    sthis: SuperThis,
    logger: Logger,
    deviceId: string,
    opts: ToCloudOpts
  ): void {
    if (!this.overlayNode) return;

    // Get the auth URL that was built by parent
    const redirectCtx = (
      opts.context as { get?: (key: string) => { dashboardURI?: string } }
    )?.get?.('WebCtx') || {
      dashboardURI: (opts as { dashboardURI?: string }).dashboardURI as string,
    };
    const dashboardURI = redirectCtx.dashboardURI;

    if (!dashboardURI) return;

    // Build the same URL as parent
    const BuildURI = (globalThis as { BuildURI?: unknown }).BuildURI || {
      from: (uri: string) => {
        const urlObj = new URL(uri);
        return {
          _url: urlObj,
          setParam: function (key: string, value: string) {
            this._url.searchParams.set(key, value);
            return this;
          },
          asURL: function () {
            return this._url;
          },
          toString: function () {
            return this._url.toString();
          },
        };
      },
    };

    const url = (BuildURI as BuildURIBuilder)
      .from(dashboardURI)
      .setParam('back_url', window.location.href)
      .setParam('result_id', this.resultId || '')
      .setParam('local_ledger_name', generateLedgerName(deviceId, this.vibeMetadata));

    if (opts.ledger) {
      url.setParam('ledger', String(opts.ledger));
    }
    if (opts.tenant) {
      url.setParam('tenant', String(opts.tenant));
    }

    // Find the link in the overlay and update its click handler
    const authLink = this.overlayNode.querySelector('a[href]') as HTMLAnchorElement;
    // Remove debug logs in production
    if (authLink) {
      authLink.addEventListener('click', async (e) => {
        e.preventDefault();

        // Only open once per session
        if (!this.authOpened) {
          const width = 800;
          const height = 600;
          const parentScreenX = window.screenX || window.screenLeft;
          const parentScreenY = window.screenY || window.screenTop;
          const parentOuterWidth = window.outerWidth;
          const parentOuterHeight = window.outerHeight;
          const left = parentScreenX + parentOuterWidth / 2 - width / 2;
          const top = parentScreenY + parentOuterHeight / 2 - height / 2;

          window.open(
            url.toString(),
            'Fireproof Login',
            `left=${left},top=${top},width=${width},height=${height},scrollbars=yes,resizable=yes,popup=yes`
          );

          this.authOpened = true;

          // Now start the polling
          if (!this.pollingStarted) {
            this.pollingStarted = true;

            // Start polling using parent's waitForToken
            const token = await super.waitForToken(sthis, logger, deviceId, opts);

            // Resolve the promise from our overridden waitForToken
            if (this.resolveToken) {
              this.resolveToken(token);
              this.resolveToken = undefined;
            }
          }

          // Optionally minimize the notification after clicking
          if (this.overlayNode) {
            this.overlayNode.style.opacity = '0.7';
          }
        }
      });
    }

    // Signal that the overlay and click handler are ready (guarded + next frame)
    if (this.overlayNode) {
      const overlayEl = this.overlayNode as HTMLElement;
      const linkEl = overlayEl.querySelector('a[href]') as HTMLAnchorElement | null;
      // Ensure the node is in the DOM and painted before consumers act
      requestAnimationFrame(() => {
        document.dispatchEvent(
          new CustomEvent<AuthOverlayReadyDetail>(AUTH_OVERLAY_READY_EVENT, {
            detail: { overlay: overlayEl, authLink: linkEl },
          })
        );
      });
    }
  }

  // Reset the flags when stop is called
  stop(): void {
    super.stop();
    this.authOpened = false;
    this.pollingStarted = false;
    this.resolveToken = undefined;
  }
}
