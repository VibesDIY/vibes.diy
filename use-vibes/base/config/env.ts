import { envFactory, Lazy } from '@adviser/cement';

export class UseVibesEnv {
  // Lazily initialize cement Env for use-vibes
  env = Lazy(() => envFactory({ symbol: 'useVibes' }));

  // Window overrides for cross-context support
  getWindowVIBES_CONNECT_API_URL() {
    const w = globalThis.window as { VIBES_CONNECT_API_URL?: string } | undefined;
    return w?.VIBES_CONNECT_API_URL;
  }

  getWindowVIBES_DASHBOARD_URI() {
    const w = globalThis.window as { VIBES_DASHBOARD_URI?: string } | undefined;
    return w?.VIBES_DASHBOARD_URI;
  }

  getWindowVIBES_TOKEN_API_URI() {
    const w = globalThis.window as { VIBES_TOKEN_API_URI?: string } | undefined;
    return w?.VIBES_TOKEN_API_URI;
  }

  getWindowVIBES_CLOUD_BASE_URL() {
    const w = globalThis.window as { VIBES_CLOUD_BASE_URL?: string } | undefined;
    return w?.VIBES_CLOUD_BASE_URL;
  }

  /**
   * Base URL for the Fireproof Connect API.
   *
   * Fallback order:
   * 1. window.VIBES_CONNECT_API_URL (host overrides for iframes)
   * 2. Env("VIBES_CONNECT_API_URL") via cement
   * 3. Default: https://connect.fireproof.direct/api
   */
  get VIBES_CONNECT_API_URL() {
    return (
      this.getWindowVIBES_CONNECT_API_URL() ??
      this.env().get('VIBES_CONNECT_API_URL') ??
      'https://connect.fireproof.direct/api'
    );
  }

  /**
   * Dashboard token auto endpoint used by toCloud().
   * Maps the hardcoded dashboardURI in the previous implementation.
   */
  get VIBES_DASHBOARD_URI() {
    return (
      this.getWindowVIBES_DASHBOARD_URI() ??
      this.env().get('VIBES_DASHBOARD_URI') ??
      'https://connect.fireproof.direct/fp/cloud/api/token-auto'
    );
  }

  /**
   * Token / dashboard API base URL.
   * Used by both toCloud() and share() for Fireproof dashboard requests.
   */
  get VIBES_TOKEN_API_URI() {
    return (
      this.getWindowVIBES_TOKEN_API_URI() ??
      this.env().get('VIBES_TOKEN_API_URI') ??
      'https://connect.fireproof.direct/api'
    );
  }

  /**
   * Fireproof cloud base URL (fpcloud protocol).
   */
  get VIBES_CLOUD_BASE_URL() {
    return (
      this.getWindowVIBES_CLOUD_BASE_URL() ??
      this.env().get('VIBES_CLOUD_BASE_URL') ??
      'fpcloud://cloud.fireproof.direct'
    );
  }
}

export const useVibesEnv = new UseVibesEnv();
