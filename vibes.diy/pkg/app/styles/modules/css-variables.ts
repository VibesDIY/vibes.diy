/**
 * CSS Custom Properties
 * Copied from colors.css for server-side injection
 *
 * NOTE: colors.css remains the single source of truth.
 * This file is a duplicate for SSR performance - future enhancement
 * could read colors.css dynamically at build time.
 *
 * @see ../colors.css
 */

export const cssVariables = `
/* ============================================
   CSS CUSTOM PROPERTIES
   Source: colors.css - Vibes Design System Color Tokens
   ============================================ */

:root {
  /* ============================================
     BASE COLORS - These never change with theme
     Use these when you want consistent colors regardless of dark mode
     ============================================ */

  /* Primary Palette */
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

  /* ============================================
     SEMANTIC COLORS - Theme-aware (change with light/dark mode)
     Use these for most UI elements that should adapt to theme
     ============================================ */

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

  /* Color tokens for Tailwind @theme compatibility */
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

/* ============================================
   DARK MODE - Theme-aware colors adapt here
   Base colors remain unchanged
   ============================================ */
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
`.trim();
