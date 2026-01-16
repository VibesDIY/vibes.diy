import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./root.js";
import {
  MountVibeParams,
  VibeContextProvider,
} from "@vibes.diy/use-vibes-base";
// import { createBrowserRouter } from 'react-router-dom';

export function mountVibesDiyApp(ctx: MountVibeParams) {
  // (async () => {
  const rootElement = document.getElementById("vibes.diy");
  console.log("vibes.diy getting ready", rootElement);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const root = ReactDOM.createRoot(rootElement!);
  root.render(
    <React.StrictMode>
      <VibeContextProvider mountParams={ctx}>
        <App />
      </VibeContextProvider>
    </React.StrictMode>,
  );
}
