/**
 * Utility classes, pseudo-element effects, and component styles.
 * Previously in tailwind-utilities.css, pseudo-elements.css, component-styles.css.
 *
 * Note: These use --color-* CSS variables which are defined in the app's
 * Tailwind @theme block. They will only work when those variables exist.
 */

export const utilityClasses = `
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

.bg-light-background-00 { background-color: var(--color-light-background-00); }
.bg-light-background-01 { background-color: var(--color-light-background-01); }
.bg-light-background-02 { background-color: var(--color-light-background-02); }
.bg-light-decorative-00 { background-color: var(--color-light-decorative-00); }
.bg-light-decorative-01 { background-color: var(--color-light-decorative-01); }
.bg-light-decorative-02 { background-color: var(--color-light-decorative-02); }
.bg-dark-background-01 { background-color: var(--color-dark-background-01); }

.text-light-primary { color: var(--color-light-primary); }
.text-light-secondary { color: var(--color-light-secondary); }

.border-light-decorative-00 { border-color: var(--color-light-decorative-00); }
.border-light-decorative-01 { border-color: var(--color-light-decorative-01); }

@media (prefers-color-scheme: dark) {
  .dark\\:bg-dark-background-00 { background-color: var(--color-dark-background-00); }
  .dark\\:bg-dark-background-01 { background-color: var(--color-dark-background-01); }
  .dark\\:bg-dark-background-02 { background-color: var(--color-dark-background-02); }
  .dark\\:bg-dark-decorative-00 { background-color: var(--color-dark-decorative-00); }
  .dark\\:bg-dark-decorative-01 { background-color: var(--color-dark-decorative-01); }
  .dark\\:text-dark-primary { color: var(--color-dark-primary); }
  .dark\\:text-dark-secondary { color: var(--color-dark-secondary); }
  .dark\\:border-dark-decorative-00 { border-color: var(--color-dark-decorative-00); }
  .dark\\:border-dark-decorative-01 { border-color: var(--color-dark-decorative-01); }
}

.hover\\:bg-light-background-01:hover,
.bg-light-background-01:hover { background-color: var(--color-light-background-01); }

.hover\\:bg-light-background-02:hover,
.bg-light-background-02:hover { background-color: var(--color-light-background-02); }

.hover\\:bg-light-decorative-01:hover,
.bg-light-decorative-01:hover { background-color: var(--color-light-decorative-01); }

@media (prefers-color-scheme: dark) {
  .dark\\:hover\\:bg-dark-decorative-00:hover { background-color: var(--color-dark-decorative-00); }
  .dark\\:hover\\:bg-dark-decorative-01:hover { background-color: var(--color-dark-decorative-01); }
}
`;

export const pseudoElements = `
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
  background-image: linear-gradient(-45deg, #f2f2f2 0%, #f7f7f7 40%, #e0e0e0 42%, #ffffff 50%, #e0e0e0 52%, #f7f7f7 60%, #f2f2f2 100%);
  background-size: 300% 300%;
  animation: gradientGlimmer 30s ease infinite;
  transition: filter 0.2s ease;
}

button:hover .bg-glimmer::before,
.bg-glimmer:hover::before { animation-play-state: paused; }

button:hover .bg-glimmer,
.bg-glimmer:hover { filter: brightness(0.95); }

.dark .bg-glimmer::before {
  background-image: linear-gradient(-45deg, #363636 0%, #404040 40%, #303030 42%, #4a4a4a 50%, #303030 52%, #404040 60%, #363636 100%);
  background-size: 300% 300%;
}

.dark button:hover .bg-glimmer::before,
.dark .bg-glimmer:hover::before { animation-play-state: paused; }

.dark button:hover .bg-glimmer,
.dark .bg-glimmer:hover { filter: brightness(1.1); }

.border-glimmer {
  position: absolute;
  overflow: visible;
  border: none;
}

.border-glimmer::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(120deg, transparent 0%, transparent 10%, rgba(175,175,175,0.2) 15%, rgba(186,186,186,0.3) 23%, rgba(145,145,145,0.4) 32%, rgba(216,216,216,0.5) 35%, rgba(255,255,255,0.6) 40%, transparent 70%);
  background-size: 200% 100%;
  background-repeat: no-repeat;
  background-position: -100% 0;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: buttonGlimmer 8.5s infinite;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

@media (prefers-color-scheme: dark) {
  .border-glimmer::before {
    background: linear-gradient(120deg, transparent 0%, transparent 10%, rgba(100,100,100,0.3) 20%, rgba(150,150,150,0.4) 33%, rgba(200,200,200,0.5) 34%, rgba(220,220,220,0.6) 36%, rgba(255,255,255,0.4) 40%, transparent 70%);
    background-size: 200% 100%;
    background-repeat: no-repeat;
    background-position: -100% 0;
    animation: buttonGlimmer 11s infinite;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.glimmer-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, transparent 0%, transparent 10%, rgba(255,145,0,0.2) 15%, rgba(255,166,0,0.2) 20%, rgba(255,185,30,0.2) 34%, rgba(255,216,107,0.2) 35%, rgba(255,255,255,0.2) 40%, transparent 70%);
  background-size: 200% 100%;
  background-repeat: no-repeat;
  background-position: -100% 0;
  animation: buttonGlimmer 4.5s infinite;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-color-scheme: dark) {
  .glimmer-overlay {
    background: linear-gradient(120deg, transparent 0%, transparent 10%, rgba(255,140,0,0.2) 20%, rgba(253,158,6,0.2) 33%, rgba(255,185,30,0.2) 34%, rgba(255,186,0,0.2) 36%, rgba(255,136,0,0.2) 40%, transparent 70%);
    background-size: 200% 100%;
    background-repeat: no-repeat;
    background-position: -100% 0;
    animation: buttonGlimmer 4.5s infinite;
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.stripes-overlay {
  position: relative;
  overflow: hidden;
}

.stripes-overlay::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 12px, transparent 12px, transparent 24px);
  background-size: 40px 40px;
  animation: moving-stripes 1s linear infinite;
}

@media (prefers-color-scheme: dark) {
  .stripes-overlay::after {
    background-image: repeating-linear-gradient(135deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 12px, transparent 12px, transparent 24px);
  }
}
`;

export const componentStyles = `
.light-gradient {
  background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,1) 45%, white 89%);
}

@media (prefers-color-scheme: dark) {
  .light-gradient {
    background: linear-gradient(110deg, transparent 0%, rgba(0,0,0,1) 45%, black 89%);
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
  animation: logo-rotate 1410s ease-in-out infinite, logo-pulse-height 711s ease-in-out infinite;
}

.ai-markdown p { margin-bottom: 0.5rem; }
.ai-markdown ul { list-style-type: disc; padding-left: 1rem; padding-top: 0.5rem; }
.ai-markdown ol { list-style-type: decimal; padding-left: 1rem; padding-top: 0.5rem; }
.ai-markdown li { margin-bottom: 0.5rem; }
.ai-markdown h1 { font-size: 1.5rem; font-weight: 700; margin-top: 1rem; margin-bottom: 1rem; }
.ai-markdown h2 { font-size: 1.3rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.75rem; }
.ai-markdown h3 { font-size: 1.15rem; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.5rem; }

.grid-background {
  background-color: #d4d4d4;
  background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  background-attachment: scroll;
}

@media (min-width: 768px) {
  .grid-background { background-attachment: fixed; }
}

@media (prefers-color-scheme: dark) {
  .grid-background {
    background-color: #2a2a2a;
    background-image: linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);
  }
}

.page-grid-background {}

body:has(.page-grid-background) {
  background-color: #d4d4d4;
  background-image: linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px);
  background-size: 40px 40px;
  background-attachment: scroll;
}

@media (min-width: 768px) {
  body:has(.page-grid-background) { background-attachment: fixed; }
}

@media (prefers-color-scheme: dark) {
  body:has(.page-grid-background) {
    background-color: #2a2a2a;
    background-image: linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px);
  }
}

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
`;
