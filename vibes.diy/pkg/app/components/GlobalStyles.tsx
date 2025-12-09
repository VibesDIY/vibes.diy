import React from "react";

/**
 * GlobalStyles Component
 *
 * Injects global CSS that was previously in app.css but can't be handled by Tailwind.
 *
 * Includes:
 * - Global resets (html/body margins, fonts, iOS dark mode fixes)
 * - Keyframe animations (fadeIn, bounceIn, buttonGlimmer, etc.)
 * - Utility classes (animate-*, accent-*, decorative-*)
 * - Pseudo-element classes (.bg-glimmer::before, .stripes-overlay::after)
 * - Component-specific classes (.ai-markdown, .vibes-login-button, etc.)
 *
 * This component should be rendered once at the app root level.
 */
export function GlobalStyles() {
  return (
    <style>{`
/* ============================================
   CSS CUSTOM PROPERTIES (from colors.css)
   ============================================ */

:root {
  /* Base Colors - Static colors that never change with theme */
  --vibes-blue: #3b82f6;
  --vibes-blue-accent: #0066cc;
  --vibes-blue-bright: #0074d9;
  --vibes-blue-dark: #357abd;
  --vibes-blue-darker: #4a90e2;

  --vibes-red: #ef4444;
  --vibes-red-accent: #da291c;
  --vibes-red-dark: #b91c1c;
  --vibes-red-bright: #dc2626;
  --vibes-red-light: #ff6666;
  --vibes-red-delete: #ff3333;

  --vibes-yellow: #eab308;
  --vibes-yellow-accent: #fedd00;
  --vibes-yellow-bright: #fe0;

  --vibes-gray: #6b7280;
  --vibes-green: #51cf66;

  /* Neon/Phosphorescent colors for dark mode */
  --vibes-purple-neon: #c084fc;
  --vibes-magenta-neon: #e879f9;
  --vibes-pink-neon: #f472b6;
  --vibes-cyan-neon: #22d3ee;
  --vibes-lime-neon: #a3e635;
  --vibes-orange-neon: #fb923c;

  /* Neutrals */
  --vibes-black: #000000;
  --vibes-near-black: #1a1a1a;
  --vibes-dark-gray: #222222;
  --vibes-gray-dark: #333333;
  --vibes-gray-mid: #555555;
  --vibes-gray-medium: #666666;
  --vibes-gray-light: #aaaaaa;
  --vibes-gray-lighter: #cccccc;
  --vibes-gray-lightest: #d4d4d4;
  --vibes-gray-ultralight: #e0e0e0;
  --vibes-gray-pale: #e5e5e5;
  --vibes-gray-offwhite: #eeeeee;
  --vibes-gray-ghost: #f0f0f0;
  --vibes-gray-whisper: #f5f5f5;
  --vibes-gray-mist: #fafafa;

  --vibes-white: #ffffff;
  --vibes-cream: #fffff0;

  /* Semantic Colors - Theme-aware (change with light/dark mode) */
  /* Backgrounds */
  --vibes-bg-primary: var(--vibes-white);
  --vibes-bg-secondary: var(--vibes-gray-whisper);
  --vibes-bg-tertiary: var(--vibes-gray-pale);
  --vibes-bg-overlay: rgba(255, 255, 255, 0.5);
  --vibes-bg-input: var(--vibes-white);
  --vibes-bg-dropzone: var(--vibes-gray-mist);
  --vibes-bg-dropzone-active: #f0f8ff;
  --vibes-bg-light: var(--vibes-gray-ghost);

  /* Text */
  --vibes-text-primary: var(--vibes-gray-dark);
  --vibes-text-secondary: var(--vibes-gray-medium);
  --vibes-text-muted: var(--vibes-gray-light);
  --vibes-text-inverse: var(--vibes-white);

  /* Borders */
  --vibes-border-primary: var(--vibes-near-black);
  --vibes-border-secondary: var(--vibes-gray-lighter);
  --vibes-border-light: #dddddd;
  --vibes-border-input: var(--vibes-gray-lighter);

  /* Shadows */
  --vibes-shadow-color: var(--vibes-near-black);
  --vibes-shadow-sm: rgba(0, 0, 0, 0.15);
  --vibes-shadow-md: rgba(0, 0, 0, 0.3);
  --vibes-shadow-lg: rgba(0, 0, 0, 0.5);
  --vibes-shadow-backdrop: rgba(0, 0, 0, 0.9);

  /* Component-Specific Semantic Colors */
  /* Button - Light mode (cream/light by default) */
  --vibes-button-bg: var(--vibes-cream);
  --vibes-button-text: var(--vibes-near-black);
  --vibes-button-border: var(--vibes-near-black);
  --vibes-button-icon-bg: #2a2a2a;
  --vibes-button-icon-fill: var(--vibes-white);

  /* Button - Dark mode aware variants (for when ignoreDarkMode=false) */
  --vibes-button-bg-dark-aware: var(--vibes-cream);
  --vibes-button-text-dark-aware: var(--vibes-near-black);
  --vibes-button-border-dark-aware: var(--vibes-near-black);
  --vibes-button-icon-bg-dark-aware: var(--vibes-white);

  /* Button variant colors - Light mode */
  --vibes-variant-blue: var(--vibes-blue);
  --vibes-variant-red: var(--vibes-red);
  --vibes-variant-yellow: var(--vibes-yellow);
  --vibes-variant-gray: var(--vibes-gray);

  --vibes-card-bg: var(--vibes-gray-pale);
  --vibes-card-text: var(--vibes-near-black);
  --vibes-card-border: var(--vibes-near-black);

  /* Error States */
  --vibes-error-bg: rgba(0, 0, 0, 0.7);
  --vibes-error-border: var(--vibes-red-light);
  --vibes-error-text: var(--vibes-red-light);
  --vibes-error-text-body: var(--vibes-white);

  /* ImgGen specific */
  --imggen-accent: var(--vibes-blue-accent);
  --imggen-flash: var(--vibes-yellow-bright);
  --imggen-button-bg: rgba(255, 255, 255, 0.7);
  --imggen-delete-hover: var(--vibes-red-delete);

  /* Color tokens that match Tailwind @theme block */
  --color-midnight: #333;
  --color-tahiti: #999;
  --color-bermuda: #ccc;
  --color-light-primary: #333;
  --color-light-secondary: #333;
  --color-light-decorative-00: #eee;
  --color-light-decorative-01: #ddd;
  --color-light-decorative-02: #333;
  --color-light-background-00: #fff;
  --color-light-background-01: #eee;
  --color-light-background-02: #ddd;
  --color-dark-primary: #fff;
  --color-dark-secondary: #fff;
  --color-dark-decorative-00: #333;
  --color-dark-decorative-01: #444;
  --color-dark-decorative-02: #fff;
  --color-dark-background-00: #111;
  --color-dark-background-01: #222;
  --color-dark-background-02: #222;
  --color-accent-00-light: #aaa;
  --color-accent-01-light: #999;
  --color-accent-02-light: #888;
  --color-accent-03-light: #777;
  --color-accent-00-dark: #bbb;
  --color-accent-01-dark: #aaa;
  --color-accent-02-dark: #777;
  --color-accent-03-dark: #666;
}

/* Dark Mode - Theme-aware colors adapt here */
@media (prefers-color-scheme: dark) {
  :root {
    /* Backgrounds */
    --vibes-bg-primary: var(--vibes-near-black);
    --vibes-bg-secondary: #2a2a2a;
    --vibes-bg-tertiary: #404040;
    --vibes-bg-overlay: rgba(0, 0, 0, 0.5);
    --vibes-bg-input: #2a2a2a;
    --vibes-bg-dropzone: #2a2a2a;
    --vibes-bg-dropzone-active: #1a3a4a;
    --vibes-bg-light: #404040;

    /* Text */
    --vibes-text-primary: var(--vibes-gray-ultralight);
    --vibes-text-secondary: var(--vibes-gray-light);
    --vibes-text-muted: var(--vibes-gray-medium);
    --vibes-text-inverse: var(--vibes-near-black);

    /* Borders */
    --vibes-border-primary: var(--vibes-gray-mid);
    --vibes-border-secondary: var(--vibes-gray-mid);
    --vibes-border-light: var(--vibes-gray-mid);
    --vibes-border-input: var(--vibes-gray-mid);

    /* Shadows */
    --vibes-shadow-color: var(--vibes-near-black);
    --vibes-shadow-sm: rgba(255, 255, 255, 0.1);
    --vibes-shadow-md: rgba(255, 255, 255, 0.1);
    --vibes-shadow-lg: rgba(0, 0, 0, 0.5);
    --vibes-shadow-backdrop: rgba(0, 0, 0, 0.9);

    /* Component-Specific Dark Mode Adjustments */
    --vibes-card-bg: var(--vibes-near-black);
    --vibes-card-text: var(--vibes-white);
    --vibes-card-border: var(--vibes-gray-mid);

    --vibes-button-icon-bg: var(--vibes-white);
    --vibes-button-icon-fill: #2a2a2a;

    /* Dark mode aware buttons - darker background with light text */
    --vibes-button-bg-dark-aware: #2a2a2a;
    --vibes-button-text-dark-aware: var(--vibes-gray-ultralight);
    --vibes-button-border-dark-aware: var(--vibes-gray-mid);
    --vibes-button-icon-bg-dark-aware: #404040;

    /* Button variant colors - Dark mode (neon/phosphorescent) */
    --vibes-variant-blue: var(--vibes-purple-neon);
    --vibes-variant-red: var(--vibes-pink-neon);
    --vibes-variant-yellow: var(--vibes-orange-neon);
    --vibes-variant-gray: var(--vibes-cyan-neon);

    /* ImgGen dark mode adjustments */
    --imggen-button-bg: rgba(0, 0, 0, 0.7);
  }
}

/* ============================================
   GLOBAL RESETS
   ============================================ */

html {
  margin: 0;
  padding: 0;
}

body {
  margin: 0;
  padding: 0;
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    "Roboto",
    "Oxygen",
    "Ubuntu",
    "Cantarell",
    "Fira Sans",
    "Droid Sans",
    "Helvetica Neue",
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  width: 100%;
  height: 100%;
  background-color: var(--color-light-background-00);
  color: var(--color-light-primary);
}

@media (prefers-color-scheme: dark) {
  body {
    color-scheme: dark;
    background-color: var(--color-dark-background-00);
    color: var(--color-dark-primary);
  }
}

hr {
  opacity: 0.5;
}

/* Force dark mode based on system preference, regardless of class strategy */
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
  }

  html,
  body {
    background-color: var(--color-dark-background-00);
    color: var(--color-dark-primary);
  }

  /* This adds all the standard dark mode styles that would normally require the 'dark' class */
  .text-accent-02 {
    color: var(--color-dark-secondary);
  }

  .text-accent-00 {
    color: var(--color-dark-accent-01);
  }
}

/* iOS-specific fix for dark mode */
@supports (-webkit-touch-callout: none) {
  @media (prefers-color-scheme: dark) {
    html,
    body {
      /* Force background color on iOS Safari */
      background-color: var(--color-dark-background-00);
      color: var(--color-dark-primary);
    }
  }
}

#root {
  height: 100%;
}

button {
  font-family: inherit;
}

/* Prevent auto-zoom on input focus in mobile Safari */
input,
textarea,
select {
  font-size: 16px; /* prevents auto-zoom */
}

/* Ensure all buttons and links show pointer cursor on hover */
button,
a,
[role="button"],
[type="button"],
[type="submit"],
[type="reset"] {
  cursor: pointer;
}

.light {
  --sp-layout-height: 100vh !important;
}

/* ============================================
   KEYFRAME ANIMATIONS
   ============================================ */

/* Animation for share status message */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Animation for new chat bounce effect */
@keyframes bounceIn {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Button glimmer animation */
@keyframes buttonGlimmer {
  0% {
    background-position: -100% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Gradient animation for glimmer */
@keyframes gradientGlimmer {
  0% {
    background-position: 0% 50%;
  }

  50% {
    background-position: 100% 50%;
  }

  100% {
    background-position: 0% 50%;
  }
}

@keyframes pulse {
  0% {
    transform: rotate(-5deg) scale(1);
  }
  50% {
    transform: rotate(0deg) scale(1.05);
  }
  100% {
    transform: rotate(-5deg) scale(1);
  }
}

@keyframes logo-rotate {
  0% {
    transform: rotate(45deg) scale(5.5);
  }
  66% {
    transform: rotate(0deg) scale(1);
  }
  100% {
    transform: rotate(45deg) scale(5.5);
  }
}

@keyframes logo-pulse-height {
  0% {
    width: 200%;
  }
  50% {
    width: 20%;
  }
  100% {
    width: 200%;
  }
}

/* Animated gradient background utility */
@keyframes gradient-x {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

/* === Loading stripes overlay === */
@keyframes moving-stripes {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 40px 0;
  }
}

/* ============================================
   UTILITY CLASSES
   ============================================ */

.animate-fade-in {
  animation: fadeIn 0.3s ease-in-out forwards;
}

.animate-bounce-in {
  animation: bounceIn 0.5s ease-out forwards;
}

.animate-gradient-x {
  background-size: 200% auto;
  animation: gradient-x 3s linear infinite;
}

/* Add the color utility classes */
.accent-00 {
  background-color: var(--color-accent-00-light);
}

@media (prefers-color-scheme: dark) {
  .accent-00 {
    background-color: var(--color-accent-00-dark);
  }
}

.accent-01 {
  background-color: var(--color-accent-01-light);
}

@media (prefers-color-scheme: dark) {
  .accent-01 {
    background-color: var(--color-accent-01-dark);
  }
}

.accent-02 {
  background-color: var(--color-accent-02-light);
}

@media (prefers-color-scheme: dark) {
  .accent-02 {
    background-color: var(--color-accent-02-dark);
  }
}

.accent-03 {
  background-color: var(--color-accent-03-light);
}

@media (prefers-color-scheme: dark) {
  .accent-03 {
    background-color: var(--color-accent-03-dark);
  }
}

.text-accent-00 {
  color: var(--color-accent-00-light);
}

@media (prefers-color-scheme: dark) {
  .text-accent-00 {
    color: var(--color-accent-00-dark);
  }
}

.text-accent-01 {
  color: var(--color-accent-01-light);
}

@media (prefers-color-scheme: dark) {
  .text-accent-01 {
    color: var(--color-accent-01-dark);
  }
}

.text-accent-02 {
  color: var(--color-accent-02-light);
}

@media (prefers-color-scheme: dark) {
  .text-accent-02 {
    color: var(--color-accent-02-dark);
  }
}

.text-accent-03 {
  color: var(--color-accent-03-light);
}

@media (prefers-color-scheme: dark) {
  .text-accent-03 {
    color: var(--color-accent-03-dark);
  }
}

.decorative-00 {
  background-color: var(--color-light-decorative-00);
}

@media (prefers-color-scheme: dark) {
  .decorative-00 {
    background-color: var(--color-dark-decorative-00);
  }
}

.decorative-01 {
  background-color: var(--color-light-decorative-01);
}

@media (prefers-color-scheme: dark) {
  .decorative-01 {
    background-color: var(--color-dark-decorative-01);
  }
}

.decorative-02 {
  background-color: var(--color-light-decorative-02);
}

@media (prefers-color-scheme: dark) {
  .decorative-02 {
    background-color: var(--color-dark-decorative-02);
  }
}

.bg-primary {
  background-color: var(--color-light-background-00);
}

@media (prefers-color-scheme: dark) {
  .bg-primary {
    background-color: var(--color-dark-background-00);
  }
}

.bg-secondary {
  background-color: var(--color-light-background-01);
}

@media (prefers-color-scheme: dark) {
  .bg-secondary {
    background-color: var(--color-dark-background-01);
  }
}

.bg-tertiary {
  background-color: var(--color-light-background-02);
}

@media (prefers-color-scheme: dark) {
  .bg-tertiary {
    background-color: var(--color-dark-background-02);
  }
}

/* Tailwind utility classes for light/dark backgrounds */
.bg-light-background-00 {
  background-color: var(--color-light-background-00);
}

.bg-light-background-01 {
  background-color: var(--color-light-background-01);
}

.bg-light-background-02 {
  background-color: var(--color-light-background-02);
}

.bg-light-decorative-00 {
  background-color: var(--color-light-decorative-00);
}

.bg-light-decorative-01 {
  background-color: var(--color-light-decorative-01);
}

.bg-light-decorative-02 {
  background-color: var(--color-light-decorative-02);
}

.bg-dark-background-01 {
  background-color: var(--color-dark-background-01);
}

.text-light-primary {
  color: var(--color-light-primary);
}

.text-light-secondary {
  color: var(--color-light-secondary);
}

.border-light-decorative-00 {
  border-color: var(--color-light-decorative-00);
}

.border-light-decorative-01 {
  border-color: var(--color-light-decorative-01);
}

/* Dark mode variants */
.dark\\:bg-dark-background-00:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:bg-dark-background-00 {
    background-color: var(--color-dark-background-00);
  }
}

.dark\\:bg-dark-background-01:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:bg-dark-background-01 {
    background-color: var(--color-dark-background-01);
  }
}

.dark\\:bg-dark-background-02:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:bg-dark-background-02 {
    background-color: var(--color-dark-background-02);
  }
}

.dark\\:bg-dark-decorative-00:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:bg-dark-decorative-00 {
    background-color: var(--color-dark-decorative-00);
  }
}

.dark\\:bg-dark-decorative-01:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:bg-dark-decorative-01 {
    background-color: var(--color-dark-decorative-01);
  }
}

.dark\\:text-dark-primary:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:text-dark-primary {
    color: var(--color-dark-primary);
  }
}

.dark\\:text-dark-secondary:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:text-dark-secondary {
    color: var(--color-dark-secondary);
  }
}

.dark\\:border-dark-decorative-00:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:border-dark-decorative-00 {
    border-color: var(--color-dark-decorative-00);
  }
}

.dark\\:border-dark-decorative-01:is(.dark *),
@media (prefers-color-scheme: dark) {
  .dark\\:border-dark-decorative-01 {
    border-color: var(--color-dark-decorative-01);
  }
}

/* Hover variants */
.hover\\:bg-light-background-01:hover,
.bg-light-background-01:hover {
  background-color: var(--color-light-background-01);
}

.hover\\:bg-light-background-02:hover,
.bg-light-background-02:hover {
  background-color: var(--color-light-background-02);
}

.hover\\:bg-light-decorative-01:hover,
.bg-light-decorative-01:hover {
  background-color: var(--color-light-decorative-01);
}

.dark\\:hover\\:bg-dark-decorative-00:is(.dark *):hover,
@media (prefers-color-scheme: dark) {
  .dark\\:hover\\:bg-dark-decorative-00:hover {
    background-color: var(--color-dark-decorative-00);
  }
}

.dark\\:hover\\:bg-dark-decorative-01:is(.dark *):hover,
@media (prefers-color-scheme: dark) {
  .dark\\:hover\\:bg-dark-decorative-01:hover {
    background-color: var(--color-dark-decorative-01);
  }
}

/* ============================================
   PSEUDO-ELEMENT CLASSES
   ============================================ */

/* Simple glimmer without positioning for button backgrounds */
.bg-glimmer {
  position: relative;
  overflow: hidden;
  z-index: 0;
}

.bg-glimmer::before {
  content: "";
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  z-index: -1;
  background-image: linear-gradient(
    -45deg,
    #f2f2f2 0%,
    #f7f7f7 40%,
    #e0e0e0 42%,
    #ffffff 50%,
    #e0e0e0 52%,
    #f7f7f7 60%,
    #f2f2f2 100%
  );
  background-size: 300% 300%;
  animation: gradientGlimmer 30s ease infinite;
  transition: filter 0.2s ease;
}

/* Hover state for light mode - darken and pause */
button:hover .bg-glimmer::before,
.bg-glimmer:hover::before {
  animation-play-state: paused;
}

button:hover .bg-glimmer,
.bg-glimmer:hover {
  filter: brightness(0.95);
}

/* Dark mode variant */
.dark .bg-glimmer::before {
  background-image: linear-gradient(
    -45deg,
    #363636 0%,
    #404040 40%,
    #303030 42%,
    #4a4a4a 50%,
    #303030 52%,
    #404040 60%,
    #363636 100%
  );
  background-size: 300% 300%;
}

/* Hover state for dark mode - lighten and pause */
.dark button:hover .bg-glimmer::before,
.dark .bg-glimmer:hover::before {
  animation-play-state: paused;
}

.dark button:hover .bg-glimmer,
.dark .bg-glimmer:hover {
  filter: brightness(1.1);
}

/* Monochrome glimmer effect for borders */
.border-glimmer {
  position: absolute;
  overflow: visible;
  border: none;
}

.border-glimmer::before {
  content: "";
  position: absolute;
  inset: -2px; /* Slightly larger than the button */
  border-radius: inherit;
  padding: 2px; /* Border thickness */
  background: linear-gradient(
    120deg,
    transparent 0%,
    transparent 10%,
    rgba(175, 175, 175, 0.2) 15%,
    rgba(186, 186, 186, 0.3) 23%,
    rgba(145, 145, 145, 0.4) 32%,
    rgba(216, 216, 216, 0.5) 35%,
    rgba(255, 255, 255, 0.6) 40%,
    transparent 70%
  );
  background-size: 200% 100%;
  background-repeat: no-repeat;
  background-position: -100% 0;
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: buttonGlimmer 8.5s infinite;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

/* Dark mode adjustment */
@media (prefers-color-scheme: dark) {
  .border-glimmer::before {
    background: linear-gradient(
      120deg,
      transparent 0%,
      transparent 10%,
      rgba(100, 100, 100, 0.3) 20%,
      rgba(150, 150, 150, 0.4) 33%,
      rgba(200, 200, 200, 0.5) 34%,
      rgba(220, 220, 220, 0.6) 36%,
      rgba(255, 255, 255, 0.4) 40%,
      transparent 70%
    );
    background-size: 200% 100%;
    background-repeat: no-repeat;
    background-position: -100% 0;
    animation: buttonGlimmer 11s infinite;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* Keep the original glimmer-overlay class */
.glimmer-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    120deg,
    transparent 0%,
    transparent 10%,
    rgba(255, 145, 0, 0.2) 15%,
    rgba(255, 166, 0, 0.2) 20%,
    rgba(255, 185, 30, 0.2) 34%,
    rgba(255, 216, 107, 0.2) 35%,
    rgba(255, 255, 255, 0.2) 40%,
    transparent 70%
  );
  background-size: 200% 100%;
  background-repeat: no-repeat;
  background-position: -100% 0;
  animation: buttonGlimmer 4.5s infinite;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark mode adjustment */
@media (prefers-color-scheme: dark) {
  .glimmer-overlay {
    background: linear-gradient(
      120deg,
      transparent 0%,
      transparent 10%,
      rgba(255, 140, 0, 0.2) 20%,
      rgba(253, 158, 6, 0.2) 33%,
      rgba(255, 185, 30, 0.2) 34%,
      rgba(255, 186, 0, 0.2) 36%,
      rgba(255, 136, 0, 0.2) 40%,
      transparent 70%
    );
    background-size: 200% 100%;
    background-repeat: no-repeat;
    background-position: -100% 0;
    animation: buttonGlimmer 4.5s infinite;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.stripes-overlay {
  position: relative;
  overflow: hidden; /* ensure stripes clipped to element */
}

.stripes-overlay::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.35) 0px,
    rgba(255, 255, 255, 0.35) 12px,
    transparent 12px,
    transparent 24px
  );
  background-size: 40px 40px;
  animation: moving-stripes 1s linear infinite;
}

@media (prefers-color-scheme: dark) {
  .stripes-overlay::after {
    background-image: repeating-linear-gradient(
      135deg,
      rgba(0, 0, 0, 0.4) 0px,
      rgba(0, 0, 0, 0.4) 12px,
      transparent 12px,
      transparent 24px
    );
  }
}

/* ============================================
   COMPONENT-SPECIFIC CLASSES
   ============================================ */

/* Default (Light Mode) Button Gradients */
.light-gradient {
  background: linear-gradient(
    110deg,
    transparent 0%,
    rgba(255, 255, 255, 1) 45%,
    white 89%
  );
}

/* Dark Mode Button Gradients */
@media (prefers-color-scheme: dark) {
  .light-gradient {
    background: linear-gradient(
      110deg,
      transparent 0%,
      rgba(0, 0, 0, 1) 45%,
      black 89%
    );
  }
}

.pulsing {
  width: 100%;
  height: auto;
  transform: rotate(-5deg) scale(6);
  animation: pulse 8s infinite;
}

.logo-pulse {
  transform: rotate(-5deg) scale(3);
  animation:
    logo-rotate 1410s ease-in-out infinite,
    logo-pulse-height 711s ease-in-out infinite;
}

.ai-markdown p {
  margin-bottom: 0.5rem;
}

.ai-markdown ul {
  list-style-type: disc;
  padding-left: 1rem;
  padding-top: 0.5rem;
}

.ai-markdown ol {
  list-style-type: decimal;
  padding-left: 1rem;
  padding-top: 0.5rem;
}

.ai-markdown li {
  margin-bottom: 0.5rem;
}

.ai-markdown h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.ai-markdown h2 {
  font-size: 1.3rem;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.75rem;
}

.ai-markdown h3 {
  font-size: 1.15rem;
  font-weight: 600;
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
}

/* Grid background pattern inspired by catalog title page */
.grid-background {
  background-color: #d4d4d4;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  background-attachment: scroll;
}

@media (min-width: 768px) {
  .grid-background {
    background-attachment: fixed;
  }
}

@media (prefers-color-scheme: dark) {
  .grid-background {
    background-color: #2a2a2a;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px);
  }
}

/* Page-specific body background for create page */
.page-grid-background {
  /* This class on a page root will apply grid to body for over-scroll areas */
}

body:has(.page-grid-background) {
  background-color: #d4d4d4;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  background-attachment: scroll;
}

@media (min-width: 768px) {
  body:has(.page-grid-background) {
    background-attachment: fixed;
  }
}

@media (prefers-color-scheme: dark) {
  body:has(.page-grid-background) {
    background-color: #2a2a2a;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.3) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.3) 1px, transparent 1px);
  }
}

/* Vibes Login Button - themed button with interactive states */
.vibes-login-button {
  width: 100%;
  padding: 1rem 2rem;
  background: var(--color-light-background-00);
  color: var(--color-light-primary);
  border: 3px solid var(--color-light-primary);
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  transform: translate(0px, 0px);
  box-shadow: 4px 5px 0px 0px #009ace;
}

.vibes-login-button:hover {
  transform: translate(2px, 2px);
  box-shadow: 2px 3px 0px 0px #009ace;
}

.vibes-login-button:active {
  transform: translate(4px, 5px);
  box-shadow: none;
}

.vibes-login-button:focus-visible {
  outline: 3px solid #009ace;
  outline-offset: 4px;
}

@media (prefers-color-scheme: dark) {
  .vibes-login-button {
    background: var(--color-dark-background-00);
    color: var(--color-dark-primary);
    border-color: var(--color-dark-primary);
  }
}
    `}</style>
  );
}
