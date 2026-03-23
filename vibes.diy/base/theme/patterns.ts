/**
 * Reusable Emotion css() patterns for composing with Tailwind via cx().
 *
 * Usage: import { stripesOverlay, cx } from "@vibes.diy/base"
 *        <button className={cx("p-4 rounded-xl", stripesOverlay)}>
 */

import { css } from "@emotion/css";
import { colors, semantic } from "./tokens.js";

/** Animated loading stripes overlay */
export const stripesOverlay = css`
  position: relative;
  overflow: hidden;
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 12px, transparent 12px, transparent 24px);
    background-size: 40px 40px;
    animation: moving-stripes 1s linear infinite;
  }
  @media (prefers-color-scheme: dark) {
    &::after {
      background-image: repeating-linear-gradient(135deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 12px, transparent 12px, transparent 24px);
    }
  }
`;

/** Grid background pattern */
export const gridBackground = css`
  background-color: ${colors.grayLightest};
  background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  background-attachment: scroll;
  @media (min-width: 768px) {
    background-attachment: fixed;
  }
  @media (prefers-color-scheme: dark) {
    background-color: ${semantic.dark.bg.secondary};
    background-image: linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);
  }
`;
