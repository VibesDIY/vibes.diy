/**
 * Minimal GTM helper: injects the GTM bootstrap and exposes a push helper.
 * Consent is handled by the caller; do not call initGTM until user has accepted cookies.
 */

export function initGTM(containerId: string) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !containerId
  )
    return;

  // Avoid duplicate injection
  if (document.getElementById("gtm-src")) return;

  // Initialize dataLayer and signal gtm.js without inline code
  const w = window as unknown as Window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const s = document.createElement("script");
  s.id = "gtm-src";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${containerId}`;
  document.head.appendChild(s);
}

export function gtmPush(obj: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as Window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(obj);
}
