import React, { useState, useEffect } from "react";

interface InlinePreviewProps {
  code: string;
  sessionId: string;
  codeReady: boolean;
}

// Get from env or config
const PREVIEW_SERVER_URL = "http://localhost:8001";

// Uses the code without publishing, but with relaxed iframe sandboxing
// If data is throw away here, why do we need to publish?? Or vibe controls??

export function InlinePreview({
  code,
  sessionId: _sessionId,
  codeReady,
}: InlinePreviewProps) {
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codeReady || !code) {
      setSrcdoc(null);
      return;
    }

    const fetchPreview = async () => {
      try {
        setError(null);
        const response = await fetch(`${PREVIEW_SERVER_URL}/render-preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || "Failed to render preview");
        }

        const html = await response.text();
        setSrcdoc(html);
      } catch (err) {
        setError((err as Error).message);
        setSrcdoc(null);
      }
    };

    fetchPreview();
  }, [code, codeReady]);

  if (error) {
    return (
      <div className="relative w-full h-full bg-gray-900 flex items-center justify-center">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!srcdoc) {
    return (
      <div className="relative w-full h-full bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Loading preview...</p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full bg-gray-900 overflow-auto"
      style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
    >
      <iframe
        srcDoc={srcdoc}
        sandbox="allow-scripts allow-same-origin allow-forms"
        className="relative w-full h-full"
        style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
      />
    </div>
  );
}
