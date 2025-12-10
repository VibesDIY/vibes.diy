import React from "react";
import { ImportMap } from "./serve/importmap.js";
import { GlobalStyles } from "./serve/global-styles.js";
import { Links } from "./serve/links.js";
import { Meta } from "./serve/meta.js";

export default function Index() {
  return (
    <html lang="en">
      <head>
        <ImportMap />
        <GlobalStyles />
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
        <script
          type="module"
          src="/dist/vibes.diy/pkg/app/vibes.diy.js"
        ></script>

        <div id="vibes.diy"></div>
      </body>
    </html>
  );
}
