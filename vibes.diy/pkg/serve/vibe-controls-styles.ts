/**
 * Vibe Controls Styles - Server-Side Rendered CSS
 *
 * Pure CSS extracted from React style functions for SSR vibe controls.
 * This CSS is injected inline via <style> tag for self-contained styling.
 *
 * Sources:
 * - VibesSwitch.styles.ts → Switch colors, SVG transitions
 * - VibesButton.styles.ts → Button variants, hover states, bounce animation
 * - VibesPanel.styles.ts → Panel layout, button containers
 * - BrutalistCard.styles.ts → Card borders, shadows, sizing
 */

export const vibeControlsCSS = `
/* ============================================
   VIBE CONTROLS - SERVER-SIDE RENDERED STYLES
   ============================================ */

/* Grid background on body when panel is open (matches .grid-background) */
body:has([data-vibe-controls-container] [data-vibe-switch].active) {
  background-color: #d4d4d4;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  background-attachment: scroll;
  transition: background-color 0.3s ease, background-image 0.3s ease;
}

@media (min-width: 768px) {
  body:has([data-vibe-controls-container] [data-vibe-switch].active) {
    background-attachment: fixed;
  }
}

@media (prefers-color-scheme: dark) {
  body:has([data-vibe-controls-container] [data-vibe-switch].active) {
    background-color: #2a2a2a;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px);
  }
}

/* App mount blur and shift when panel is open */
body:has([data-vibe-controls-container] [data-vibe-switch].active) #vibes\\.diy {
  filter: blur(4px);
  transform: translateY(-400px);
  transition: filter 0.3s ease, transform 0.3s ease;
  pointer-events: none;
}

#vibes\\.diy {
  transition: filter 0.3s ease, transform 0.3s ease;
}

/* Container - Fixed position lower right */
[data-vibe-controls-container] {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
  gap: 12px;
}

/* ============================================
   VIBES SWITCH (SVG Toggle Button)
   ============================================ */

[data-vibe-switch] {
  width: 160px;
  height: 80px;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0;
  transform: scale(1);
  transition: transform 0.15s ease;
}

[data-vibe-switch]:hover {
  transform: scale(1.05);
}

[data-vibe-switch]:active {
  transform: scale(0.95);
}

/* SVG paths with transitions */
[data-vibe-switch] svg path {
  transition: d 0.3s ease, transform 0.8s ease, fill 2s ease;
}

/* Morphing path - changes shape when active */
/* Default (closed): stretched oval on left (under "VIBES") with translate */
[data-vibe-switch] svg path.morphing {
  /* stretchedD path in JSX by default */
  transform: translateX(3px);
}

/* Active (open): circular shape on right (under "DIY"), no translate */
/* When panel opens, the path needs to be swapped via JavaScript to originalD */
[data-vibe-switch].active svg path.morphing {
  transform: none;
}

/* Logo letter colors - transition on toggle */
/* VIBES letters (logo-vibes) - start black, turn white when active */
[data-vibe-switch] svg path.logo-vibes {
  fill: var(--vibes-black);
  transition: fill 1s ease;
}

[data-vibe-switch].active svg path.logo-vibes {
  fill: var(--vibes-white);
}

/* DIY letters (logo-diy) - start white, turn black when active */
[data-vibe-switch] svg path.logo-diy {
  fill: var(--vibes-white);
  transition: fill 1s ease;
}

[data-vibe-switch].active svg path.logo-diy {
  fill: var(--vibes-black);
}

/* ============================================
   VIBES PANEL (Settings Panel)
   ============================================ */

[data-vibe-panel] {
  background: var(--vibes-card-bg);
  border: 3px solid var(--vibes-card-border);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-shadow: 8px 10px 0px 0px var(--vibes-shadow-color);
  max-width: 500px;
  min-width: 300px;
  color: var(--vibes-card-text);
}

[data-vibe-panel][data-panel-hidden] {
  display: none;
}

/* Panel animation on show */
@keyframes vibe-panel-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

[data-vibe-panel]:not([data-panel-hidden]) {
  animation: vibe-panel-slide-in 0.3s ease;
}

/* Panel mode containers */
[data-panel-mode] {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

[data-panel-mode][data-mode-hidden] {
  display: none;
}

/* Button container within modes */
[data-panel-mode] > div {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

/* ============================================
   BUTTONS (Brutalist Style)
   ============================================ */

[data-vibe-panel] button {
  background: var(--vibes-button-bg);
  color: var(--vibes-button-text);
  border: 2px solid var(--vibes-button-border);
  border-radius: 12px;
  padding: 1rem 2rem;
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  transform: translate(0px, 0px);
  min-width: 120px;
}

/* Default button shadow */
[data-vibe-panel] button {
  box-shadow: 8px 10px 0px 0px var(--vibes-variant-blue),
              8px 10px 0px 2px var(--vibes-button-border);
}

/* Button variants */
[data-vibe-panel] button[data-variant="blue"] {
  box-shadow: 8px 10px 0px 0px var(--vibes-variant-blue),
              8px 10px 0px 2px var(--vibes-button-border);
}

[data-vibe-panel] button[data-variant="red"] {
  box-shadow: 8px 10px 0px 0px var(--vibes-variant-red),
              8px 10px 0px 2px var(--vibes-button-border);
}

[data-vibe-panel] button[data-variant="yellow"] {
  box-shadow: 8px 10px 0px 0px var(--vibes-variant-yellow),
              8px 10px 0px 2px var(--vibes-button-border);
}

[data-vibe-panel] button[data-variant="gray"] {
  box-shadow: 8px 10px 0px 0px var(--vibes-variant-gray),
              8px 10px 0px 2px var(--vibes-button-border);
}

/* Button hover states */
[data-vibe-panel] button:hover {
  transform: translate(2px, 2px);
}

[data-vibe-panel] button[data-variant="blue"]:hover {
  box-shadow: 2px 3px 0px 0px var(--vibes-variant-blue),
              2px 3px 0px 2px var(--vibes-button-border);
}

[data-vibe-panel] button[data-variant="red"]:hover {
  box-shadow: 2px 3px 0px 0px var(--vibes-variant-red),
              2px 3px 0px 2px var(--vibes-button-border);
}

[data-vibe-panel] button[data-variant="yellow"]:hover {
  box-shadow: 2px 3px 0px 0px var(--vibes-variant-yellow),
              2px 3px 0px 2px var(--vibes-button-border);
}

[data-vibe-panel] button[data-variant="gray"]:hover {
  box-shadow: 2px 3px 0px 0px var(--vibes-variant-gray),
              2px 3px 0px 2px var(--vibes-button-border);
}

/* Button active (pressed) states */
[data-vibe-panel] button:active {
  transform: translate(4px, 5px);
  box-shadow: none;
}

/* Button disabled state */
[data-vibe-panel] button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: translate(0px, 0px);
}

/* ============================================
   INVITE FORM
   ============================================ */

[data-invite-form] {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

[data-invite-form] label {
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

[data-invite-form] input[type="email"] {
  width: 100%;
  padding: 12px 16px;
  border: 3px solid var(--vibes-card-border);
  border-radius: 8px;
  background: var(--vibes-card-bg);
  color: var(--vibes-card-text);
  font-size: 1rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  box-shadow: 2px 3px 0px 0px var(--vibes-shadow-color);
  transition: all 0.15s ease;
}

[data-invite-form] input[type="email"]:focus {
  outline: none;
  border-color: var(--vibes-variant-blue);
  box-shadow: 4px 5px 0px 0px var(--vibes-variant-blue);
}

[data-invite-form] input[type="email"]::placeholder {
  color: var(--vibes-card-text);
  opacity: 0.5;
}

/* Invite status display */
[data-invite-status] {
  padding: 16px;
  border: 3px solid var(--vibes-card-border);
  border-radius: 12px;
  text-align: center;
  background: var(--vibes-card-bg);
  box-shadow: 2px 3px 0px 0px var(--vibes-shadow-color);
  font-weight: 500;
  letter-spacing: 0.02em;
}

[data-invite-status].success {
  background: rgba(220, 255, 220, 0.8);
  border-color: var(--vibes-green);
  box-shadow: 2px 3px 0px 0px var(--vibes-green);
}

[data-invite-status].error {
  background: rgba(255, 220, 220, 0.8);
  border-color: var(--vibes-red-accent);
  box-shadow: 2px 3px 0px 0px var(--vibes-red-accent);
}

/* ============================================
   RESPONSIVE - MOBILE
   ============================================ */

@media (max-width: 768px) {
  [data-vibe-controls-container] {
    bottom: 10px;
    right: 10px;
    left: 10px;
    align-items: stretch;
  }

  [data-vibe-switch] {
    align-self: flex-end;
  }

  [data-vibe-panel] {
    padding: 16px;
    max-width: 100%;
    min-width: unset;
  }

  [data-panel-mode] > div {
    flex-direction: column;
    gap: 12px;
  }

  [data-vibe-panel] button {
    width: 100%;
    padding: 0.75rem 1.5rem;
    min-height: 60px;
  }
}

/* Dark mode support via CSS variables */
@media (prefers-color-scheme: dark) {
  /* CSS variables will handle dark mode automatically */
  /* No explicit overrides needed here */
}
`.trim();
