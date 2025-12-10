/**
 * Global CSS Styles - Orchestrator
 *
 * Combines all CSS modules for server-side injection via <style> tag in index.tsx
 * This ensures CSS loads BEFORE app.css, providing base styles for SSR.
 *
 * Architecture:
 * 1. CSS Variables - from colors.css (single source of truth)
 * 2. Global Resets - HTML/body base styles
 * 3. Keyframe Animations - @keyframes for UI animations
 * 4. Tailwind Utilities - Generated utility classes
 * 5. Pseudo Elements - Complex ::before/::after classes
 * 6. Component Styles - Component-specific CSS
 *
 * @see ./modules/ for individual CSS module implementations
 */

import { cssVariables } from "./modules/css-variables.js";
import { globalResets } from "./modules/global-resets.js";
import { keyframeAnimations } from "./modules/keyframe-animations.js";
import { tailwindUtilities } from "./modules/tailwind-utilities.js";
import { pseudoElements } from "./modules/pseudo-elements.js";
import { componentStyles } from "./modules/component-styles.js";

export const globalStylesCSS = `
/* ============================================
   VIBES.DIY GLOBAL STYLES
   Server-side injected CSS for SSR compatibility
   Generated from modular TypeScript CSS modules
   ============================================ */

${cssVariables}

${globalResets}

${keyframeAnimations}

${tailwindUtilities}

${pseudoElements}

${componentStyles}
`.trim();
