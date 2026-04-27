import React from "react";

export function DBExplorerPage({
  importMap,
  base,
  vibeApp,
}: {
  importMap: {
    imports: Record<string, string>;
  };
  base: string;
  vibeApp: { appSlug: string; userSlug: string; fsId?: string };
}) {
  const mountCode = [
    "import { registerDependencies } from '@vibes.diy/vibe-runtime';",
    "import { startDBExplorer } from '@vibes.diy/vibe-db-explorer/start';",
    `registerDependencies(${JSON.stringify(vibeApp)})`,
    `  .then(() => startDBExplorer(${JSON.stringify(base)}));`,
  ].join("\n");
  return (
    <html lang="en">
      <head>
        <script type="importmap" dangerouslySetInnerHTML={{ __html: JSON.stringify(importMap, null, 2) }} />
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Fireproof DB Explorer</title>
      </head>
      <body>
        <div id="db-explorer"></div>
        <script type="module" dangerouslySetInnerHTML={{ __html: mountCode }}></script>
      </body>
    </html>
  );
}
