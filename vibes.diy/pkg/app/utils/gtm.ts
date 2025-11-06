/**
* Minimal GTM helper: injects the GTM bootstrap and exposes a push helper.
* Consent is handled by the caller; do not call initGTM until user has accepted cookies.
*/

export function initGTM(containerId: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!containerId) return;

  // Avoid duplicate injection
  if (document.getElementById("gtm-bootstrap")) return;

  // Create the bootstrap inline script equivalent to the standard snippet
  const inline = document.createElement("script");
  inline.id = "gtm-bootstrap";
  inline.innerHTML = `
    (function(w,d,s,l,i){
      w[l]=w[l]||[];
      w[l].push({'gtm.start': new Date().getTime(), event:'gtm.js'});
      var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='dataLayer'?'&l='+l:'';
      j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
      f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${containerId}');
  `;
  document.head.appendChild(inline);
}

export function gtmPush(obj: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as unknown as Window & { dataLayer?: unknown[] };
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(obj);
}

/**
* Persist UTM parameters to localStorage for GTM/HubSpot usage.
* Call as early as possible (can be before consent) — storage only.
*/
export function persistUtmParams() {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ];
    for (const k of keys) {
      const v = url.searchParams.get(k);
      if (v) localStorage.setItem(k, v);
    }
  } catch {
    // ignore
  }
}
