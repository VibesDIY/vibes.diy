import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./root.js";
// import { createBrowserRouter } from 'react-router-dom';

// (async () => {
const rootElement = document.getElementById("vibes.diy");
console.log("vibes.diy getting ready", rootElement);
//   const react = await import("react")
//   console.log("react", Object.keys(react))
//   // Create a root and render your app
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const root = ReactDOM.createRoot(rootElement!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
// })();
