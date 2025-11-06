import React from "react";
import { VibesDiyEnv } from "../config/env.js";

export default function GtmNoScript() {
  if (typeof document === "undefined") return null;
  const id = VibesDiyEnv.GTM_CONTAINER_ID();
  if (!id) return null;
  const hasConsent =
    typeof document !== "undefined" &&
    document.cookie.includes("cookieConsent=true");
  if (!hasConsent) return null;
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
