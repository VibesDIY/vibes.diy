import { gtmPush } from "./gtm.js";

// Lightweight GTM/dataLayer helpers. We push analytics events to
// window.dataLayer so GTM can fan them out to GA4, Mixpanel, HubSpot, etc.
// No client-side secrets are used here.

type DataLayerEvent = Record<string, unknown> & { event?: string };

export function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const m = document.cookie.match(
      /(?:^|; )cookieConsent=(true|false)(?:;|$)/,
    );
    return m?.[1] === "true";
  } catch {
    return false;
  }
}

/**
 * Initialize Google Analytics
 */
export function initGA() {
  // GA is managed via GTM. Nothing to do here, but keep function
  // to avoid changing call sites.
}

/**
 * Track page view
 * @param path - The page path
 */
export function pageview(path: string): void {
  // Push a GA4-compatible page_view event for SPA route changes
  gtmPush({
    event: "page_view",
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : path,
    page_title: typeof document !== "undefined" ? document.title : undefined,
  });
}

/**
 * Track custom event
 * @param category - Event category
 * @param action - Event action
 * @param label - Event label (optional)
 * @param value - Event value (optional)
 */
export const event = (
  category: string,
  action: string,
  label?: string,
  value?: number,
): void => {
  // Backward-compatible wrapper that emits a generic event for GTM
  const payload: DataLayerEvent = {
    event: action || category,
    event_category: category,
    event_action: action,
  };
  if (label) payload.event_label = label;
  if (typeof value === "number") payload.value = value;
  gtmPush(payload);
};

/**
 * Track a Google Ads conversion event
 * @param eventName - Name of the event
 * @param eventParams - Optional parameters for the event
 */
export const trackEvent = (
  eventName: string,
  eventParams?: Record<string, unknown>,
): void => {
  // Emit a first-class GTM event
  gtmPush({ event: eventName, ...(eventParams || {}) });
};

/**
 * Track auth button click
 * @param additionalParams - Optional additional parameters
 */
export const trackAuthClick = (
  additionalParams?: Record<string, unknown>,
): void => {
  trackEvent("auth_click", additionalParams);
};

/**
 * Track publish button click
 * @param additionalParams - Optional additional parameters
 */
export const trackPublishClick = (
  additionalParams?: Record<string, unknown>,
): void => {
  if (!hasConsent()) return;
  trackEvent("publish_click", additionalParams);
};

/**
 * Track a successful publish (app_shared)
 * @param params - metadata to include with the event (e.g., published_url, session_id, title, user_id, firehose_shared)
 */
export const trackPublishShared = (params?: Record<string, unknown>): void => {
  if (!hasConsent()) return;
  trackEvent("app_shared", params);
};

/**
 * Track ChatInput button click
 * @param messageLength - Length of the message being sent
 * @param additionalParams - Optional additional parameters
 */
export const trackChatInputClick = (
  messageLength: number,
  additionalParams?: Record<string, unknown>,
): void => {
  if (!hasConsent()) return;
  trackEvent("chat_input", {
    message_length: messageLength,
    ...additionalParams,
  });
};

/**
 * Track error event
 * @param errorType - Type of the error
 * @param message - Error message
 * @param details - Optional additional details (object)
 */
export const trackErrorEvent = (
  errorType: string,
  message: string,
  details?: Record<string, unknown>,
): void => {
  trackEvent("error", {
    error_type: errorType,
    error_message: message,
    ...details,
  });
};

/**
 * Identify the current user for downstream tools.
 * We never pass PII – just the stable Fireproof userId.
 */
export function identifyUser(userId: string) {
  if (!userId) return;
  if (!hasConsent()) return;
  gtmPush({ event: "identify", user_id: userId });
}
