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
    <link
      rel="stylesheet"
      href="https://esm.sh/use-vibes@0.5.7/dist/components/ImgGen.css"
    />
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
      const activeRequests = new Set();
      let lastState = null;

      function updateStreamingState() {
        const currentState = activeRequests.size > 0;
        if (currentState !== lastState) {
          lastState = currentState;
          window.parent.postMessage(
            { type: "streaming", state: currentState },
            "*",
          );
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
          script.onerror = (e) => {
            window.parent.postMessage(
              { type: "screenshot-error", error: "Failed to load html2canvas" },
              "*",
            );
          };
          document.head.appendChild(script);
          return;
        }

        captureScreenshotWithFallback();
      }

      function captureScreenshotWithFallback() {
        try {
          // Let html2canvas-pro do its job with modern CSS
          html2canvas(document.body, {
            allowTaint: true,
            useCORS: true,
            scale: 1,
            logging: false,
          })
            .then((canvas) => {
              // Crop to max 3:1 aspect ratio (3 times taller than wide)
              const croppedCanvas = cropToMaxAspectRatio(canvas, 3);
              const dataURI = croppedCanvas.toDataURL();
              window.parent.postMessage(
                { type: "screenshot", data: dataURI },
                "*",
              );
            })
            .catch((err) => {
              window.parent.postMessage(
                {
                  type: "screenshot-error",
                  error:
                    "Screenshot capture failed: " +
                    (err.message || "Unknown error"),
                },
                "*",
              );
            });
        } catch (err) {
          window.parent.postMessage(
            {
              type: "screenshot-error",
              error: "Unexpected error during screenshot capture",
            },
            "*",
          );
        }
      }

      function pageIsLoaded() {
        window.parent.postMessage({ type: "preview-ready" }, "*");
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
      console.log("[VIBESBOX] executeCode variable declared");

      // Event listeners
      window.addEventListener("message", function (event) {
        console.log("[VIBESBOX] Message received:", event.data);
        if (event.data) {
          if (event.data.type === "command") {
            if (event.data.command === "capture-screenshot") {
              captureScreenshot();
            }
          } else if (event.data.type === "callai-api-key" && event.data.key) {
            window.CALLAI_API_KEY = event.data.key;
          } else if (event.data.type === "execute-code") {
            // New postMessage handler for code execution
            executeCode(event.data);
          }
        }
      });

      window.addEventListener("DOMContentLoaded", function () {
        pageIsLoaded();
      });

      // Global error handlers to catch and log all errors
      window.onerror = function (message, source, lineno, colno, error) {
        const errorDetails = {
          type: "error",
          message: message,
          source: source,
          lineno: lineno,
          colno: colno,
          stack: error?.stack || "No stack trace available",
          timestamp: new Date().toISOString(),
        };
        console.error("Uncaught error:", errorDetails);
        // Send error to parent window
        window.parent.postMessage(
          { type: "iframe-error", error: errorDetails },
          "*",
        );
        return false; // Let the default error handler run
      };

      // Handle unhandled promise rejections
      window.addEventListener("unhandledrejection", function (event) {
        const errorDetails = {
          type: "unhandledrejection",
          reason: event.reason?.toString() || "Unknown reason",
          stack: event.reason?.stack || "No stack trace available",
          timestamp: new Date().toISOString(),
        };
        // Send rejection to parent window
        window.parent.postMessage(
          { type: "iframe-error", error: errorDetails },
          "*",
        );
      });
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
      {
        "imports": {
          "react": "https://esm.sh/react@~19.1.1",
          "react-dom": "https://esm.sh/react-dom@~19.1.1",
          "react-dom/client": "https://esm.sh/react-dom@~19.1.1/client",
          "use-fireproof": "https://esm.sh/use-fireproof@{{FIREPROOF_VERSION}}",
          "call-ai": "https://esm.sh/call-ai",
          "use-vibes": "https://esm.sh/use-vibes",
          "https://esm.sh/use-fireproof": "https://esm.sh/use-fireproof@{{FIREPROOF_VERSION}}",
          "eruda": "https://esm.sh/eruda",
          "three": "https://esm.sh/three"
        }
      }
    </script>

    <!-- Enhanced Babel and JSX error handling script -->
    <script>
      window.babelTransformError = null;

      // 1. Patch console.error to capture JSX parse errors that are only logged to console
      const originalConsoleError = console.error;
      console.error = function (...args) {
        const errorMsg = args.join(" ");

        // Look for specific JSX parse errors that might not trigger other handlers
        if (
          errorMsg.includes("parse-error.ts") ||
          (errorMsg.includes("SyntaxError") &&
            errorMsg.includes("Unexpected token")) ||
          errorMsg.includes("JSX")
        ) {
          // Extract line and position information if available
          let lineInfo = "";
          const lineMatch =
            errorMsg.match(/(\d+):(\d+)/) ||
            errorMsg.match(/line (\d+).+column (\d+)/);
          if (lineMatch) {
            lineInfo = \` at line \${lineMatch[1]}, column \${lineMatch[2]}\`;
          }

          // Extract meaningful error message
          let message = "JSX Syntax Error";
          if (errorMsg.includes("Unexpected token")) {
            const tokenMatch = errorMsg.match(
              /Unexpected token[,:]?\\s*([^,\\n)]+)/,
            );
            if (tokenMatch) {
              message = \`JSX Syntax Error: Unexpected token \${tokenMatch[1].trim()}\`;
            }
          } else if (errorMsg.includes("expected")) {
            const expectedMatch = errorMsg.match(/expected\\s+([^,\\n)]+)/);
            if (expectedMatch) {
              message = \`JSX Syntax Error: Expected \${expectedMatch[1].trim()}\`;
            }
          }

          const errorDetails = {
            type: "error",
            message: \`\${message}\${lineInfo}\`,
            source: "jsx-parser",
            stack: errorMsg,
            timestamp: new Date().toISOString(),
            errorType: "SyntaxError",
          };

          // Only send if we haven't already reported an error
          if (!window.babelTransformError) {
            window.parent.postMessage(
              { type: "iframe-error", error: errorDetails },
              "*",
            );
            window.babelTransformError = errorDetails;
          }
        }

        // Call original console.error
        originalConsoleError.apply(console, args);
      };

      // 2. Patch Babel transform for errors caught during transformation
      if (window.Babel && window.Babel.transform) {
        const originalTransform = window.Babel.transform;
        window.Babel.transform = function (code, options) {
          try {
            return originalTransform.call(this, code, options);
          } catch (err) {
            // Capture and format Babel error
            const errorDetails = {
              type: "error",
              message: \`Babel Syntax Error: \${err.message || "Invalid syntax"}\`,
              source: "babel-transform",
              stack: err.stack || "",
              timestamp: new Date().toISOString(),
              errorType: "SyntaxError",
            };
            // Report error to parent
            window.parent.postMessage(
              { type: "iframe-error", error: errorDetails },
              "*",
            );
            window.babelTransformError = errorDetails;
            throw err;
          }
        };
      }

      // 3. Enhanced unhandled error handler specifically for syntax errors
      window.addEventListener(
        "error",
        function (event) {
          // Skip if we already caught the error elsewhere
          if (window.babelTransformError) return;

          // Focus on syntax errors and parse errors
          if (
            event.error?.stack?.includes("parse-error.ts") ||
            event.message?.includes("SyntaxError") ||
            (event.message === "Script error." && !event.filename)
          ) {
            let message = event.message;
            if (message === "Script error.") {
              message = "JSX Syntax Error: Unable to parse JSX code";
            }

            const errorDetails = {
              type: "error",
              message: message,
              source: event.filename || "jsx-parser",
              lineno: event.lineno || 0,
              colno: event.colno || 0,
              stack: event.error?.stack || "",
              timestamp: new Date().toISOString(),
              errorType: "SyntaxError",
            };

            window.parent.postMessage(
              { type: "iframe-error", error: errorDetails },
              "*",
            );
            window.babelTransformError = errorDetails;
          }
        },
        true,
      );

      // Code execution function
      executeCode = function(data) {
        console.log("[VIBESBOX] executeCode function called with data:", data);
        try {
          // Reset error state
          window.babelTransformError = null;

          // Set up Fireproof debug configuration BEFORE any imports
          if (data.debugConfig && data.debugConfig.enabled) {
            globalThis[Symbol.for("FP_PRESET_ENV")] = {
              FP_DEBUG: data.debugConfig.value || "*",
            };
          }

          // Set up environment variables from message
          window.CALLAI_API_KEY = data.apiKey || "sk-vibes-proxy-managed";
          window.SESSION_ID = data.sessionId || "default-session";
          window.CALLAI_CHAT_URL = data.endpoint || "";
          window.CALLAI_IMG_URL = data.endpoint || "";

          // Clear the container
          const container = document.getElementById("container");
          container.innerHTML = "";

          // Extract import map from HTML importmap element
          function getImportMap() {
            const importMapScript = document.querySelector(
              'script[type="importmap"]',
            );
            if (importMapScript) {
              return JSON.parse(importMapScript.textContent).imports;
            }
            return {};
          }
          const libraryImportMap = getImportMap();

          // Transform imports to handle packages not in import map
          function transformImports(code) {
            const importKeys = Object.keys(libraryImportMap);
            return code.replace(
              /import\\s+(?:(?:\\{[^}]*\\}|\\*\\s+as\\s+\\w+|\\w+(?:\\s*,\\s*\\{[^}]*\\})?)\\s+from\\s+)?['"]([^'"]+)['"];?/g,
              (match, importPath) => {
                // Don't transform if it's in our library map
                if (importKeys.includes(importPath)) {
                  return match;
                }
                // Don't transform if it's already a URL
                if (
                  importPath.includes("://") ||
                  importPath.startsWith("http")
                ) {
                  return match;
                }
                // Don't transform relative imports
                if (
                  importPath.startsWith("./") ||
                  importPath.startsWith("../")
                ) {
                  return match;
                }
                // Replace with ESM.sh URL
                return match.replace(
                  new RegExp(
                    \`['"]\${importPath.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, "\\\\$&")}['"]\`,
                  ),
                  \`"https://esm.sh/\${importPath}"\`,
                );
              },
            );
          }

          // Transform imports first
          const codeWithTransformedImports = transformImports(data.code);

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

          const modifiedCode =
            transformedCode.code.replace(
              /export\\s+default\\s+function\\s+(\\w+)/g,
              "function $1",
            ) +
            \`
          
          // Import React DOM for rendering
          import { createRoot } from 'react-dom/client';
          
          // Render the component directly
          const container = document.getElementById('container');
          const root = createRoot(container);
          root.render(React.createElement(\${functionName}));
          
          // Notify parent that execution was successful
          window.parent.postMessage({ type: 'execution-success' }, '*');
          \`;

          scriptElement.textContent = modifiedCode;
          document.head.appendChild(scriptElement);
        } catch (error) {
          console.error("Code execution failed:", error);
          console.error("Error stack:", error.stack);
          console.error("Error occurred at line:", error.lineNumber);

          const errorDetails = {
            type: "error",
            message: \`Code execution failed: \${error.message}\`,
            source: "code-execution",
            stack: error.stack || "",
            timestamp: new Date().toISOString(),
            errorType: "ExecutionError",
          };
          window.parent.postMessage(
            { type: "iframe-error", error: errorDetails },
            "*",
          );

          // Show error in container
          const container = document.getElementById("container");
          container.innerHTML = \`
            <div style="padding: 20px; color: red; font-family: monospace; white-space: pre-wrap;">
              <h2>Execution Error</h2>
              <p>\\\${error.message}</p>
              <pre>\\\${error.stack}</pre>
            </div>
          \`;
        }
      };
      console.log("[VIBESBOX] executeCode function assigned, type:", typeof executeCode);
    </script>
  </body>
</html>`;

export default iframeHtml;
