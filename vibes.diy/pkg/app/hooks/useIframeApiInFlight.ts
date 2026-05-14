import { useEffect, useState } from "react";

/**
 * Tracks whether the embedded vibe iframe's app has any active network
 * work in-flight. The sandbox runtime keeps a single counter for both
 * fetch() calls (via a globalThis.fetch monkey-patch) and bridge RPCs
 * (callAI, imgGen, etc. routed through window.parent.postMessage), and
 * emits `vibe.evt.network.active` when the counter is non-zero or
 * `vibe.evt.network.idle` when it returns to 0. This hook listens for
 * those on the parent window.
 */
export function useIframeApiInFlight(): boolean {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } | undefined;
      if (!data || typeof data.type !== "string") return;
      if (data.type === "vibe.evt.network.active") setIsActive(true);
      else if (data.type === "vibe.evt.network.idle") setIsActive(false);
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return isActive;
}
