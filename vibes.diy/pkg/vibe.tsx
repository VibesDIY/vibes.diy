import React from "react";
import { ImportMap } from "./serve/importmap.js";
import { Links } from "./serve/links.js";
import { Meta } from "./serve/meta.js";
import VibeControls from "./serve/vibe-controls.js";
import { VibesDiyServCtx } from "./serve/render.js";

// export interface VibePageProps extends ImportMapProp {
//   readonly appSlug: string;
//   readonly groupId?: string;
//   readonly transformedJS?: string;
// }

function MountVibe(props: VibesDiyServCtx) {
  return (
    <script
      type="module"
      dangerouslySetInnerHTML={{ __html: props.transformedJS }}
    />
  );
  // return <script type="module" src={`/vibe-mount?appSlug=${props.vibesCtx.appSlug}`} />
}

export default function VibePage(props: VibesDiyServCtx) {
  const { appSlug } = props.vibesCtx;
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
        <MountVibe {...props} />
        <VibeControls {...props} />
      </body>
    </html>
  );
}
