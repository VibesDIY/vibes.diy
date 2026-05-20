export const LP_REF_KEY = "lp_ref";
export const LP_SESSION_START_KEY = "lp_session_start";

export function captureLpRef(): void {
  if (typeof document === "undefined") return;
  try {
    if (document.referrer && document.referrer.includes("good.vibes.diy")) {
      sessionStorage.setItem(LP_REF_KEY, new URL(document.referrer).pathname);
      sessionStorage.setItem(LP_SESSION_START_KEY, Date.now().toString());
    }
  } catch {
    // sessionStorage unavailable (private mode, cross-origin iframe, etc.)
  }
}

export function getLpRef(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    return sessionStorage.getItem(LP_REF_KEY);
  } catch {
    return null;
  }
}

export function getLpSessionStart(): number | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const val = sessionStorage.getItem(LP_SESSION_START_KEY);
    return val ? parseInt(val, 10) : null;
  } catch {
    return null;
  }
}
