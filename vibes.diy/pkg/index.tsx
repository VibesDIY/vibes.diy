import type React from "react";

function ImportMap() {
  const ver = {
    FP: "0.24.3-dev-ensure-cloud-token-1",
  };
  const importMap = {
    "dequal/lite": "https://esm.sh/dequal@2.0.3/lite",
    "use-sync-external-store": "https://esm.sh/use-sync-external-store@1.6.0",
    "@adviser/cement": "https://esm.sh/@adviser/cement@0.5.5",
    "@clerk/clerk-react":
      "https://esm.sh/@clerk/clerk-react?deps=react@19.2.1,react-dom@19.2.1",
    multiformats: "https://esm.sh/multiformats",
    cborg: "https://esm.sh/cborg",
    "cborg/json": "https://esm.sh/cborg/json",
    "cborg/length": "https://esm.sh/cborg/length",
    zod: "https://esm.sh/zod",
    jose: "https://esm.sh/jose",
    yaml: "https://esm.sh/yaml",
    "posthog-js":
      "https://esm.sh/posthog-js?deps=react@19.2.1,react-dom@19.2.1",
    "posthog-js@1.302.2":
      "https://esm.sh/posthog-js?deps=react@19.2.1,react-dom@19.2.1",
    "posthog-js/react":
      "https://esm.sh/posthog-js/react?deps=react@19.2.1,react-dom@19.2.1",

    react: "https://esm.sh/react@19.2.1",
    "/react": "https://esm.sh/react@19.2.1",

    "react?target=es2022": "https://esm.sh/react@19.2.1",
    "/react?target=es2022": "https://esm.sh/react@19.2.1",

    "react@^=18?target=es2022": "https://esm.sh/react@19.2.1",
    "/react@^=18?target=es2022": "https://esm.sh/react@19.2.1",

    "react@%3E=18?target=es2022": "https://esm.sh/react@19.2.1",
    "/react@%3E=18?target=es2022": "https://esm.sh/react@19.2.1",
    "react@>=18?target=es2022": "https://esm.sh/react@19.2.1",
    "/react@>=18?target=es2022": "https://esm.sh/react@19.2.1",

    "react@%3E=18": "https://esm.sh/react@19.2.1",
    "/react@%3E=18": "https://esm.sh/react@19.2.1",
    "react@>=18": "https://esm.sh/react@19.2.1",
    "/react@>=18": "https://esm.sh/react@19.2.1",

    "/react@^19.2.0?target=es2022": "https://esm.sh/react@19.2.1",
    "/react@19.2.1/es2022/react.mjs": "https://esm.sh/react@19.2.1",
    "react@19.3.0-canary-fd524fe0-20251121": "https://esm.sh/react@19.2.1",
    "/react@19.3.0-canary-fd524fe0-20251121": "https://esm.sh/react@19.2.1",
    "react-dom": "https://esm.sh/react-dom@19.2.1",
    "react-dom/client": "https://esm.sh/react-dom@19.2.1/client",
    "react-router":
      "https://esm.sh/react-router?deps=react@19.2.1,react-dom@19.2.1",
    "react-router-dom":
      "https://esm.sh/react-router-dom?deps=react@19.2.1,react-dom@19.2.1",
    "@fireproof/core-runtime":
      "https://esm.sh/@fireproof/core-runtime@0.24.3-dev-ensure-cloud-token-1",
    "call-ai": "https://esm.sh/call-ai@v0.14.5",

    "react-hot-toast": "https://esm.sh/react-hot-toast",
    "@radix-ui/react-slot": "https://esm.sh/@radix-ui/react-slot",
    "class-variance-authority": "https://esm.sh/class-variance-authority",
    clsx: "https://esm.sh/clsx",
    "react-markdown": "https://esm.sh/react-markdown",

    "tailwind-merge": "https://esm.sh/tailwind-merge",
    "@monaco-editor/react": "https://esm.sh/@monaco-editor/react",
    "@shikijs/monaco": "https://esm.sh/@shikijs/monaco",
    "shiki/core": "https://esm.sh/shiki/core",
    "shiki/langs/javascript.mjs": "https://esm.sh/shiki/langs/javascript.mjs",
    "shiki/langs/typescript.mjs": "https://esm.sh/shiki/langs/typescript.mjs",
    "shiki/langs/jsx.mjs": "https://esm.sh/shiki/langs/jsx.mjs",
    "shiki/langs/tsx.mjs": "https://esm.sh/shiki/langs/tsx.mjs",
    "shiki/themes/github-dark-default.mjs":
      "https://esm.sh/shiki/themes/github-dark-default.mjs",
    "shiki/themes/github-light-default.mjs":
      "https://esm.sh/shiki/themes/github-light-default.mjs",
    "shiki/engine/oniguruma": undefined,
    "react-cookie-consent": undefined,

    "use-fireproof": `https://esm.sh/use-fireproof@${ver.FP}`,

    "@fireproof/core-keybag": "FP",

    "@vibes.diy/prompts": "/dist/prompts/pkg/index.js",
    "@vibes.diy/use-vibes-base": "/dist/use-vibes/base/index.js",
  };

  return (
    <script type="importmap">
      {JSON.stringify({ imports: enhance(importMap, ver) }, null, 2)}
    </script>
  );
}

function addReact(key: string, inUrl: string) {
  // Don't add React deps to React itself or non-React packages
  const skipDeps = [
    "react",
    "/react",
    "react-dom",
    "clsx",
    "multiformats",
    "cborg",
    "zod",
    "jose",
    "yaml",
    "tailwind-merge",
    "class-variance-authority",
    "dequal/lite",
    "use-sync-external-store",
    "@adviser/cement",
  ];

  if (skipDeps.some((skip) => key.startsWith(skip))) {
    return inUrl;
  }

  if (inUrl.startsWith("http")) {
    const url = new URL(inUrl);
    url.searchParams.set("deps", "react@19.2.1,react-dom@19.2.1");
    return url.toString();
  }
  return inUrl;
}

function enhance(
  importMap: Record<string, string | undefined>,
  ver: Record<string, string>,
) {
  return Object.entries(importMap).reduce(
    (acc, [k, v]) => {
      if (ver[v as string]) {
        acc[k] = `https://esm.sh/${k}@${ver[v]}`;
      } else {
        switch (v) {
          case undefined:
            acc[k] = `https://esm.sh/${k}`;
            break;
          default:
            acc[k] = v;
            break;
        }
      }
      acc[k] = addReact(k, acc[k]);
      return acc;
    },
    {} as Record<string, string>,
  );
}

export function Links() {
  const base = "/public/";
  return [
    {
      rel: "icon",
      type: "image/svg+xml",
      href: `${base}favicon.svg`,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "32x32",
      href: `${base}favicon-32x32.png`,
    },
    {
      rel: "icon",
      type: "image/png",
      sizes: "16x16",
      href: `${base}favicon-16x16.png`,
    },
    { rel: "alternate icon", href: `${base}favicon.ico` },
    {
      rel: "apple-touch-icon",
      sizes: "180x180",
      href: `${base}apple-touch-icon.png`,
    },
    {
      rel: "manifest",
      href: `${base}site.webmanifest`,
    },
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
    },
  ].map((link) => <link {...link} />);
}

function Meta() {
  const metas = [
    { title: "Vibes DIY" },
    { name: "description", content: "Vibe coding made easy" },
    { property: "og:title", content: "Vibes DIY" },
    { property: "og:description", content: "Vibe coding made easy" },
    { property: "og:image", content: "https://vibes.diy/card2.png" },
    { property: "og:url", content: "https://vibes.diy" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Vibes DIY" },
    { name: "twitter:description", content: "Vibe coding made easy" },
    { name: "twitter:image", content: "https://vibes.diy/card2.png" },
    { name: "twitter:url", content: "https://vibes.diy" },
  ];
  return (
    <>
      {metas.map((meta) => (
        <meta {...meta} />
      ))}{" "}
    </>
  );
}

export default function Index() {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/app/app.css"></link>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ImportMap />
        <script
          type="module"
          src="/dist/vibes.diy/pkg/app/vibes.diy.js"
        ></script>

        <div id="vibes.diy"></div>

        <script
          type="module"
          src="https://esm.sh/@tailwindcss/browser@4"
        ></script>
        <script
          type="module"
          src="https://esm.sh/@babel/standalone/babel.min.js"
        ></script>
      </body>
    </html>
  );
}
