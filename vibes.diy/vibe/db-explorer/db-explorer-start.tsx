import React from "react";
import { createRoot } from "react-dom/client";
import { DBExplorerRoot } from "./db-explorer-root.js";

export function startDBExplorer(base: string) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${import.meta.url}/public/db-explorer.css`;
  document.head.appendChild(link);

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
