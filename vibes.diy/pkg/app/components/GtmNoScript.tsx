import React from "react";
import { VibesDiyEnv } from "../config/env.js";

export default function GtmNoScript() {
  const id = VibesDiyEnv.GTM_CONTAINER_ID();
  if (!id) return null;
  return (
    <noscript>
      {
        // eslint-disable-next-line jsx-a11y/iframe-has-title
      }
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${id}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
