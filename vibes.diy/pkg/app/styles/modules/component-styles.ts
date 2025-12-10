/**
 * Component-Specific Styles
 * CSS for specific components that can't be handled by Tailwind
 *
 * Extracted from global-styles.ts lines 940-1116
 */

export const componentStyles = `
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
`.trim();
