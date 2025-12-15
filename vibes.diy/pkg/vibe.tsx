import React from "react";
import { ImportMap, ImportMapProp } from "./serve/importmap.js";
import { Links } from "./serve/links.js";
import { Meta } from "./serve/meta.js";
import VibeControls from "./serve/vibe-controls.js";

interface VibePageProps extends ImportMapProp {
  appSlug: string;
  groupId?: string;
}

export default function VibePage(props: VibePageProps) {
  const { appSlug } = props;
  return (
    <html lang="en">
      <head>
        <ImportMap {...props} />
        <Meta
          title={`${appSlug} | Vibes DIY`}
          description={`Vibe: ${appSlug}`}
        />
        <Links />
        <link rel="stylesheet" href="/app/app.css" />
        <link rel="stylesheet" href="/serve/vibes-controls/styles.css" />
        <script type="module" src="https://esm.sh/@tailwindcss/browser@4" />
      </head>
      <body className="grid-background">
        <div id={appSlug} className="vibe-app-container" />
        <script type="module" src={`/vibe-mount?appSlug=${appSlug}`} />
        <VibeControls />
      </body>
    </html>
  );
}
