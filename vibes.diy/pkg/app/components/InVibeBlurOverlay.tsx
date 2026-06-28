import React from "react";

/** De-blur overlay layered over the /vibe iframe during an in-place generation.
 *  Lifted from PreviewApp's stream overlay (backdropFilter blur ramp → faint
 *  moving-stripes once the ramp decays). Pointer-events block interaction with a
 *  half-rendered app while it forms. */
export function InVibeBlurOverlay({ active, blurPx }: { readonly active: boolean; readonly blurPx: number }) {
  if (!active) return null;
  const blurStr = blurPx.toPrecision(3);
  const blurred = blurPx >= 0.01;
  return (
    <div
      aria-hidden="true"
      data-testid="in-vibe-blur-overlay"
      className="pointer-events-auto absolute inset-0"
      style={
        blurred
          ? { backdropFilter: `blur(${blurStr}px)`, WebkitBackdropFilter: `blur(${blurStr}px)` }
          : {
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 12px, transparent 12px, transparent 24px)",
              backgroundSize: "40px 40px",
              animation: "moving-stripes 1s linear infinite",
            }
      }
    />
  );
}

export default InVibeBlurOverlay;
