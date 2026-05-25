import { useEffect } from "react";
import { useUser } from "@clerk/react";

const STORAGE_KEY_FBCLID = "capi_engaged_fbclid";
const STORAGE_KEY_CR_FIRED = "capi_cr_fired";
const NEW_USER_WINDOW_MS = 120_000;

async function fireCompleteRegistration(fbclid: string, email: string): Promise<void> {
  const rRes = await fetch("/capi/complete-registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fbclid, email }),
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

    const createdAt = user.createdAt?.getTime() ?? 0;
    if (Date.now() - createdAt > NEW_USER_WINDOW_MS) return;

    const email = user.primaryEmailAddress?.emailAddress;
    if (email === undefined || email === "") return;

    sessionStorage.setItem(STORAGE_KEY_CR_FIRED, "1");
    void fireCompleteRegistration(fbclid, email);
  }, [isLoaded, user]);
}
