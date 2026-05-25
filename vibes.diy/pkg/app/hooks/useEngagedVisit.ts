import { useEffect } from "react";
import { trackEvent } from "../utils/analytics.js";

const STORAGE_KEY_FBCLID = "capi_engaged_fbclid";
const STORAGE_KEY_LANDING_URL = "capi_engaged_landing_url";
const STORAGE_KEY_FBC_TS = "capi_engaged_fbc_ts";
const STORAGE_KEY_EVENT_ID = "capi_engaged_event_id";
const STORAGE_KEY_FIRED = "capi_engaged_fired";
const ENGAGE_SCROLL_THRESHOLD = 0.25;
const ENGAGE_DWELL_MS = 10_000;

function getScrollDepth(): number {
  const el = document.documentElement;
  const scrollable = el.scrollHeight - el.clientHeight;
  if (scrollable <= 0) return 1;
  return el.scrollTop / scrollable;
}

async function fireEngagedVisit(fbclid: string, landingUrl: string, fbclidTs: number, eventId: string): Promise<void> {
  trackEvent("engaged_visit");

  const rRes = await fetch("/capi/engaged", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fbclid, landingUrl, fbclidTs, eventId }),
  }).catch(() => undefined);

  if (rRes !== undefined && rRes.ok === false) {
    console.warn("[capi] engaged-visit relay returned", rRes.status);
  }
}

export function useEngagedVisit(): void {
  useEffect(() => {
    if (typeof sessionStorage === "undefined" || typeof window === "undefined") return;

    // Capture fbclid from landing URL on first detection this session
    const rawSearch = window.location.search;
    const params = new URLSearchParams(rawSearch);
    const fbclidFromUrl = params.get("fbclid");
    if (fbclidFromUrl !== null && fbclidFromUrl !== "") {
      sessionStorage.setItem(STORAGE_KEY_FBCLID, fbclidFromUrl);
      sessionStorage.setItem(STORAGE_KEY_LANDING_URL, window.location.href);
      sessionStorage.setItem(STORAGE_KEY_FBC_TS, String(Date.now()));
      sessionStorage.setItem(STORAGE_KEY_EVENT_ID, crypto.randomUUID());
    }

    // Already fired this session — nothing more to do
    if (sessionStorage.getItem(STORAGE_KEY_FIRED) !== null) return;

    const fbclid = sessionStorage.getItem(STORAGE_KEY_FBCLID);
    const landingUrl = sessionStorage.getItem(STORAGE_KEY_LANDING_URL) ?? window.location.href;
    const fbclidTs = parseInt(sessionStorage.getItem(STORAGE_KEY_FBC_TS) ?? "0", 10) || Date.now();
    const eventId = sessionStorage.getItem(STORAGE_KEY_EVENT_ID) ?? crypto.randomUUID();

    let fired = false;

    function trigger(): void {
      if (fired) return;
      fired = true;
      sessionStorage.setItem(STORAGE_KEY_FIRED, "1");
      if (fbclid !== null && fbclid !== "") {
        void fireEngagedVisit(fbclid, landingUrl, fbclidTs, eventId);
      } else {
        trackEvent("engaged_visit");
      }
    }

    const timerId = window.setTimeout(trigger, ENGAGE_DWELL_MS);

    function onScroll(): void {
      if (getScrollDepth() >= ENGAGE_SCROLL_THRESHOLD) {
        trigger();
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);
}
