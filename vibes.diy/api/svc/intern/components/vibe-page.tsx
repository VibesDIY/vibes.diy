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

      <meta property="og:type" content="website" />
      <meta property="og:title" content={metaProps.title} />
      <meta property="og:description" content={metaProps.description} />
      {metaProps.canonicalUrl && <meta property="og:url" content={metaProps.canonicalUrl} />}
      {metaProps.imageUrl && <meta property="og:image" content={metaProps.imageUrl} />}

      <meta name="twitter:card" content={metaProps.imageUrl ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={metaProps.title} />
      <meta name="twitter:description" content={metaProps.description} />
      {metaProps.imageUrl && <meta name="twitter:image" content={metaProps.imageUrl} />}
    </>
  );
}

function MountVibe(props: VibesDiyServCtx) {
  return <script type="module" dangerouslySetInnerHTML={{ __html: props.mountJS }} />;
}

// Client-side belt-and-suspenders for the bare-host redirect (#2354): if this
// sandbox document is loaded as the TOP-LEVEL page (not embedded in the
// vibes.diy viewer's <iframe>), bounce to the canonical /vibe/<owner>/<app>
// wrapper so the user gets sign-in + chrome. Complements the server 302 (keyed
// on Sec-Fetch-Dest), which a hard-cached versioned document or a header-less
// browser can bypass. Runs first in <head> so it fires before the runtime
// module graph loads. `window.top === window.self` never throws cross-origin,
// so no try/catch is needed. Escapes `<` so the URL can't break out of the
// inline <script>.
function TopLevelRedirectGuard({ topLevelRedirect }: VibesDiyServCtx) {
  if (!topLevelRedirect) return null;
  const js = `if(window.top===window.self){window.location.replace(${JSON.stringify(topLevelRedirect)})}`.replace(/</g, "\\u003c");
  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}

function vibesStyles(props: VibesDiyServCtx, path: string) {
  return BuildURI.from(props.svcEnv.VIBES_DIY_PUBLIC_BASE_URL).appendRelative(path).toString();
}

// The mount root. When the SSR executor produced HTML (`props.ssrHtml`), inject
// it and mark the container `data-vibe-ssr` so `mountVibe` hydrates this exact
// markup rather than re-rendering (#2802 slice 4). The injected string is
// `renderVibeToString(comps, mountParams)` and `mountVibe` rebuilds the same
// tree, so the markup lines up for hydration. No `ssrHtml` ⇒ today's empty,
// marker-less container (client-only render).
function VibeAppContainer({ ssrHtml }: VibesDiyServCtx) {
  if (ssrHtml === undefined) {
    return <div className="vibe-app-container" />;
  }
  return <div className="vibe-app-container" data-vibe-ssr dangerouslySetInnerHTML={{ __html: ssrHtml }} />;
}

export function VibePage(props: VibesDiyServCtx) {
  // const { appSlug } = props.bindings;
  return (
    <html lang="en">
      <head>
        <TopLevelRedirectGuard {...props} />
        <ImportMap {...props} />
        <Meta {...props} />
        <Links />
        <link rel="stylesheet" href={vibesStyles(props, "/vibes-controls/styles.css")} />
        <script type="module" src="https://esm.sh/@tailwindcss/browser@4" />
      </head>
      <body className="vibe-app-surface">
        <VibeAppContainer {...props} />
        <MountVibe {...props} />
        {/* <VibeControls {...props} /> */}
      </body>
    </html>
  );
}
