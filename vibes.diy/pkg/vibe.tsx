import React from "react";
import { ImportMap } from "./serve/importmap.js";
import { GlobalStyles } from "./serve/global-styles.js";
import { Links } from "./serve/links.js";
import { Meta } from "./serve/meta.js";
import { clerkAuthScript } from "./serve/clerk-auth-script.js";
import VibeControls from "./serve/vibe-controls.js";

interface VibePageProps {
  appSlug: string;
  groupId?: string;
  transformedJS: string;
  clerkPublishableKey: string;
}

export default function VibePage({
  appSlug,
  groupId: _groupId,
  transformedJS,
  clerkPublishableKey,
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
      <body className="grid-background">
        <div id="vibes.diy" className="min-h-screen"></div>

        {/* Server-side rendered vibe controls (no React at runtime) */}
        <VibeControls />

        {/* Auth check and vibe mounting - combined to prevent flash */}
        <script type="module">
          {clerkAuthScript(clerkPublishableKey, transformedJS)}
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
