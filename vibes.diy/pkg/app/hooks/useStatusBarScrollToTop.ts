import { useEffect } from "react";
import type { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";

// iPadOS ≥13 reports platform "MacIntel"; maxTouchPoints separates it from real Macs.
function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Relay the iOS "tap the status bar to scroll to top" gesture into the vibe
 * iframe. WebKit only delivers that gesture to the MAIN frame's scroller —
 * never to a cross-origin subframe — and the vibe runs in exactly that: a
 * position:fixed cross-origin iframe covering the viewport, leaving the
 * parent document with nothing to scroll and the app unreachable.
 *
 * The trick: give the parent document 1px of scrollable overflow (a hidden
 * sentinel taller than the viewport) and park it at scrollTop = 1. The fixed
 * iframe swallows every touch, so the user can never move the parent scroll
 * themselves — the only thing that can drive it to 0 is the native status-bar
 * tap. When that 1 → 0 transition fires, forward a scroll-to-top message to
 * the iframe runtime and re-park.
 *
 * Invisible by construction: the sentinel is visibility:hidden +
 * pointer-events:none behind the fixed iframe, and fixed elements don't move
 * with parent scroll, so the 1px park never paints. iOS-only so desktop
 * browsers with visible scrollbars never grow a scrollbar gutter.
 */
export function useStatusBarScrollToTop(srvVibeSandbox: vibesDiySrvSandbox | undefined): void {
  useEffect(() => {
    if (!srvVibeSandbox || !isIOS()) return;

    const sentinel = document.createElement("div");
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.cssText = "position:absolute;top:0;left:0;width:1px;visibility:hidden;pointer-events:none;";
    // lvh (viewport with the URL bar collapsed) guarantees overflow in every
    // URL-bar state; the vh line is the fallback for pre-15.4 WebKit, where
    // the feature degrades to inert (no overflow → no relay) rather than
    // breaking anything.
    sentinel.style.height = "calc(100vh + 2px)";
    sentinel.style.height = "calc(100lvh + 2px)";
    document.body.appendChild(sentinel);

    // Parking is programmatic scrolling — ignore the scroll events it echoes
    // so re-parking at 1 can't be mistaken for another status-bar tap.
    let parking = false;
    const park = (): void => {
      parking = true;
      window.scrollTo(0, 1);
      requestAnimationFrame(() => {
        parking = false;
      });
    };
    const onScroll = (): void => {
      if (parking) return;
      if (window.scrollY <= 0) {
        // The srv-sandbox Lazy yields a bare {} during SSR bootstrap, so the
        // method can be absent even though the type says otherwise.
        srvVibeSandbox.pushScrollToTop?.();
        park();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    park();

    return () => {
      window.removeEventListener("scroll", onScroll);
      sentinel.remove();
      window.scrollTo(0, 0);
    };
  }, [srvVibeSandbox]);
}
