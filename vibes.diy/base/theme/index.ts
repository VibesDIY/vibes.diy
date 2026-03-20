/**
 * Vibes global CSS — composed from tokens, resets, animations, and utility classes.
 *
 * Consumers call getVibesGlobalCSS() to get a CSS string they can inject
 * via <style> tag (SSR) or injectVibesGlobalStyles() for client-only contexts.
 */

import { css } from "@emotion/css";
import { baseColors, semanticColorsLight, semanticColorsDark } from "./tokens.js";
import { globalResets } from "./global-styles.js";
import { allAnimations } from "./animations.js";
import { utilityClasses, pseudoElements, componentStyles } from "./utility-classes.js";

function varsBlock(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
}

// Use Emotion's css`` to validate syntax during authoring (the class name is unused —
// we only care about the side-effect of composing the string).
const _emotionValidation = css`
  --vibes-validate: 1;
`;
void _emotionValidation;

let cachedCSS: string | undefined;

/**
 * Build the complete global CSS string containing:
 * 1. :root variables (base + semantic light)
 * 2. @media (prefers-color-scheme: dark) overrides
 * 3. Global resets
 * 4. Keyframe animations
 * 5. Utility classes
 * 6. Pseudo-element effects
 * 7. Component styles
 */
export function getVibesGlobalCSS(): string {
  if (cachedCSS) return cachedCSS;

  cachedCSS = [
    `:root {\n${varsBlock(baseColors)}\n${varsBlock(semanticColorsLight)}\n}`,
    `@media (prefers-color-scheme: dark) {\n  :root {\n${varsBlock(semanticColorsDark).replace(/^/gm, "  ")}\n  }\n}`,
    globalResets,
    allAnimations,
    utilityClasses,
    pseudoElements,
    componentStyles,
  ].join("\n\n");

  return cachedCSS;
}

/**
 * Client-side helper: inject global CSS into a <style> tag.
 * Idempotent — skips if already injected.
 */
export function injectVibesGlobalStyles(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-vibes-theme]")) return;

  const style = document.createElement("style");
  style.setAttribute("data-vibes-theme", "");
  style.textContent = getVibesGlobalCSS();
  document.head.appendChild(style);
}
