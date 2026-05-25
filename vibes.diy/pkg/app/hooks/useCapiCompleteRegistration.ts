import { useEffect } from "react";
import { useUser } from "@clerk/react";

const STORAGE_KEY_FBCLID = "capi_engaged_fbclid";
const STORAGE_KEY_FBC_TS = "capi_engaged_fbc_ts";
const STORAGE_KEY_LANDING_URL = "capi_engaged_landing_url";
const STORAGE_KEY_CR_FIRED = "capi_cr_fired";
const NEW_USER_WINDOW_MS = 120_000;

async function fireCompleteRegistration(fbclid: string, fbclidTs: number, landingUrl: string): Promise<void> {
  const rRes = await fetch("/capi/complete-registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fbclid, fbclidTs, landingUrl }),
  }).catch(() => undefined);

  if (rRes !== undefined && rRes.ok === false) {
    console.warn("[capi] complete-registration relay returned", rRes.status);
  }
}

export function useCapiCompleteRegistration(): void {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || user == null) return;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY_CR_FIRED) !== null) return;

    const fbclid = sessionStorage.getItem(STORAGE_KEY_FBCLID);
    if (fbclid === null || fbclid === "") return;

    const createdAt = user.createdAt?.getTime() ?? Date.now();
    if (Date.now() - createdAt > NEW_USER_WINDOW_MS) return;

    const fbclidTs = parseInt(sessionStorage.getItem(STORAGE_KEY_FBC_TS) ?? "0", 10) || Date.now();
    const landingUrl = sessionStorage.getItem(STORAGE_KEY_LANDING_URL) ?? window.location.href;

    sessionStorage.setItem(STORAGE_KEY_CR_FIRED, "1");
    void fireCompleteRegistration(fbclid, fbclidTs, landingUrl);
  }, [isLoaded, user]);
}
