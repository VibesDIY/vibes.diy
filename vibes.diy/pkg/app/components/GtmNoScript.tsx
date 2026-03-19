import React from "react";
import { VibesDiyWebVars } from "../vibes-diy-provider.js";

export default function GtmNoScript({ svcVars }: { svcVars?: VibesDiyWebVars }) {
  const id = svcVars?.env.GTM_CONTAINER_ID;
  if (!id) return null;
  return (
    <noscript>
      {}
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
