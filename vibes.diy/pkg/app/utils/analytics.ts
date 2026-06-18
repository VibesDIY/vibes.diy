import { gtmPush } from "./gtm.js";

// Lightweight GTM/dataLayer helpers. We push analytics events to
// window.dataLayer so GTM can fan them out to GA4, Mixpanel, HubSpot, etc.
// No client-side secrets are used here.

function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const m = document.cookie.match(/(?:^|; )cookieConsent=(true|false)(?:;|$)/);
    return m?.[1] === "true";
  } catch {
    return false;
  }
}

/**
 * Track page view
 * @param path - The page path
 */
export function pageview(path: string): void {
  // Push a GA4-compatible page_view event for SPA route changes
  // should call trackEvent()
  gtmPush({
    event: "page_view",
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : path,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

/**
 * Track a Google Ads conversion event
 * @param eventName - Name of the event
 * @param eventParams - Optional parameters for the event
 */
export const trackEvent = (eventName: string, eventParams?: Record<string, unknown>): void => {
  if (!hasConsent()) return;
  // Emit a first-class GTM event
  gtmPush({ event: eventName, ...(eventParams || {}) });
};

/**
 * Track auth button click
 * @param additionalParams - Optional additional parameters
 */
export const trackAuthClick = (additionalParams?: Record<string, unknown>): void => {
  trackEvent("auth_click", additionalParams);
};
