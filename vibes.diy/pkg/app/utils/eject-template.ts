/**
 * Template for generating standalone HTML files (export/eject functionality)
 * Replaces the old iframe-template.html with a TypeScript-based approach
 * that uses the single source of truth for importmaps
 */

import { getImportMapJson } from "../config/import-map.js";

/**
 * Generates a standalone HTML file that can be downloaded and run independently
 *
 * @param appCode - The user's app code (JSX/React component)
 * @param apiKey - CallAI API key
 * @param callaiEndpoint - CallAI endpoint URL
 * @returns Complete HTML string ready for export
 */
// this seemes unused. it was made to support the html download link on the vibe settings tab
// we should use it there or remove it, maybe remove the duplicated functionality elsewhere if there is some
export async function generateEjectHtml(
  appCode: string,
  apiKey: string,
  callaiEndpoint: string,
): Promise<string> {
  const importMapJson = await getImportMapJson();
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Made on Vibes DIY</title>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
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
  </head>
  <body>
    <div id="container"></div>
    <script>
      window.CALLAI_API_KEY = "${apiKey}";
      window.CALLAI_CHAT_URL = "${callaiEndpoint}";
      window.CALLAI_IMG_URL = "${callaiEndpoint}";
    </script>
    <script type="importmap">
      ${importMapJson}
    </script>
    <script type="text/babel" data-type="module">
      import ReactDOMClient from "react-dom/client";

      // prettier-ignore
      ${appCode}
      // prettier-ignore-end

      const rootElement = document.getElementById("container");
      ReactDOMClient.createRoot(rootElement).render(<App />);
    </script>
    <!--
    Agents see LLMs docs:
      Database: https://use-fireproof.com/llms-full.txt
      CallAI: https://use-fireproof.com/callai-llms.txt
      ImgGen: https://use-fireproof.com/imggen-llms.txt
    -->
  </body>
</html>`;
}

/**
 * Legacy template with placeholder-based approach
 * Kept for backward compatibility but uses the same importmap source
 *
 * Placeholders: {{APP_CODE}}, {{API_KEY}}, {{CALLAI_ENDPOINT}}
 */
export async function getEjectTemplateWithPlaceholders(): Promise<string> {
  const importMapJson = await getImportMapJson();
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Made on Vibes DIY</title>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
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
  </head>
  <body>
    <div id="container"></div>
    <script>
      window.CALLAI_API_KEY = "{{API_KEY}}";
      window.CALLAI_CHAT_URL = "{{CALLAI_ENDPOINT}}";
      window.CALLAI_IMG_URL = "{{CALLAI_ENDPOINT}}";
    </script>
    <script type="importmap">
      ${importMapJson}
    </script>
    <script type="text/babel" data-type="module">
      import ReactDOMClient from "react-dom/client";

      // prettier-ignore
      {{APP_CODE}}
      // prettier-ignore-end

      const rootElement = document.getElementById("container");
      ReactDOMClient.createRoot(rootElement).render(<App />);
    </script>
    <!--
    Agents see LLMs docs:
      Database: https://use-fireproof.com/llms-full.txt
      CallAI: https://use-fireproof.com/callai-llms.txt
      ImgGen: https://use-fireproof.com/imggen-llms.txt
    -->
  </body>
</html>`;
}
