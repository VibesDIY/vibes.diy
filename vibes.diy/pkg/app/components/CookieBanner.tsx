import { usePostHog } from "posthog-js/react";
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { VibesDiyEnv } from "../config/env.js";
import { useCookieConsent } from "../contexts/CookieConsentContext.js";
import { pageview, trackEvent } from "../utils/analytics.js";
import { initGTM, persistUtmParams } from "../utils/gtm.js";
import { CookieConsent, getCookieConsentValue } from "react-cookie-consent";

// We'll use any type for dynamic imports to avoid TypeScript errors with the cookie consent component

export default function CookieBanner() {
  const location = useLocation();
  const [hasConsent, setHasConsent] = useState(false);
  const { messageHasBeenSent } = useCookieConsent();
  // Use CSS-based dark mode detection like the rest of the UI
  const isDarkMode =
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true; // Default to dark mode for SSR

  // Dynamic import for client-side only
  const [XCookieConsent, setXCookieConsent] = useState<
    typeof CookieConsent | null
  >(null);
  const [getXCookieConsentValue, setXGetCookieConsentValue] = useState<
    typeof getCookieConsentValue | null
  >(null);

  const posthog = usePostHog();

  // Dark mode is now managed by ThemeContext

  // Load the cookie consent library on client side only
  useEffect(() => {
    import("react-cookie-consent").then((module) => {
      setXCookieConsent(
        () => module.default as unknown as typeof CookieConsent,
      );
      setXGetCookieConsentValue(() => module.getCookieConsentValue);
    });
  }, []);

  // Persist UTM params as early as possible (storage only)
  useEffect(() => {
    persistUtmParams();
  }, []);

  // Check for existing cookie consent
  useEffect(() => {
    if (getXCookieConsentValue) {
      const consentValue = getXCookieConsentValue("cookieConsent");
      if (consentValue === "true") {
        setHasConsent(true);
      }
    }
  }, [getXCookieConsentValue]);

  // Track page views when location changes (only if consent was given)
  useEffect(() => {
    if (hasConsent) {
      pageview(location.pathname + location.search);
    }
  }, [location, hasConsent]);

  // Initialize GTM and clean UTM params if consent is given
  const gtmId = VibesDiyEnv.GTM_CONTAINER_ID();
  useEffect(() => {
    if (gtmId && hasConsent && typeof document !== "undefined") {
      // Opt in to PostHog
      posthog?.opt_in_capturing();

      // Inject GTM (centralized here only)
      initGTM(gtmId);

      if (window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_term",
          "utm_content",
          "fpref",
        ].forEach((k) => url.searchParams.delete(k));
        const searchStr = url.searchParams.toString();
        const newUrl = `${url.pathname}${searchStr ? `?${searchStr}` : ""}${
          url.hash || ""
        }`;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, [hasConsent, gtmId]);

  // Track cookie banner shown (only once per session when actually rendered)
  useEffect(() => {
    // Only track if banner will actually render
    if (!XCookieConsent || !messageHasBeenSent) {
      return;
    }

    if (typeof sessionStorage !== "undefined") {
      if (!sessionStorage.getItem("cookie_banner_shown")) {
        trackEvent("cookie_banner_shown");
        sessionStorage.setItem("cookie_banner_shown", "true");
      }
    }
  }, [XCookieConsent, messageHasBeenSent]);

  // Don't render anything if any of these conditions are met:
  // 1. CookieConsent is not loaded
  // 2. No message has been sent yet
  if (!XCookieConsent || !messageHasBeenSent) return null;

  return (
    <XCookieConsent
      location="bottom"
      buttonText="Accept"
      declineButtonText="Decline"
      cookieName="cookieConsent"
      style={{
        background: isDarkMode ? "#1a1a1a" : "#ffffff",
        color: "#808080",
        boxShadow: isDarkMode
          ? "0 -1px 10px rgba(255, 255, 255, 0.1)"
          : "0 -1px 10px rgba(0, 0, 0, 0.1)",
      }}
      buttonStyle={{
        color: isDarkMode ? "#ffffff" : "#000000",
        backgroundColor: isDarkMode ? "#333333" : "#e0e0e0",
        fontSize: "13px",
        borderRadius: "4px",
        padding: "8px 16px",
      }}
      declineButtonStyle={{
        color: "#808080",
        backgroundColor: "transparent",
        fontSize: "13px",
        border: "1px solid #808080",
        borderRadius: "4px",
        padding: "7px 15px",
      }}
      expires={365}
      enableDeclineButton
      onAccept={() => {
        trackEvent("cookie_accept");
        setHasConsent(true);
      }}
      onDecline={() => {
        trackEvent("cookie_decline");
      }}
    >
      This website uses cookies to enhance the user experience and analyze site
      traffic.
    </XCookieConsent>
  );
}
