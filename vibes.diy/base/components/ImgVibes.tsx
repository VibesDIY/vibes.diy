import React, { useState, useCallback, useMemo } from "react";
import type { Database } from "@fireproof/use-fireproof";
import { useImgVibes } from "../hooks/img-vibes/use-img-vibes.js";

export interface ImgVibesProps {
  prompt?: string;
  _id?: string;
  images?: File[];
  database?: string | Database;
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
  showControls?: boolean;
}

function promptToId(prompt: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < prompt.length; i++) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `img-${(hash >>> 0).toString(36)}`;
}

export function ImgVibes({ prompt, _id: propId, images, database, className, alt, style, showControls = true }: ImgVibesProps) {
  const inputImage = images?.[0];
  const imageKey = inputImage ? `${inputImage.name}-${inputImage.size}-${inputImage.lastModified}` : "";
  const stableId = useMemo(() => propId ?? (prompt ? promptToId(prompt + imageKey) : undefined), [propId, prompt, imageKey]);
  const [generationId, setGenerationId] = useState<string | undefined>(undefined);
  const [versionIndex, setVersionIndex] = useState<number | null>(null);

  const { assetUrl, loading, progress, error, document } = useImgVibes({
    prompt,
    _id: stableId,
    database,
    skip: !prompt && !stableId,
    generationId,
    inputImage,
  });

  const versions = document?.versions ?? [];
  const currentVersion = versionIndex ?? document?.currentVersion ?? 0;
  const fallbackAssetUrl = versions[document?.currentVersion ?? 0]?.assetUrl;
  const displayUrl = versionIndex !== null ? versions[versionIndex]?.assetUrl : (assetUrl ?? fallbackAssetUrl);
  const hasMultipleVersions = versions.length > 1;
  const hasExistingImage = versions.length > 0 && !!displayUrl;

  const handleRegen = useCallback(() => {
    setGenerationId(crypto.randomUUID());
    setVersionIndex(null);
  }, []);

  const handlePrev = useCallback(() => {
    setVersionIndex((prev) => {
      const cur = prev ?? document?.currentVersion ?? 0;
      return cur > 0 ? cur - 1 : cur;
    });
  }, [document?.currentVersion]);

  const handleNext = useCallback(() => {
    setVersionIndex((prev) => {
      const cur = prev ?? document?.currentVersion ?? 0;
      return cur < versions.length - 1 ? cur + 1 : cur;
    });
  }, [document?.currentVersion, versions.length]);

  if (!prompt && !stableId) {
    return (
      <div className={className} style={{ padding: 20, textAlign: "center", color: "#888" }}>
        No prompt provided
      </div>
    );
  }

  if (error && !hasExistingImage) {
    return (
      <div className={className} style={{ padding: 20, textAlign: "center", color: "#e53e3e" }}>
        <strong>Error</strong>
        <div>{error.message}</div>
      </div>
    );
  }

  if (!hasExistingImage) {
    return (
      <div className={className} style={{ padding: 20, textAlign: "center", color: "#888" }}>
        <div>Generating image...</div>
        <div style={{ fontSize: 14, marginTop: 8 }}>{prompt}</div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <img src={displayUrl} alt={alt || prompt || ""} className={className} style={style ?? { maxWidth: "100%", height: "auto" }} />
      {loading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 6,
            overflow: "hidden",
            backgroundColor: "rgba(0, 0, 0, 0.1)",
            zIndex: 10,
          }}
          aria-hidden="true"
        >
          <div
            style={{
              width: `${progress ?? 0}%`,
              height: "100%",
              backgroundColor: "#0074d9",
              transition: "width 0.5s ease-out",
            }}
          />
        </div>
      )}
      {error && (
        <div
          title={error.message}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            backgroundColor: "rgba(229, 62, 62, 0.9)",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 4,
            fontSize: 12,
            zIndex: 11,
            maxWidth: "80%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Error: {error.message}
        </div>
      )}
      {showControls && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            display: "flex",
            gap: 4,
            opacity: 0.8,
          }}
        >
          {hasMultipleVersions && (
            <>
              <button onClick={handlePrev} disabled={currentVersion <= 0} style={btnStyle} title="Previous version">
                ‹
              </button>
              <span style={{ ...btnStyle, cursor: "default", minWidth: 40, textAlign: "center" }}>
                {currentVersion + 1}/{versions.length}
              </span>
              <button onClick={handleNext} disabled={currentVersion >= versions.length - 1} style={btnStyle} title="Next version">
                ›
              </button>
            </>
          )}
          <button onClick={handleRegen} disabled={loading} style={btnStyle} title="Regenerate">
            ↻
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.6)",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  padding: "4px 8px",
  fontSize: 14,
  cursor: "pointer",
  lineHeight: 1,
};

export default ImgVibes;
