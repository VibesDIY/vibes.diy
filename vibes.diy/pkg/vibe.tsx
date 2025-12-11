import React from "react";
import { ImportMap, ImportMapProp } from "./serve/importmap.js";
import { Links } from "./serve/links.js";
import { Meta } from "./serve/meta.js";
// import { clerkAuthScript } from "./serve/clerk-auth-script.js";
import VibeControls from "./serve/vibe-controls.js";

interface VibePageProps extends ImportMapProp {
  appSlug: string;
  groupId?: string;
  transformedJS: string;
  clerkPublishableKey: string;
}

export default function VibePage(props: VibePageProps) {
  const {
    appSlug,
    groupId: _groupId,
    // transformedJS,
    // clerkPublishableKey,
  } = props;
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
        <link href="/serve/vibes-controls/styles.css" />
        <script type="module" src="https://esm.sh/@tailwindcss/browser@4" />
      </head>
      <body className="grid-background">
        <div id={appSlug} />
        <script type="module" src={`/vibe-mount?appSlug=${appSlug}`} />

        {/* <div id="vibes.diy" className="min-h-screen"></div> */}
        <VibeControls />

        {/* Auth check and vibe mounting - combined to prevent flash
        <script type="module"> {clerkAuthScript(clerkPublishableKey, transformedJS)}
        </script> */}

        {/* Tailwind Browser for runtime CSS */}
      </body>
    </html>
  );
}
