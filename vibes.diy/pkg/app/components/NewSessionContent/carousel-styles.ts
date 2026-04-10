import type { CSSProperties } from "react";

/** Sliding strip transform for carousel animation */
export const getSuggestionsInnerStyle = (offset: number, isAnimating: boolean): CSSProperties => ({
  display: "flex",
  gap: "20px",
  transform: `translateX(${offset}px)`,
  transition: isAnimating ? "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
});

/** Fixed-width button style for carousel items */
export const getButtonStyle = (): CSSProperties => ({
  flexShrink: 0,
  flexGrow: 0,
  minWidth: 0,
});
