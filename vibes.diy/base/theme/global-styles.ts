/**
 * Global styles assembled into a CSS string by theme/index.ts.
 *
 * Organized by concern:
 *   1. Keyframe animations
 *   2. Document resets & dark mode
 *   3. Element defaults
 *   4. Scrollbar styling
 *   5. Selection & focus
 *   6. Neo-brutalist select
 *   7. Mobile overrides
 *   8. Animation utilities
 *   9. Background patterns
 */

import { generateCSSVariables } from "./css-vars.js";
import { colors, semantic } from "./tokens.js";

/* ═══════════════════════════════════════════
   1. KEYFRAME ANIMATIONS
   ═══════════════════════════════════════════ */

const keyframes = `
@keyframes buttonGlimmer {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}
@keyframes gradientGlimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes gradient-x {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes moving-stripes {
  0% { background-position: 0 0; }
  100% { background-position: 40px 0; }
}
@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

/* ═══════════════════════════════════════════
   2. DOCUMENT RESETS & DARK MODE
   ═══════════════════════════════════════════ */

const documentResets = `
html { margin: 0; padding: 0; }

body {
  margin: 0;
  padding: 0;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  width: 100%;
  height: 100%;
  background-color: var(--vibes-bg-primary);
  color: var(--vibes-text-primary);
}

@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; }
  body {
    color-scheme: dark;
    background-color: var(--vibes-bg-primary);
    color: var(--vibes-text-primary);
  }
  html, body {
    background-color: var(--vibes-bg-primary);
    color: var(--vibes-text-primary);
  }
}

@supports (-webkit-touch-callout: none) {
  @media (prefers-color-scheme: dark) {
    html, body {
      background-color: var(--vibes-bg-primary);
      color: var(--vibes-text-primary);
    }
  }
}

hr { opacity: 0.5; }
#root { height: 100%; }
`;

/* ═══════════════════════════════════════════
   3. ELEMENT DEFAULTS
   ═══════════════════════════════════════════ */

const elementDefaults = `
button { font-family: inherit; }
input, textarea, select { font-size: 16px; }
button, a, [role="button"], [type="button"], [type="submit"], [type="reset"] { cursor: pointer; }
`;

/* ═══════════════════════════════════════════
   4. SCROLLBAR STYLING
   ═══════════════════════════════════════════ */

const scrollbarStyles = `
* {
  box-sizing: border-box;
  scrollbar-width: thin;
  scrollbar-color: var(--vibes-border-primary) transparent;
  -webkit-tap-highlight-color: transparent;
}

html, body { touch-action: manipulation; }

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-thumb { background: var(--vibes-border-primary); border-radius: 3px; }
::-webkit-scrollbar-track { background: transparent; }
`;

/* ═══════════════════════════════════════════
   5. SELECTION & FOCUS
   ═══════════════════════════════════════════ */

const selectionAndFocus = `
::selection {
  background: color-mix(in srgb, var(--vibes-blue) 30%, transparent);
  color: var(--vibes-text-primary);
}

:focus-visible { outline: 2px solid var(--vibes-blue); outline-offset: 2px; }
button:disabled { pointer-events: none; opacity: 0.5; }
`;

/* ═══════════════════════════════════════════
   6. NEO-BRUTALIST SELECT
   ═══════════════════════════════════════════ */

const selectStyles = `
select {
  appearance: none;
  border: 2px solid var(--vibes-border-primary);
  border-radius: 5px;
  box-shadow: 2px 2px 0px 0px var(--vibes-border-primary);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  padding-right: 22px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
select:active { transform: translate(2px, 2px); box-shadow: none; }
`;

/* ═══════════════════════════════════════════
   7. MOBILE OVERRIDES
   ═══════════════════════════════════════════ */

const mobileOverrides = `
@media (max-width: 639px) {
  input, select, textarea { font-size: 16px !important; }
  textarea.code-editor { font-size: 14px !important; }
}
`;

/* ═══════════════════════════════════════════
   8. ANIMATION UTILITIES
   ═══════════════════════════════════════════ */

const animationUtilities = `
.animate-gradient-x { background-size: 200% auto; animation: gradient-x 3s linear infinite; }
`;

/* ═══════════════════════════════════════════
   9. BACKGROUND PATTERNS
   ═══════════════════════════════════════════ */

const backgroundPatterns = `
.page-grid-background {}
body:has(.page-grid-background) {
  background-color: ${colors.grayLightest};
  background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  background-attachment: scroll;
}
@media (min-width: 768px) { body:has(.page-grid-background) { background-attachment: fixed; } }
@media (prefers-color-scheme: dark) {
  body:has(.page-grid-background) {
    background-color: ${semantic.dark.bg.secondary};
    background-image: linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);
  }
}
`;

/* ═══════════════════════════════════════════
   ASSEMBLY
   ═══════════════════════════════════════════ */

/**
 * Build the complete global CSS string.
 */
export function buildGlobalCSS(): string {
  return [
    generateCSSVariables(),
    keyframes,
    documentResets,
    elementDefaults,
    scrollbarStyles,
    selectionAndFocus,
    selectStyles,
    mobileOverrides,
    animationUtilities,
    backgroundPatterns,
  ].join("\n\n");
}
