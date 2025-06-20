import { usePostHog } from 'posthog-js/react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { GA_TRACKING_ID } from '../config/env';
import { useCookieConsent } from '../contexts/CookieConsentContext';
import { useTheme } from '../contexts/ThemeContext';
import { initGA, pageview } from '../utils/analytics';

// We'll use any type for dynamic imports to avoid TypeScript errors with the cookie consent component

export default function CookieBanner() {
  const location = useLocation();
  const [hasConsent, setHasConsent] = useState(false);
  const { messageHasBeenSent } = useCookieConsent();
  const { isDarkMode } = useTheme();

  // Dynamic import for client-side only
  const [CookieConsent, setCookieConsent] = useState<any>(null);
  const [getCookieConsentValue, setGetCookieConsentValue] = useState<any>(null);

  const posthog = usePostHog();

  // Dark mode is now managed by ThemeContext

  // Load the cookie consent library on client side only
  useEffect(() => {
    import('react-cookie-consent').then((module) => {
      setCookieConsent(() => module.default);
      setGetCookieConsentValue(() => module.getCookieConsentValue);
    });
  }, []);

  // Check for existing cookie consent
  useEffect(() => {
    if (getCookieConsentValue) {
      const consentValue = getCookieConsentValue('cookieConsent');
      if (consentValue === 'true') {
        setHasConsent(true);
        initGA();
      }
    }
  }, [getCookieConsentValue]);

  // Track page views when location changes (only if consent was given)
  useEffect(() => {
    if (hasConsent) {
      pageview(location.pathname + location.search);
    }
  }, [location, hasConsent]);

  // Add GA script if consent is given
  useEffect(() => {
    if (GA_TRACKING_ID && hasConsent && typeof document !== 'undefined') {
      // Opt in to PostHog
      posthog?.opt_in_capturing();

      // Add GA script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
      document.head.appendChild(script);

      // Define window.dataLayer with proper TypeScript type
      interface WindowWithDataLayer extends Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
      }

      const windowWithDataLayer = window as unknown as WindowWithDataLayer;
      windowWithDataLayer.dataLayer = windowWithDataLayer.dataLayer || [];

      function gtag(...args: any[]) {
        windowWithDataLayer.dataLayer.push(arguments);
      }

      windowWithDataLayer.gtag = gtag;
      gtag('js', new Date());
      gtag('config', GA_TRACKING_ID);

      if (window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('utm_source');
        url.searchParams.delete('utm_medium');
        url.searchParams.delete('utm_campaign');
        window.history.replaceState({}, document.title, url.pathname + url.hash);
      }
    }
  }, [hasConsent, GA_TRACKING_ID]);

  // Don't render anything if any of these conditions are met:
  // 1. CookieConsent is not loaded
  // 2. No message has been sent yet
  // 3. Google Analytics ID is not set (making analytics optional)
  if (!CookieConsent || !messageHasBeenSent || !GA_TRACKING_ID) return null;

  return (
    <CookieConsent
      location="bottom"
      buttonText="Accept"
      declineButtonText="Decline"
      cookieName="cookieConsent"
      style={{
        background: isDarkMode ? '#1a1a1a' : '#ffffff',
        color: '#808080',
        boxShadow: isDarkMode
          ? '0 -1px 10px rgba(255, 255, 255, 0.1)'
          : '0 -1px 10px rgba(0, 0, 0, 0.1)',
      }}
      buttonStyle={{
        color: isDarkMode ? '#ffffff' : '#000000',
        backgroundColor: isDarkMode ? '#333333' : '#e0e0e0',
        fontSize: '13px',
        borderRadius: '4px',
        padding: '8px 16px',
      }}
      declineButtonStyle={{
        color: '#808080',
        backgroundColor: 'transparent',
        fontSize: '13px',
        border: '1px solid #808080',
        borderRadius: '4px',
        padding: '7px 15px',
      }}
      expires={365}
      enableDeclineButton
      onAccept={() => {
        setHasConsent(true);
        initGA();
        pageview(location.pathname + location.search);
      }}
    >
      This website uses cookies to enhance the user experience and analyze site traffic.
    </CookieConsent>
  );
}
