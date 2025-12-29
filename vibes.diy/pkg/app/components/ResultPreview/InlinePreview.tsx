import { hashStringAsync } from "@fireproof/core-runtime";
import React, { useState, useEffect } from "react";

interface InlinePreviewProps {
  code: string;
  sessionId: string;
  codeReady: boolean;
}

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
        const url = `/vibe/ses-${_sessionId}/${await hashStringAsync(code)}`;
        const response = await fetch(url, {
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

        setSrcdoc(url);
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
        src={srcdoc}
        className="relative w-full h-full"
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{ isolation: "isolate", transform: "translate3d(0,0,0)" }}
      />
    </div>
  );
}
