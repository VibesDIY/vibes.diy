import React from "react";
import { VibesDiyEnv } from "../config/env.js";

function getHostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "vibesdiy.app";
  }
}

export function VibeIframeContainerComponent({
  vibeSlug,
}: {
  vibeSlug: string;
}) {
  const hostname = getHostnameFromUrl(VibesDiyEnv.APP_HOST_BASE_URL());
  const iframeUrl = `https://${vibeSlug}.${hostname}/${location.search}`;
  return (
    <iframe
      src={iframeUrl}
      title={`Vibe: ${vibeSlug}`}
      style={{ width: "100%", height: "100svh", border: "none" }}
      allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad; geolocation; gyroscope; hid; microphone; midi; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; serial; usb; web-share; xr-spatial-tracking"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-orientation-lock allow-pointer-lock allow-downloads allow-top-navigation"
      allowFullScreen
    />
  );
}
