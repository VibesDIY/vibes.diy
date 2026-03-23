import React from "react";
import { createRoot } from "react-dom/client";
import { getVibesGlobalCSS } from "@vibes.diy/base";

export async function startDBExplorer(base: string) {
  const style = document.createElement("style");
  style.textContent = getVibesGlobalCSS();
  document.head.appendChild(style);

  const element = document.getElementById("db-explorer");
  if (!element) {
    throw new Error(`Can't find the dom element root`);
  }
  const root = createRoot(element);
  import("@vibes.diy/vibe-db-explorer/root").then(({ DBExplorerRoot }) => {
    const providerElement = React.createElement(DBExplorerRoot, { base });
    root.render(providerElement);
  });
}
