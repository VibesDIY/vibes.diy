// Catalog Title template for app landing pages (no underscore in subdomain)
// Shows app preview, screenshot, and "Launch App" functionality

import { libraryImportMap as importMapData } from "../config/library-import-map.js";

// Generate import map JSON for consistent module caching with app instances
export const catalogImportMap = JSON.stringify(
  { imports: importMapData.imports },
  null,
  2,
);

// Neobrute Blueprint - Neo-brutalist catalog styles
export const catalogTitleStyles = /* css */ `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :root {
    /* Ensure built-in UI elements (forms, scrollbars) follow the theme */
    color-scheme: light dark;

    /* Theme tokens (light defaults) */
    --ink: #0f172a; /* primary text */
    --muted: #64748b; /* secondary text */

    --surface: #ffffff; /* panels/cards */
    --border: #0f172a; /* panel borders */
    --outline: #64748b; /* inner outlines */

    --bg-base: #f1f5f9; /* page background */
    --bg-grid-line: #cbd5e1; /* blueprint grid */
    --bg-grain-ink: rgba(15, 23, 42, 0.06); /* light grain */
    --grid-size: 20px;

    --shadow-strong: #242424; /* large drop shadows */
    --shadow-soft: #64748b;   /* small inner/element shadows */
    --shadow-heading: #94a3b8; /* h1 shadow (light) */
    --shadow-subtle: #cbd5e1;  /* section heading shadow (light) */

    --overlay: rgba(15, 23, 42, 0.05);

    /* Links */
    --link: var(--ink);
    --link-underline: currentColor;
    --link-hover-bg: #64748b;
    --link-hover-ink: #ffffff;

    /* Component-specific */
    --panel-subtle-bg: #f1f5f9;   /* info sections */
    --panel-subtle-border: #94a3b8;
    --button-hover-bg: #f1f5f9;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    line-height: 1.4;
    color: var(--ink);
    /* Light (default) blueprint background */
    background:
      /* Grain overlay */
      radial-gradient(circle at 50% 50%,
        var(--bg-grain-ink) 1px,
        transparent 1px
      ),
      /* Graph paper grid - vertical lines */
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent calc(var(--grid-size) - 1px),
        var(--bg-grid-line) var(--grid-size),
        var(--bg-grid-line) calc(var(--grid-size) + 1px)
      ),
      /* Graph paper grid - horizontal lines */
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent calc(var(--grid-size) - 1px),
        var(--bg-grid-line) var(--grid-size),
        var(--bg-grid-line) calc(var(--grid-size) + 1px)
      ),
      /* Base color */
      var(--bg-base);
    /* Keep grain tile at 2px, sync grid tiles with --grid-size */
    background-size: 2px 2px, var(--grid-size) var(--grid-size), var(--grid-size) var(--grid-size), 100% 100%;
    background-attachment: fixed;
    min-height: 100vh;
  }

  .catalog-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Header */
  .catalog-header {
    background: var(--surface);
    border: 8px solid var(--border);
    border-radius: 0;
    padding: 24px;
    display: flex;
    align-items: center;
    gap: 24px;
    box-shadow: 8px 8px 0 var(--shadow-strong);
    position: relative;
    outline: 4px solid var(--outline);
    outline-offset: -4px;
    transform: rotate(-0.2deg);
  }

  .vibes-logo {
    text-decoration: none;
    flex-shrink: 0;
    border: 4px solid var(--border);
    padding: 8px;
    background: var(--surface);
    box-shadow: 4px 4px 0 var(--shadow-soft);
    transition: all 0.15s ease;
  }

  .vibes-logo img {
    height: 40px;
    display: block;
  }

  .vibes-logo:hover {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0 var(--shadow-soft);
  }

  .catalog-title {
    flex: 1;
  }

  .catalog-title h1 {
    font-size: 2.5rem;
    font-weight: 900;
    color: var(--ink);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    text-shadow: 2px 2px 0 var(--shadow-heading);
  }

  .catalog-title .subtitle {
    color: var(--muted);
    font-size: 1.1rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Main Content - Mobile First */
  .catalog-main {
    display: flex;
    flex-direction: column;
    gap: 16px;
    flex: 1;
  }

  /* App Preview */
  .app-preview {
    background: var(--surface);
    border: 8px solid var(--border);
    border-radius: 0;
    padding: 24px;
    box-shadow: 12px 12px 0 var(--shadow-strong);
    outline: 4px solid var(--outline);
    outline-offset: -4px;
  }

  .screenshot-container {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 10;
    border-radius: 0;
    overflow: hidden;
    background: var(--bg-base);
    border: 6px solid var(--border);
    box-shadow: 6px 6px 0 var(--shadow-soft);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .screenshot-container:hover {
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0 var(--shadow-soft);
  }

  .app-screenshot {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: none;
    filter: contrast(110%) saturate(90%);
  }

  .placeholder-screenshot {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 16px;
    filter: grayscale(1);
  }

  /* Launch Overlay */
  .launch-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--overlay);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .screenshot-container:hover .launch-overlay {
    opacity: 1;
  }

  /* Ensure button is always visible on touch devices */
  @media (hover: none) and (pointer: coarse) {
    .launch-overlay {
      opacity: 0.9;
    }
    
    .screenshot-container:active .launch-overlay {
      opacity: 1;
    }
  }

  .launch-button {
    background: var(--surface);
    color: var(--ink);
    border: 6px solid var(--border);
    border-radius: 0;
    padding: 16px 32px;
    font-size: 1.2rem;
    font-weight: 900;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.15s ease;
    box-shadow: 6px 6px 0 var(--shadow-soft);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    min-height: 48px;
  }

  #launch-buttons-container {
    display: flex;
    gap: 12px;
    flex-direction: column;
    align-items: center;
  }

  .launch-button.secondary {
    background: var(--panel-subtle-bg);
    color: var(--muted);
    border-color: var(--shadow-soft);
    font-size: 1rem;
    padding: 12px 24px;
    margin-left: auto;
    box-shadow: 4px 4px 0 var(--panel-subtle-border);
  }

  .launch-button:hover {
    background: var(--button-hover-bg);
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0 var(--shadow-soft);
  }

  .launch-button:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0 var(--shadow-soft);
  }

  .launch-icon {
    font-size: 1.3em;
    filter: grayscale(1);
  }

  /* App Information */
  .app-info {
    background: var(--surface);
    border: 8px solid var(--border);
    border-radius: 0;
    padding: 24px;
    box-shadow: 12px 12px 0 var(--shadow-strong);
    height: fit-content;
    outline: 4px solid var(--outline);
    outline-offset: -4px;
  }

  .info-section {
    margin-bottom: 24px;
    padding: 16px;
    border: 4px solid var(--panel-subtle-border);
    background: var(--panel-subtle-bg);
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .info-section h3 {
    font-size: 1.3rem;
    font-weight: 900;
    color: var(--ink);
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-shadow: 1px 1px 0 var(--shadow-subtle);
  }

  .info-section p {
    color: var(--ink);
    margin-bottom: 12px;
    font-weight: 600;
    line-height: 1.4;
  }

  .info-section ul {
    list-style: none;
    color: var(--ink);
  }

  .info-section li {
    position: relative;
    padding-left: 24px;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .info-section li::before {
    content: '▪';
    position: absolute;
    left: 0;
    color: var(--ink);
    font-weight: 900;
    font-size: 1.2em;
  }

  .info-section a {
    color: var(--link);
    text-decoration: none;
    font-weight: 900;
    border-bottom: 3px solid var(--link-underline);
    padding-bottom: 1px;
  }

  .info-section a:hover {
    background: var(--link-hover-bg);
    color: var(--link-hover-ink);
    text-decoration: none;
  }

  /* Footer */
  .catalog-footer {
    margin-top: 24px;
    padding: 24px;
    text-align: left;
    color: var(--muted);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--surface);
    border: 6px solid var(--border);
    box-shadow: 8px 8px 0 var(--shadow-strong);
    outline: 4px solid var(--outline);
    outline-offset: -4px;
    transform: rotate(-0.2deg);
  }

  .catalog-footer .info-section {
    margin-bottom: 24px;
    padding: 16px;
    border: 4px solid var(--panel-subtle-border);
    background: var(--panel-subtle-bg);
  }

  .catalog-footer .info-section:last-child {
    margin-bottom: 0;
  }

  .catalog-footer .info-section h3 {
    font-size: 1.3rem;
    font-weight: 900;
    color: var(--ink);
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-shadow: 1px 1px 0 var(--shadow-subtle);
  }

  .catalog-footer .info-section p {
    color: var(--ink);
    margin-bottom: 12px;
    font-weight: 600;
    line-height: 1.4;
  }

  .catalog-footer a {
    color: var(--link);
    text-decoration: none;
    font-weight: 900;
    border-bottom: 3px solid var(--link-underline);
    padding-bottom: 1px;
  }

  .catalog-footer a:hover {
    background: var(--link-hover-bg);
    color: var(--link-hover-ink);
    text-decoration: none;
  }

  /* Install History Section */
  .install-history {
    background: var(--surface);
    border: 8px solid var(--border);
    border-radius: 0;
    padding: 24px;
    margin-top: 24px;
    box-shadow: 12px 12px 0 var(--shadow-strong);
    outline: 4px solid var(--outline);
    outline-offset: -4px;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 4px solid var(--panel-subtle-border);
  }

  .history-header h3 {
    font-size: 1.5rem;
    font-weight: 900;
    color: var(--ink);
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-shadow: 2px 2px 0 var(--shadow-subtle);
  }

  .clear-history-btn {
    background: var(--panel-subtle-bg);
    color: var(--ink);
    border: 4px solid var(--panel-subtle-border);
    border-radius: 0;
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all 0.15s ease;
    box-shadow: 4px 4px 0 var(--shadow-soft);
  }

  .clear-history-btn:hover {
    background: var(--button-hover-bg);
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 var(--shadow-soft);
  }

  .clear-history-btn:active {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0 var(--shadow-soft);
  }

  .instance-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .instance-item {
    background: var(--panel-subtle-bg);
    border: 4px solid var(--panel-subtle-border);
    border-radius: 0;
    transition: all 0.15s ease;
    box-shadow: 4px 4px 0 var(--shadow-subtle);
  }

  .instance-item:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 var(--shadow-subtle);
  }

  .instance-link {
    display: block;
    padding: 16px;
    text-decoration: none;
    color: var(--ink);
  }

  .instance-link:hover {
    color: var(--ink);
  }

  .instance-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .instance-id {
    font-family: monospace;
    font-size: 1.1rem;
    font-weight: 900;
    color: var(--ink);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .instance-time {
    font-size: 0.85rem;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  /* Mobile-only responsive adjustments */
  @media (max-width: 640px) {
    .catalog-container {
      padding: 16px;
      gap: 16px;
    }

    .catalog-header {
      flex-direction: column;
      text-align: center;
      gap: 16px;
      box-shadow: 6px 6px 0 var(--shadow-strong);
      border-width: 6px;
      padding: 16px;
    }

    .catalog-title h1 {
      font-size: 1.8rem;
    }

    .launch-button {
      padding: 12px 24px;
      font-size: 1.1rem;
      box-shadow: 4px 4px 0 var(--shadow-soft);
    }

    .launch-button:hover {
      box-shadow: 6px 6px 0 var(--shadow-soft);
    }

    .launch-button:active {
      box-shadow: 2px 2px 0 var(--shadow-soft);
    }

    .app-preview,
    .app-info,
    .catalog-footer,
    .install-history {
      box-shadow: 8px 8px 0 var(--shadow-strong);
      border-width: 6px;
      padding: 16px;
    }

    .screenshot-container {
      box-shadow: 4px 4px 0 var(--shadow-soft);
      border-width: 4px;
    }

    .screenshot-container:hover {
      box-shadow: 6px 6px 0 var(--shadow-soft);
    }

    .info-section,
    .catalog-footer .info-section {
      padding: 12px;
    }

    .history-header {
      flex-direction: column;
      gap: 12px;
      align-items: stretch;
    }

    .instance-list {
      grid-template-columns: 1fr;
    }

    .clear-history-btn {
      box-shadow: 4px 4px 0 var(--shadow-soft);
    }

    .clear-history-btn:hover {
      box-shadow: 5px 5px 0 var(--shadow-soft);
    }

    .instance-item {
      box-shadow: 3px 3px 0 var(--shadow-subtle);
    }

    .instance-item:hover {
      box-shadow: 4px 4px 0 var(--shadow-subtle);
    }
  }

  /*
   * Automatic Dark Mode (respects the user's OS/browser preference)
   * We keep the same neo‑brutalist vibe but invert surfaces, borders,
   * and shadows for comfortable contrast in dark environments.
   */
  @media (prefers-color-scheme: dark) {
    :root {
      --ink: #e2e8f0; /* slate-200 */
      --muted: #94a3b8; /* slate-400 */

      --surface: #0f172a; /* slate-900 */
      --border: #64748b; /* slate-500 - much softer than the bright #e2e8f0 */
      --outline: #94a3b8;

      --bg-base: #0b1220; /* deep navy */
      --bg-grid-line: #334155; /* slate-700 */
      --bg-grain-ink: rgba(226, 232, 240, 0.06);

      --shadow-strong: #111827; /* gray-900 */
      --shadow-soft: #1f2937;   /* gray-800 */
      --shadow-heading: #1f2937; /* darker heading shadow */
      --shadow-subtle: #1f2937;

      --overlay: rgba(226, 232, 240, 0.10);

      --link: #e2e8f0;
      --link-hover-bg: #e2e8f0;
      --link-hover-ink: #0b1220;

      --panel-subtle-bg: #111827;
      --panel-subtle-border: #334155;
      --button-hover-bg: #111827;
    }
    
    .vibes-logo {
      background: #000;
    }
  }

  /* Accessible focus styles */
  a:focus-visible,
  .launch-button:focus-visible,
  .vibes-logo:focus-visible {
    outline: 3px solid var(--outline);
    outline-offset: 2px;
    text-decoration: none;
  }

  /* Respect users who prefer reduced motion */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

// Simplified Catalog Title JavaScript using headless install tracking
// Avoid binding to stubs: these globals are set only after tracker init.
export const catalogTitleScript = /* javascript */ `
  // Ensure no pre-bound stubs exist; real functions will be assigned after init
  try { delete window.createNewInstall; } catch {}
  try { delete window.goToFreshestInstall; } catch {}
  try { delete window.defaultLaunchAction; } catch {}
`;

export const catalogTitleTemplate = /* html */ `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f1f5f9" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1220" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
    <title>{{APP_TITLE}} - Vibes DIY</title>
    <script type="importmap">
      ${catalogImportMap}
    </script>
    <style>${catalogTitleStyles}</style>
  </head>
  <body>
    <div class="catalog-container">
      <!-- Header -->
      <header class="catalog-header">
        <a href="https://vibes.diy" class="vibes-logo">
          <img src="https://vibes.diy/vibes-diy.svg" alt="Vibes DIY" />
        </a>
        <div class="catalog-title">
          <h1>{{APP_TITLE}}</h1>
        </div>
      </header>

      <!-- Main Content -->
      <main class="catalog-main">
        <!-- App Preview -->
        <div class="app-preview">
          <div class="screenshot-container">
            {{#if HAS_SCREENSHOT}}
            <img 
              src="{{SCREENSHOT_URL}}" 
              alt="{{APP_TITLE}} Screenshot" 
              class="app-screenshot"
            />
            {{else}}
            <div class="placeholder-screenshot">
              <div class="placeholder-icon">📱</div>
              <p>No preview available</p>
            </div>
            {{/if}}
            
            <!-- Launch Button Overlay -->
            <div class="launch-overlay" id="launch-overlay">
              <div id="launch-buttons-container">
                <!-- Single button shown initially, will be replaced by JavaScript -->
                <button id="launch-app-btn" class="launch-button">
                  <span class="launch-icon">🚀</span>
                  <span id="launch-text">Install</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <!-- Install History Section -->
      <div id="install-history-root"></div>
      
      <!-- Footer -->
      <footer class="catalog-footer">
        <div class="info-section">
          <p>
            <a href="{{REMIX_URL}}" target="_blank">Remix this vibe</a> to make your own version.
            Dream in code with <a href="https://vibes.diy">Vibes DIY</a>.
          </p>
        </div>
      </footer>
    </div>
    
    
    <script>${catalogTitleScript}</script>
    
    <script type="module">
      // Initialize headless install tracking with use-vibes
      // The tracker auto-detects catalog pages and redirects to latest install or creates new
      const { initVibesInstalls } = await import('use-vibes');

      try {
        // Use default autoRedirect: true behavior
        // Tracker will automatically redirect to latest install or create new
        await initVibesInstalls();
      } catch (error) {
        console.error('Failed to initialize install tracker:', error);

        // Fallback: simple redirect after delay
        setTimeout(() => {
          const appSlug = window.location.hostname.split('.')[0].replace(/^v-/, '');
          const domain = window.location.hostname.split('.').slice(1).join('.');
          const subdomain = window.location.hostname.split('.')[0];

          // If we're on catalog page, create a simple install
          if (!subdomain.includes('_') && !subdomain.includes('--')) {
            // Generate simple random ID and redirect
            const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
            let installId = '';
            for (let i = 0; i < 12; i++) {
              installId += chars[Math.floor(Math.random() * chars.length)];
            }

            // All domains now use the new format with v- prefix and -- separator
            const newSubdomain = \`v-\${appSlug}--\${installId}\`;
            window.location.href = \`https://\${newSubdomain}.\${domain}\`;
          }
        }, 500);
      }
    </script>
  </body>
</html>`;
