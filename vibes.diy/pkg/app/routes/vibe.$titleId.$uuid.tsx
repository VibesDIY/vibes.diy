import React from "react";
import { useParams } from "react-router";
import { VibesDiyEnv } from "../config/env.js";

export function meta({
  params,
}: {
  params: { titleId: string; uuid: string };
}) {
  return [
    { title: `${params.titleId} | Vibes DIY` },
    { name: "description", content: `Running instance of ${params.titleId}` },
  ];
}

function getHostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "vibesdiy.app";
  }
}

export default function VibeInstanceViewer() {
  const { titleId, uuid } = useParams<{ titleId: string; uuid: string }>();

  if (!titleId || !uuid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-lg">Missing title ID or UUID</p>
        </div>
      </div>
    );
  }

  // Use subdomain pattern like the existing vibe route
  // Pass instance UUID as query parameter for data isolation
  const hostname = getHostnameFromUrl(VibesDiyEnv.APP_HOST_BASE_URL());
  const iframeUrl = `https://${titleId}.${hostname}/?instance=${uuid}`;

  return (
    <div className="relative w-full h-screen bg-gray-900">
      <iframe
        src={iframeUrl}
        title={`${titleId} - ${uuid}`}
        className="w-full h-full border-none"
        allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; gamepad; geolocation; gyroscope; hid; microphone; midi; payment; picture-in-picture; publickey-credentials-get; screen-wake-lock; serial; usb; web-share; xr-spatial-tracking"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-orientation-lock allow-pointer-lock allow-downloads allow-top-navigation"
        allowFullScreen
      />
    </div>
  );
}
