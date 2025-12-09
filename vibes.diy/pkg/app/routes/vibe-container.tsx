import { useParams } from "react-router-dom";
import React, { useEffect } from "react";
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

function callReplace(replaceFn?: (url: string) => void) {
  return replaceFn
    ? replaceFn
    : (url: string) => globalThis.window.location.replace(url);
}

export function VibeContainer({
  replace,
}: {
  replace?: (url: string) => void;
}) {
  const { vibeSlug } = useParams<{ vibeSlug: string }>();

  useEffect(() => {
    if (vibeSlug) {
      const hostname = getHostnameFromUrl(VibesDiyEnv.APP_HOST_BASE_URL());
      const redirectUrl = `https://${vibeSlug}.${hostname}/${location.search}`;
      callReplace(replace)(redirectUrl);
    }
  }, [vibeSlug]);

  if (!vibeSlug) {
    return <div>No vibe slug provided</div>;
  }

  return <div>Redirecting...</div>;
}
