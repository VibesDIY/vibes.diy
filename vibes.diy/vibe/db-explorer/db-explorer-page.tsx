import React from "react";
import { createRoot } from "react-dom/client";
import { DBExplorerRoot } from "./db-explorer-root.js";

export function startDBExplorer(base: string) {
  const element = document.getElementById("db-explorer");
  if (!element) {
    throw new Error(`Can't find the dom element root`);
  }
  const root = createRoot(element);
  // Wrap in VibeContextProvider if we have metadata

  const providerElement = React.createElement(DBExplorerRoot, {
    base,
  });
  root.render(providerElement);
}

export function DBExplorerPage({
  importMap,
  base,
}: {
  importMap: {
    imports: Record<string, string>;
  };
  base: string;
}) {
  const mountCode = [
    "import { startDBExplorer } from '@vibes.diy/vibe-db-explorer';",
    `startDBExplorer(${JSON.stringify(base)});`,
  ].join("\n");
  return (
    <html lang="en">
      <head>
        <script type="importmap" dangerouslySetInnerHTML={{ __html: JSON.stringify(importMap, null, 2) }} />
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="/db-explorer.css" />
        <title>Fireproof DB Explorer</title>
      </head>
      <body>
        <div id="db-explorer"></div>
        <script type="module" dangerouslySetInnerHTML={{ __html: mountCode }}></script>
      </body>
    </html>
  );
}
