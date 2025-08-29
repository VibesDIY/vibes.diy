import ReactGA from "react-ga";
import { VibesDiyEnv } from "../config/env.js";

/**
 * Initialize Google Analytics
 */
export function initGA() {
  if (VibesDiyEnv.GA_TRACKING_ID()) {
    ReactGA.initialize(VibesDiyEnv.GA_TRACKING_ID());
  }
}

/**
 * Track page view
 * @param path - The page path
 */
export function pageview(path: string): void {
  if (VibesDiyEnv.GA_TRACKING_ID()) {
    ReactGA.send({ hitType: "pageview", page: path });
  }
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
  if (VibesDiyEnv.GA_TRACKING_ID()) {
    ReactGA.event({
      category,
      action,
      label,
      value,
    });
  }
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
  // Check if gtag is available (script exists and function is defined)
  if (typeof window === "undefined") return;

  // Check if the script tag exists in the document
  const hasGTagScript = !!document.querySelector(
    'script[src*="googletagmanager.com/gtag/js"]',
  );

  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
  // Check if the gtag function is defined
  const hasGTagFunction = typeof gtag === "function";

  // Only fire the event if both conditions are met (which implies consent was given)
  if (hasGTagScript && hasGTagFunction) {
    gtag("event", eventName, eventParams);
  }
};

/**
 * Track auth button click
 * @param additionalParams - Optional additional parameters
 */
export const trackAuthClick = (
  additionalParams?: Record<string, unknown>,
): void => {
  trackEvent("auth", {
    send_to: VibesDiyEnv.GA_TRACKING_ID(),
    ...additionalParams,
  });
};

/**
 * Track publish button click
 * @param additionalParams - Optional additional parameters
 */
export const trackPublishClick = (
  additionalParams?: Record<string, unknown>,
): void => {
  trackEvent("publish", {
    send_to: VibesDiyEnv.GA_TRACKING_ID(),
    ...additionalParams,
  });
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
  trackEvent("chat", {
    send_to: VibesDiyEnv.GA_TRACKING_ID(),
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
    send_to: VibesDiyEnv.GA_TRACKING_ID(),
    error_type: errorType,
    error_message: message,
    ...details,
  });
};
