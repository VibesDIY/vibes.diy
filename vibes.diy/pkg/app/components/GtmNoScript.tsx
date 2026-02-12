import React from "react";
import { VibeDiySvcVars } from "../vibe-diy-provider.js";

export default function GtmNoScript({ svcVars }: { svcVars?: VibeDiySvcVars }) {
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
