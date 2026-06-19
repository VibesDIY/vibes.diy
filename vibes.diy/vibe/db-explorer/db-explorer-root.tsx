import React from "react";
import { BrowserRouter } from "react-router";
import { App } from "./src/App.js";

export function DBExplorerRoot({ base }: { base: string }) {
  return (
    <BrowserRouter basename={base}>
      <App />
    </BrowserRouter>
  );
}
