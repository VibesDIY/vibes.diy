import React from "react";
import { createRoot } from "react-dom/client";
import { BuildURI, loadAsset } from "@adviser/cement";

export async function startDBExplorer(base: string) {
  let localDev = "public/";
  if (!base || base == "/") {
    localDev = "";
  }
  const x = await loadAsset(`./${localDev}db-explorer.css`, {
    basePath: () =>
      BuildURI.from(import.meta.url)
        .cleanParams()
        .toString(),
  });
  console.log("Loaded CSS content:", import.meta.url, x);

  const style = document.createElement("style");
  style.textContent = x.Ok();
  document.head.appendChild(style);

  /*
   const link = document.createElement("link");
   link.rel = "stylesheet";
   // console.log("xxx", import.meta, import.meta.resolve('./db-explorer.css'))
   link.href = import.meta.resolve('./db-explorer.css')
   document.head.appendChild(link);
   */

  //  const style = document.createElement("link");
  //  style.textContent = rCss.Ok();
  //  document.head.appendChild(style);

  // link.rel = "stylesheet";
  // link.href = pathOps.join(urlDirname(import.meta.url).toString(), 'public/db-explorer.css');

  const element = document.getElementById("db-explorer");
  if (!element) {
    throw new Error(`Can't find the dom element root`);
  }
  const root = createRoot(element);
  // Wrap in VibeContextProvider if we have metadata
  // import.meta.url = import.meta.url + '?db-explorer-start'; // add query to help identify the module in loadAsset
  console.log("Starting DB Explorer with base:", import.meta);
  import("@vibes.diy/vibe-db-explorer/root").then(({ DBExplorerRoot }) => {
    const providerElement = React.createElement(DBExplorerRoot, { base });
    root.render(providerElement);
  });
  // });
}
