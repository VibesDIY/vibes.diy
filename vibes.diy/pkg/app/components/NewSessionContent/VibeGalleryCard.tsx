import React, { ReactElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  constructVibeIconUrl,
  constructVibeScreenshotUrl,
} from "../../utils/vibeUrls.js";
import { TexturedPattern } from "@vibes.diy/use-vibes-base";
import {
  getVibeCardLinkStyle,
  getVibeCardWrapperStyle,
  getVibeCardIconContainerStyle,
  getVibeCardTexturedShadowStyle,
  getVibeCardMainIconContainerStyle,
  getVibeCardIconImageStyle,
  getVibeCardNameStyle,
} from "./NewSessionContent.styles.js";

interface VibeGalleryCardProps {
  slug: string;
  name?: string;
  IconComponent?: React.ComponentType<{
    width?: number;
    height?: number;
    fill?: string;
  }>;
}

export default function VibeGalleryCard({
  slug,
  name,
  IconComponent,
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

  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link to={linkUrl} style={getVibeCardLinkStyle()}>
      <div style={getVibeCardWrapperStyle()}>
        {/* Icon container with textured shadow */}
        <div
          style={getVibeCardIconContainerStyle()}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Textured shadow background */}
          <div style={getVibeCardTexturedShadowStyle(isHovered)}>
            <TexturedPattern width={100} height={100} borderRadius={24} />
          </div>

          {/* Main icon container */}
          <div style={getVibeCardMainIconContainerStyle(isHovered)}>
            {IconComponent ? (
              <IconComponent
                width={68}
                height={68}
                fill="var(--vibes-near-black)"
              />
            ) : (
              <img
                src={imageSrc}
                alt={`Icon for ${vibeName}`}
                style={getVibeCardIconImageStyle()}
                loading="lazy"
                onError={handleImageError}
              />
            )}
          </div>
        </div>
        {/* Vibe name */}
        <div style={getVibeCardNameStyle()}>{vibeName}</div>
      </div>
    </Link>
  );
}
