import React from "react";
import { ImportMap } from "./serve/importmap.js";
import { GlobalStyles } from "./serve/global-styles.js";
import { Links } from "./serve/links.js";
import { Meta } from "./serve/meta.js";

interface VibePageProps {
  appSlug: string;
  groupId?: string;
  transformedJS: string;
}

export default function VibePage({
  appSlug,
  groupId: _groupId,
  transformedJS,
}: VibePageProps) {
  return (
    <html lang="en">
      <head>
        <ImportMap />
        <Meta
          title={`${appSlug} | Vibes DIY`}
          description={`Vibe: ${appSlug}`}
        />
        <Links />
        <GlobalStyles />
      </head>
      <body>
        <div id="vibes.diy"></div>

        {/* Inject transformed JS - imports resolved by importmap */}
        <script type="module">
          {`
// Create Blob URL from transformed vibe code
const vibeCode = \`${transformedJS.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;
const blob = new Blob([vibeCode], { type: 'application/javascript' });
const moduleURL = URL.createObjectURL(blob);

// Dynamically import to get default export
import(moduleURL).then(async (module) => {
  const AppComponent = module.default;

  // Import ReactDOM and mount
  const ReactDOM = await import('react-dom/client');
  const root = ReactDOM.createRoot(document.getElementById('vibes.diy'));
  const React = await import('react');
  root.render(React.createElement(AppComponent));
}).catch(err => {
  console.error('Failed to mount vibe:', err);
  document.getElementById('vibes.diy').innerHTML = '<pre>Error loading vibe: ' + err.message + '</pre>';
});
`}
        </script>

        {/* Tailwind Browser for runtime CSS */}
        <script
          type="module"
          src="https://esm.sh/@tailwindcss/browser@4"
        ></script>
      </body>
    </html>
  );
}
