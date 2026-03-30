import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getVibesGlobalCSS } from "@vibes.diy/base";
import { App } from "./App.js";

const style = document.createElement("style");
style.textContent = getVibesGlobalCSS();
document.head.appendChild(style);

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
