import React from "react";
import { ImportMap } from "./serve/importmap.js";
import { Links } from "./serve/links.js";
import { Meta } from "./serve/meta.js";
import { VibesDiyServCtx } from "./serve/render.js";

function MountVibe(props: VibesDiyServCtx) {
  return (
    <script
      type="module"
      dangerouslySetInnerHTML={{ __html: props.transformedJS }}
    />
  );
  // return <script type="module" src={`/vibe-mount?appSlug=${props.vibesCtx.appSlug}`} />
}

export default function Index(props: VibesDiyServCtx) {
  return (
    <html lang="en">
      <head>
        <ImportMap {...props} />
        <script
          type="module"
          src="https://esm.sh/@tailwindcss/browser@4"
        ></script>

        <link rel="stylesheet" href="/app/app.css"></link>

        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <MountVibe {...props} />

        <div id="vibes.diy"></div>
      </body>
    </html>
  );
}

/*
        <script
          type="module"
          src="/dist/vibes.diy/pkg/app/vibes.diy.js"
        ></script>
*/
