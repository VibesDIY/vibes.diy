import { useEffect, useState } from "react";

/**
 * Listens for `vibe.evt.tokens-discovered` posts from the sandbox runtime and
 * exposes the running app's `:root` baseline (every CSS custom property it
 * actually declares — canonical and bespoke). The palette picker uses this
 * so the user can edit / remap **every** token the app shipped with, not
 * just the canonical 13 the colorset metadata advertises. Without it,
 * legacy apps with `--gold-base`, `--stone-dark`, etc. wouldn't be reachable
 * from the modal and palette swaps would silently miss those tokens.
 */
export function useIframeCurrentTokens(): Record<string, string> {
  const [tokens, setTokens] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: string; tokens?: Record<string, string> }
        | undefined;
      if (!data || data.type !== "vibe.evt.tokens-discovered") return;
      const next = data.tokens;
      if (!next || typeof next !== "object") return;
      setTokens((prev) => {
        // Skip the state update when the runtime re-published the same
        // baseline (MutationObserver fires on any DOM mutation). Cheap
        // shallow-equal — both maps stay small (< 50 keys typically).
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(next);
        if (prevKeys.length === nextKeys.length) {
          let same = true;
          for (const k of nextKeys) {
            if (prev[k] !== next[k]) {
              same = false;
              break;
            }
          }
          if (same) return prev;
        }
        return next;
      });
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return tokens;
}
