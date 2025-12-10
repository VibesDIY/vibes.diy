/**
 * Pseudo-element Classes
 * Complex classes using ::before and ::after for visual effects
 * Includes glimmers, gradients, stripes, and overlay effects
 *
 * Extracted from global-styles.ts lines 734-939
 */

export const pseudoElements = `
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
`.trim();
