import React, { ReactElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  constructVibeIconUrl,
  constructVibeScreenshotUrl,
} from "../../utils/vibeUrls.js";

interface VibeGalleryCardProps {
  slug: string;
  name?: string;
}

export default function VibeGalleryCard({
  slug,
  name,
}: VibeGalleryCardProps): ReactElement {
  // Construct asset URLs
  const screenshotUrl = useMemo(() => constructVibeScreenshotUrl(slug), [slug]);
  const iconUrl = useMemo(() => constructVibeIconUrl(slug), [slug]);
  const [imageSrc, setImageSrc] = useState(iconUrl);

  // Reset to icon when slug changes
  useEffect(() => {
    setImageSrc(iconUrl);
  }, [iconUrl]);

  const handleImageError: React.ReactEventHandler<HTMLImageElement> = (
    event,
  ) => {
    const failedSrc = event.currentTarget.src;

    // If the screenshot also fails, don't loop between sources
    if (failedSrc === screenshotUrl) {
      return;
    }

    setImageSrc(screenshotUrl);
  };

  const linkUrl = `/vibe/${slug}`;
  const vibeName = name || slug || "Vibe";

  return (
    <Link to={linkUrl} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Icon container with 3D shadow */}
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "24px",
            backgroundColor: "#FFFEFF",
            border: "2px solid var(--vibes-near-black)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            boxShadow: "8px 8px 0 rgba(0, 0, 0, 0.8)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translate(-2px, -2px)";
            e.currentTarget.style.boxShadow = "10px 10px 0 rgba(0, 0, 0, 0.8)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translate(0, 0)";
            e.currentTarget.style.boxShadow = "8px 8px 0 rgba(0, 0, 0, 0.8)";
          }}
        >
          <img
            src={imageSrc}
            alt={`Icon for ${vibeName}`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            loading="lazy"
            onError={handleImageError}
          />
        </div>

        {/* Vibe name */}
        <div
          style={{
            fontSize: "16px",
            fontWeight: 500,
            color: "var(--vibes-near-black)",
            textAlign: "center",
            maxWidth: "140px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {vibeName}
        </div>
      </div>
    </Link>
  );
}
