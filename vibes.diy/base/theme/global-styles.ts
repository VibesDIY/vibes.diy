/**
 * Global styles assembled into a CSS string by theme/index.ts.
 *
 * Organized by concern so designers can find what they need:
 *   1. Keyframe animations
 *   2. Document resets (html/body)
 *   3. Dark mode body overrides
 *   4. Element defaults (buttons, inputs, links)
 *   5. Scrollbar styling
 *   6. Selection & focus
 *   7. Neo-brutalist select
 *   8. Mobile overrides
 *   9. Animation utilities
 *  10. Color utilities (accent, decorative, background)
 *  11. Gradient & logo effects
 *  12. Typography (ai-markdown)
 *  13. Background patterns (grid, page-grid)
 *  14. Login button
 */

import { generateCSSVariables } from "./css-vars.js";

/* ═══════════════════════════════════════════
   1. KEYFRAME ANIMATIONS
   ═══════════════════════════════════════════ */

const keyframes = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes bounceIn {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes buttonGlimmer {
  0% { background-position: -100% 0; }
  100% { background-position: 200% 0; }
}
@keyframes gradientGlimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
@keyframes pulse {
  0% { transform: rotate(-5deg) scale(1); }
  50% { transform: rotate(0deg) scale(1.05); }
  100% { transform: rotate(-5deg) scale(1); }
}
@keyframes logo-rotate {
  0% { transform: rotate(45deg) scale(5.5); }
  66% { transform: rotate(0deg) scale(1); }
  100% { transform: rotate(45deg) scale(5.5); }
}
@keyframes logo-pulse-height {
  0% { width: 200%; }
  50% { width: 20%; }
  100% { width: 200%; }
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
   2–3. DOCUMENT RESETS & DARK MODE
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
  background-color: var(--color-light-background-00);
  color: var(--color-light-primary);
}

@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; }
  body {
    color-scheme: dark;
    background-color: var(--color-dark-background-00);
    color: var(--color-dark-primary);
  }
  html, body {
    background-color: var(--color-dark-background-00);
    color: var(--color-dark-primary);
  }
}

@supports (-webkit-touch-callout: none) {
  @media (prefers-color-scheme: dark) {
    html, body {
      background-color: var(--color-dark-background-00);
      color: var(--color-dark-primary);
    }
  }
}

hr { opacity: 0.5; }
#root { height: 100%; }
`;

/* ═══════════════════════════════════════════
   4. ELEMENT DEFAULTS
   ═══════════════════════════════════════════ */

const elementDefaults = `
button { font-family: inherit; }
input, textarea, select { font-size: 16px; }
button, a, [role="button"], [type="button"], [type="submit"], [type="reset"] { cursor: pointer; }
.light { --sp-layout-height: 100vh !important; }
`;

/* ═══════════════════════════════════════════
   5. SCROLLBAR STYLING
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
   6. SELECTION & FOCUS
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
   7. NEO-BRUTALIST SELECT
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
   8. MOBILE OVERRIDES
   ═══════════════════════════════════════════ */

const mobileOverrides = `
@media (max-width: 639px) {
  input, select, textarea { font-size: 16px !important; }
  textarea.code-editor { font-size: 14px !important; }
}
`;

/* ═══════════════════════════════════════════
   9. ANIMATION UTILITIES
   ═══════════════════════════════════════════ */

const animationUtilities = `
.animate-fade-in { animation: fadeIn 0.3s ease-in-out forwards; }
.animate-bounce-in { animation: bounceIn 0.5s ease-out forwards; }
.animate-gradient-x { background-size: 200% auto; animation: gradient-x 3s linear infinite; }
`;

/* ═══════════════════════════════════════════
   10. COLOR UTILITIES (accent, decorative, bg)
   ═══════════════════════════════════════════ */

const colorUtilities = `
.accent-00 { background-color: var(--color-accent-00-light); }
@media (prefers-color-scheme: dark) { .accent-00 { background-color: var(--color-accent-00-dark); } }
.accent-01 { background-color: var(--color-accent-01-light); }
@media (prefers-color-scheme: dark) { .accent-01 { background-color: var(--color-accent-01-dark); } }
.accent-02 { background-color: var(--color-accent-02-light); }
@media (prefers-color-scheme: dark) { .accent-02 { background-color: var(--color-accent-02-dark); } }
.accent-03 { background-color: var(--color-accent-03-light); }
@media (prefers-color-scheme: dark) { .accent-03 { background-color: var(--color-accent-03-dark); } }

.text-accent-00 { color: var(--color-accent-00-light); }
@media (prefers-color-scheme: dark) { .text-accent-00 { color: var(--color-accent-00-dark); } }
.text-accent-01 { color: var(--color-accent-01-light); }
@media (prefers-color-scheme: dark) { .text-accent-01 { color: var(--color-accent-01-dark); } }
.text-accent-02 { color: var(--color-accent-02-light); }
@media (prefers-color-scheme: dark) { .text-accent-02 { color: var(--color-accent-02-dark); } }
.text-accent-03 { color: var(--color-accent-03-light); }
@media (prefers-color-scheme: dark) { .text-accent-03 { color: var(--color-accent-03-dark); } }

.decorative-00 { background-color: var(--color-light-decorative-00); }
@media (prefers-color-scheme: dark) { .decorative-00 { background-color: var(--color-dark-decorative-00); } }
.decorative-01 { background-color: var(--color-light-decorative-01); }
@media (prefers-color-scheme: dark) { .decorative-01 { background-color: var(--color-dark-decorative-01); } }
.decorative-02 { background-color: var(--color-light-decorative-02); }
@media (prefers-color-scheme: dark) { .decorative-02 { background-color: var(--color-dark-decorative-02); } }

.bg-primary { background-color: var(--color-light-background-00); }
@media (prefers-color-scheme: dark) { .bg-primary { background-color: var(--color-dark-background-00); } }
.bg-secondary { background-color: var(--color-light-background-01); }
@media (prefers-color-scheme: dark) { .bg-secondary { background-color: var(--color-dark-background-01); } }
.bg-tertiary { background-color: var(--color-light-background-02); }
@media (prefers-color-scheme: dark) { .bg-tertiary { background-color: var(--color-dark-background-02); } }
`;

/* ═══════════════════════════════════════════
   11. GRADIENT & LOGO EFFECTS
   ═══════════════════════════════════════════ */

const gradientAndLogo = `
.light-gradient { background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,1) 45%, white 89%); }
@media (prefers-color-scheme: dark) { .light-gradient { background: linear-gradient(110deg, transparent 0%, rgba(0,0,0,1) 45%, black 89%); } }

.pulsing { width: 100%; height: auto; transform: rotate(-5deg) scale(6); animation: pulse 8s infinite; }
.logo-pulse { transform: rotate(-5deg) scale(3); animation: logo-rotate 1410s ease-in-out infinite, logo-pulse-height 711s ease-in-out infinite; }
`;

/* ═══════════════════════════════════════════
   12. TYPOGRAPHY (ai-markdown)
   ═══════════════════════════════════════════ */

const typography = `
.ai-markdown p { margin-bottom: 0.5rem; }
.ai-markdown ul { list-style-type: disc; padding-left: 1rem; padding-top: 0.5rem; }
.ai-markdown ol { list-style-type: decimal; padding-left: 1rem; padding-top: 0.5rem; }
.ai-markdown li { margin-bottom: 0.5rem; }
.ai-markdown h1 { font-size: 1.5rem; font-weight: 700; margin-top: 1rem; margin-bottom: 1rem; }
.ai-markdown h2 { font-size: 1.3rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.75rem; }
.ai-markdown h3 { font-size: 1.15rem; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.5rem; }
`;

/* ═══════════════════════════════════════════
   13. BACKGROUND PATTERNS
   ═══════════════════════════════════════════ */

const backgroundPatterns = `
.page-grid-background {}
body:has(.page-grid-background) {
  background-color: #d4d4d4;
  background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  background-attachment: scroll;
}
@media (min-width: 768px) { body:has(.page-grid-background) { background-attachment: fixed; } }
@media (prefers-color-scheme: dark) {
  body:has(.page-grid-background) {
    background-color: #2a2a2a;
    background-image: linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);
  }
}
`;

/* ═══════════════════════════════════════════
   14. LOGIN BUTTON
   ═══════════════════════════════════════════ */

const loginButton = `
.vibes-login-button {
  width: 100%; padding: 1rem 2rem;
  background: var(--color-light-background-00); color: var(--color-light-primary);
  border: 3px solid var(--color-light-primary); border-radius: 12px;
  font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
  cursor: pointer; transition: all 0.15s ease; position: relative;
  transform: translate(0px, 0px); box-shadow: 4px 5px 0px 0px #009ace;
}
.vibes-login-button:hover { transform: translate(2px, 2px); box-shadow: 2px 3px 0px 0px #009ace; }
.vibes-login-button:active { transform: translate(4px, 5px); box-shadow: none; }
.vibes-login-button:focus-visible { outline: 3px solid #009ace; outline-offset: 4px; }
@media (prefers-color-scheme: dark) {
  .vibes-login-button { background: var(--color-dark-background-00); color: var(--color-dark-primary); border-color: var(--color-dark-primary); }
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
    colorUtilities,
    gradientAndLogo,
    typography,
    backgroundPatterns,
    loginButton,
  ].join("\n\n");
}
