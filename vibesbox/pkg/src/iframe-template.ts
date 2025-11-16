export const iframeHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vibesbox</title>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/html2canvas-pro@1.5.8/dist/html2canvas-pro.js"></script>
    <!-- html2canvas-pro handles modern CSS color formats like OKLCH natively -->
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
      }
      #container {
        width: 100%;
        height: 100vh;
      }
    </style>
    <script>
      // Compute parent origin once for safe postMessage targeting
      let __PARENT_ORIGIN = (() => {
        try { return new URL(document.referrer).origin; } catch { return null; }
      })();
      function postToParent(data) {
        const target = __PARENT_ORIGIN || "*"; // Fallback to wildcard if origin unknown
        console.log('[IFRAME] postToParent:', data.type, 'to', target);
        window.parent.postMessage(data, target);
      }
      const activeRequests = new Set();
      let lastState = null;

      function updateStreamingState() {
        const currentState = activeRequests.size > 0;
        if (currentState !== lastState) {
          lastState = currentState;
          postToParent({ type: "streaming", state: currentState });
        }
      }

      const originalFetch = window.fetch;
      window.fetch = (...args) => {
        const reqInfo = args[0];
        activeRequests.add(reqInfo);
        updateStreamingState();

        return originalFetch(...args).then((res) => {
          if (!res.body) {
            activeRequests.delete(reqInfo);
            updateStreamingState();
            return res;
          }
          const reader = res.body.getReader();
          const stream = new ReadableStream({
            start(controller) {
              function pump() {
                reader.read().then(({ done, value }) => {
                  if (done) {
                    activeRequests.delete(reqInfo);
                    updateStreamingState();
                    controller.close();
                    return;
                  }
                  controller.enqueue(value);
                  pump();
                });
              }
              pump();
            },
          });
          return new Response(stream, { headers: res.headers });
        });
      };

      // Screenshot functionality
      function cropToMaxAspectRatio(canvas, maxAspectRatio) {
        const width = canvas.width;
        const height = canvas.height;
        const currentAspectRatio = height / width;

        // If already within the max aspect ratio, return original canvas
        if (currentAspectRatio <= maxAspectRatio) {
          return canvas;
        }

        // Calculate new dimensions - crop from the bottom
        const newHeight = width * maxAspectRatio;
        const cropY = 0; // Start from top

        // Create new canvas with cropped dimensions
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = width;
        croppedCanvas.height = newHeight;

        const ctx = croppedCanvas.getContext("2d");

        // Draw cropped portion of original canvas
        ctx.drawImage(
          canvas,
          0,
          cropY,
          width,
          newHeight, // Source rectangle (crop from original)
          0,
          0,
          width,
          newHeight, // Destination rectangle (full new canvas)
        );

        return croppedCanvas;
      }

      function captureScreenshot() {
        // Check if html2canvas is loaded
        if (typeof html2canvas === "undefined") {
          // Try to load html2canvas-pro dynamically
          const script = document.createElement("script");
          script.src =
            "https://unpkg.com/html2canvas-pro@1.5.8/dist/html2canvas-pro.js";
          script.onload = () => {
            captureScreenshotWithFallback();
          };
          document.head.appendChild(script);
          return;
        }

        captureScreenshotWithFallback();
      }

      function captureScreenshotWithFallback() {
        // Let html2canvas-pro do its job with modern CSS
        html2canvas(document.body, {
          allowTaint: true,
          useCORS: true,
          scale: 1,
          logging: false,
        }).then((canvas) => {
          // Crop to max 3:1 aspect ratio (3 times taller than wide)
          const croppedCanvas = cropToMaxAspectRatio(canvas, 3);
          const dataURI = croppedCanvas.toDataURL();
          postToParent({ type: "screenshot", data: dataURI });
        });
      }

      function pageIsLoaded() {
        console.log('[IFRAME] pageIsLoaded called');
        postToParent({ type: "preview-ready" });
        setTimeout(captureScreenshot, 2000);
      }

      // For rapid updates (optional)
      let currentApp = null;
      function updateAppComponent(code) {
        try {
          // Evaluate new component code
          eval(code);

          // If we implement rapid updates, we'll need to re-render here
          if (currentApp && window.ReactDOM) {
            // Re-render with new component
          }

          return true;
        } catch (error) {
          console.error("Failed to update component:", error);
          return false;
        }
      }

      // Declare executeCode function before event listener
      var executeCode; // Will be defined later

      // Event listeners
      window.addEventListener("message", function (event) {
        // Establish parent origin from the first execute-code message if not known
        if (event.source === window.parent && event.data?.type === 'execute-code' && !__PARENT_ORIGIN) {
          __PARENT_ORIGIN = event.origin;
        }
        // Log ALL messages received
        
        if (event.data) {
          if (event.data.type === "command") {
            if (event.data.command === "capture-screenshot") {
              captureScreenshot();
            }
          } else if (event.data.type === "callai-api-key" && event.data.key) {
            window.CALLAI_API_KEY = event.data.key;
          } else if (event.data.type === "execute-code") {
            // New postMessage handler for code execution
            console.log('[IFRAME] Received execute-code message');
            executeCode(event.data);
          }
        }
      });

      // Removed DOMContentLoaded listener - preview-ready now sent after React renders
    </script>
  </head>
  <body>
    <div id="container">
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          text-align: center;
          font-family:
            -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto,
            sans-serif;
        "
      >
        <div>
          <a
            href="https://vibes.diy"
            target="_parent"
            style="
              display: inline-block;
              padding: 12px 24px;
              color: #1976d2;
              font-weight: 500;
            "
            >Build with Vibes DIY →</a
          >
        </div>
      </div>
    </div>
    <script type="importmap">
      {{IMPORT_MAP}}
    </script>

    <script>
      // Do not read auth tokens from URL parameters (avoid leakage via referrers/history).

      // Code execution function
      executeCode = function(data) {
        console.log('[IFRAME] executeCode called, authToken present:', !!data.authToken);

        // Store auth token FIRST before any other processing
        // Set up complete logged-in state for mountVibesApp
        if (data.authToken) {
          try {
            // Store for call-ai library (existing behavior)
            localStorage.setItem('vibes-api-auth-token', data.authToken);

            // ALSO store with the key mountVibesApp/use-vibes expects
            localStorage.setItem('vibes-diy-auth-token', data.authToken);

            // Set the sync-enabled flag so mountVibesApp skips AuthWall
            localStorage.setItem('fireproof-sync-enabled', 'true');

            // Add body class for current session state
            document.body.classList.add('vibes-connect-true');

            // Dispatch custom event to trigger useFireproof's enableSync()
            document.dispatchEvent(new CustomEvent('vibes-sync-enable'));

            console.log('[IFRAME] Auth state configured from parent');
          } catch (e) {
            console.error('[IFRAME] Failed to set auth state:', e);
          }
        } else {
          // No authToken provided - clear any stale auth state to avoid logged-in UI persisting
          try {
            localStorage.removeItem('vibes-api-auth-token');
            localStorage.removeItem('vibes-diy-auth-token');
            localStorage.removeItem('fireproof-sync-enabled');
            document.body.classList.remove('vibes-connect-true');

            // Dispatch custom event to trigger useFireproof's disableSync()
            document.dispatchEvent(new CustomEvent('vibes-sync-disable'));

            console.log('[IFRAME] Auth state cleared (no authToken provided)');
          } catch (e) {
            console.error('[IFRAME] Failed to clear auth state:', e);
          }
        }

        // Store UUID globally for Fireproof ledger naming
        if (data.vibeUUID) {
          globalThis.VIBE_UUID = data.vibeUUID;
        }

        // Store titleId globally (optional, for reference)
        if (data.titleId) {
          globalThis.VIBE_TITLE_ID = data.titleId;
        }

        // Store hosting domain globally for screenshot URLs
        if (data.hostingDomain) {
          globalThis.VIBE_HOSTING_DOMAIN = data.hostingDomain;
        }

        // Set up Fireproof debug configuration BEFORE any imports
          if (data.debugConfig && data.debugConfig.enabled) {
            globalThis[Symbol.for("FP_PRESET_ENV")] = {
              FP_DEBUG: data.debugConfig.value || "*",
            };
          }

          // Set up environment variables from message
          window.CALLAI_API_KEY = data.apiKey || "sk-vibes-proxy-managed";
          window.SESSION_ID = data.sessionId || "default-session";

          // Only set CALLAI_CHAT_URL if endpoint is provided (not undefined/empty)
          // Otherwise let call-ai use its default (vibes-diy-api.com)
          if (data.endpoint) {
            window.CALLAI_CHAT_URL = data.endpoint;
            window.CALLAI_IMG_URL = data.endpoint;
          } else {
          }


          // Clear the container
          const container = document.getElementById("container");
          container.innerHTML = "";

          // Get import map from DOM importmap
          const importMapScript = document.querySelector('script[type="importmap"]');
          const libraryImportMap = importMapScript
            ? JSON.parse(importMapScript.textContent).imports
            : {};

          // Transform imports to handle packages not in import map
          // SYNC: @vibes.diy/hosting-base/utils/codeTransform.ts
          const importKeys = Object.keys(libraryImportMap);
          const codeWithTransformedImports = data.code.replace(
            /import\\s+(?:(?:\\{[^}]*\\}|\\*\\s+as\\s+\\w+|\\w+(?:\\s*,\\s*\\{[^}]*\\})?)\\s+from\\s+)?['"]([^'"]+)['"];?/g,
            (match, importPath) => {
              // Don't transform if it's in our library map
              if (importKeys.includes(importPath)) {
                return match;
              }
              // Don't transform if it's already a URL
              if (importPath.includes("://") || importPath.startsWith("http")) {
                return match;
              }
              // Don't transform relative imports
              if (importPath.startsWith("./") || importPath.startsWith("../")) {
                return match;
              }
              // Replace with ESM.sh URL
              return match.replace(
                new RegExp(\`['"]\${importPath.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, "\\\\$&")}['"]\`),
                \`"https://esm.sh/\${importPath}"\`,
              );
            },
          );

          // Transform JSX but keep imports as ES6
          let transformedCode;
          try {
            transformedCode = window.Babel.transform(
              codeWithTransformedImports,
              {
                presets: ["react"],
              },
            );
          } catch (babelError) {
            throw new Error("JSX compilation failed: " + babelError.message);
          }

          // Create a script tag with type="module" to handle ES6 imports
          const scriptElement = document.createElement("script");
          scriptElement.type = "module";

          // Extract function name and modify the transformed code
          let functionName = "App"; // default fallback
          const exportMatch = codeWithTransformedImports.match(
            /export\\s+default\\s+function\\s+(\\w+)/,
          );
          if (exportMatch) {
            functionName = exportMatch[1];
          }

          // Set showVibesSwitch on globalThis for module script access
          globalThis.SHOW_VIBES_SWITCH = data.showVibesSwitch !== false;

          const modifiedCode =
            transformedCode.code.replace(
              /export\\s+default\\s+function\\s+(\\w+)/g,
              "function $1",
            ) +
            \`

          // Import mountVibesApp for full auth UI integration
          import { mountVibesApp } from 'use-vibes';

          // Get title and construct screenshot URL from globals
          const title = globalThis.VIBE_TITLE_ID || 'Vibe';
          // Use hosting domain from global, fallback to vibesdiy.app
          const hostingDomain = globalThis.VIBE_HOSTING_DOMAIN || 'vibesdiy.app';
          const imageUrl = \\\`https://\\\${globalThis.VIBE_TITLE_ID}.\\\${hostingDomain}/screenshot.png\\\`;

          // Mount with AuthWall and VibesPanel
          const container = document.getElementById('container');
          mountVibesApp({
            container,
            appComponent: \${functionName},
            title,
            imageUrl,
            showVibesSwitch: globalThis.SHOW_VIBES_SWITCH !== false
          });

          // Wait for React to render, then notify parent that preview is ready
          setTimeout(() => {
            postToParent({ type: 'preview-ready' });
          }, 100);
          \`;

          scriptElement.textContent = modifiedCode;
          document.head.appendChild(scriptElement);
      };
    </script>
  </body>
</html>`;

export default iframeHtml;
