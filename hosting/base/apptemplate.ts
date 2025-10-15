// HTML template for app rendering - composed from modular components
// This template contains placeholders that get replaced during app generation:
// {{API_KEY}}, {{APP_CODE}}, {{APP_SLUG}}, {{REMIX_BUTTON}}, {{IMPORT_MAP}}

import { styles } from "./template/styles.js";
import { scripts } from "./template/scripts.js";
import { htmlBody, vibeControlScript } from "./template/html.js";

export const template = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.ico" type="image/x-icon" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
    <title>User Generated App</title>
    <script src="/babel.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>${styles}</style>
    <script>${scripts}</script>
  </head>
  <body>${htmlBody}
    <script>
      window.CALLAI_API_KEY = '{{API_KEY}}';
      window.CALLAI_CHAT_URL = 'https://vibes-diy-api.com';
    </script>
    <script type="importmap">
      {{IMPORT_MAP}}
    </script>
    <script type="module">
      if (location.search.includes('debug')) {
        import('eruda').then(m => (m.default ?? m).init())
      }
    </script>
    <script type="text/babel" data-type="module">
      import ReactDOMClient from 'react-dom/client';

      // APP_CODE placeholder will be replaced with actual code
      // prettier-ignore
      {{APP_CODE}}
      // prettier-ignore-end

      const rootElement = document.getElementById('container');
      ReactDOMClient.createRoot(rootElement).render(<App />);
    </script>
    <script type="module">
${vibeControlScript}
    </script>
  </body>
</html>`;
