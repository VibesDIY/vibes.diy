import React from "react";
import { createRoot } from "react-dom/client";
import { DBExplorerRoot } from "./db-explorer-root.js";

function insertStylesheet(href: string) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
}

export function startDBExplorer(base: string) {
  insertStylesheet(`${import.meta.url}/public/db-explorer-base.css`);
  insertStylesheet(`${import.meta.url}/public/db-explorer.css`);

  const element = document.getElementById("db-explorer");
  if (!element) {
    throw new Error(`Can't find the dom element root`);
  }
  const root = createRoot(element);
  // Wrap in VibeContextProvider if we have metadata

  const providerElement = React.createElement(DBExplorerRoot, {
    base,
  });
  root.render(providerElement);
}
