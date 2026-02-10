import { BuildURI } from "@adviser/cement";
import { VibesDiyServCtx } from "@vibes.diy/api-types";

import React from "react";

export function ImportMap(prop: VibesDiyServCtx) {
  return <script type="importmap" dangerouslySetInnerHTML={{ __html: JSON.stringify(prop.importMap, null, 2) }} />;
}

export function Links() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
      />
    </>
  );
}

export function Meta({ metaProps }: VibesDiyServCtx) {
  return (
    <>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{metaProps.title}</title>
      <meta name="description" content={metaProps.description} />
    </>
  );
}

function MountVibe(props: VibesDiyServCtx) {
  return <script type="module" dangerouslySetInnerHTML={{ __html: props.mountJS }} />;
}

function vibesStyles(props: VibesDiyServCtx, path: string) {
  return BuildURI.from(props.env.VIBES_DIY_STYLES_URL).appendRelative(path).toString();
}

export function VibePage(props: VibesDiyServCtx) {
  // const { appSlug } = props.bindings;
  return (
    <html lang="en">
      <head>
        <ImportMap {...props} />
        <Meta {...props} />
        <Links />
        <link rel="stylesheet" href={vibesStyles(props, "/app/app.css")} />
        <link rel="stylesheet" href={vibesStyles(props, "/vibes-controls/styles.css")} />
        <script type="module" src="https://esm.sh/@tailwindcss/browser@4" />
      </head>
      <body className="grid-background">
        <div className="vibe-app-container" />
        <MountVibe {...props} />
        {/* <VibeControls {...props} /> */}
      </body>
    </html>
  );
}
