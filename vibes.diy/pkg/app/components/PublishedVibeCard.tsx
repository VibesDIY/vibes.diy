import React, { ReactElement, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BrutalistCard } from "@vibes.diy/use-vibes-base";
import { DocFileMeta } from "use-fireproof";
import { ImgFile } from "./SessionSidebar/ImgFile.js";
import {
  constructVibeIconUrl,
  constructVibeScreenshotUrl,
} from "../utils/vibeUrls.js";

interface PublishedVibeCardProps {
  slug: string;
  name?: string;
  localScreenshot?: DocFileMeta;
  disableLink?: boolean;
}

export default function PublishedVibeCard({
  slug,
  name,
  localScreenshot,
  disableLink = false,
}: PublishedVibeCardProps): ReactElement {
  // Construct asset URLs with query parameters
  const screenshotUrl = useMemo(() => constructVibeScreenshotUrl(slug), [slug]);
  const iconUrl = useMemo(() => constructVibeIconUrl(slug), [slug]);
  const [imageSrc, setImageSrc] = useState(iconUrl);
  const [usingIcon, setUsingIcon] = useState(true);

  // Reset to icon when slug changes
  useEffect(() => {
    if (!localScreenshot) {
      setImageSrc(iconUrl);
      setUsingIcon(true);
    }
  }, [iconUrl, localScreenshot]);

  const handleImageError: React.ReactEventHandler<HTMLImageElement> = (
    event,
  ) => {
    const failedSrc = event.currentTarget.src;

    // If the screenshot also fails, don't loop between sources
    if (failedSrc === screenshotUrl) {
      return;
    }

    setImageSrc(screenshotUrl);
    setUsingIcon(false);
  };

  const handleImageLoad: React.ReactEventHandler<HTMLImageElement> = (
    event,
  ) => {
    const loadedSrc = event.currentTarget.src;
    setUsingIcon(loadedSrc === iconUrl);
  };
  const linkUrl = `/vibe/${slug}`;

  // Use provided name or extract from URL
  const vibeName = name || slug || "Published Vibe";

  const cardContent = (
    <>
      <div className="p-2 py-1">
        <div className="flex h-8 items-center justify-between">
          <h3
            className="text-responsive truncate font-medium"
            style={{
              fontSize:
                vibeName.length > 20
                  ? Math.max(0.8, 1 - (vibeName.length - 20) * 0.02) + "rem"
                  : "1rem",
            }}
          >
            {vibeName}
          </h3>
        </div>
      </div>

      {localScreenshot ? (
        <div className="relative w-full overflow-hidden bg-white">
          <div className="flex h-48 w-full justify-center">
            <ImgFile
              file={localScreenshot}
              alt={`Screenshot from ${vibeName}`}
              withBlurredBg={true}
              maxHeight="12rem"
            />
          </div>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden bg-white">
          {/* Blurred background version when using screenshot */}
          {!usingIcon && (
            <div className="absolute inset-0 z-0 overflow-hidden">
              <img
                src={screenshotUrl}
                className="h-full w-full scale-110 object-cover"
                alt=""
                style={{ filter: "blur(10px)", opacity: 0.9 }}
                loading="lazy"
              />
            </div>
          )}

          {/* Foreground image with fixed height */}
          <div className="relative z-10 flex h-48 w-full justify-center py-2">
            <img
              src={imageSrc}
              alt={
                usingIcon
                  ? `Icon for ${vibeName}`
                  : `Screenshot from ${vibeName}`
              }
              className="max-h-full max-w-full object-contain"
              loading="lazy"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </div>
        </div>
      )}
    </>
  );

  return (
    <BrutalistCard
      size="md"
      className="overflow-hidden transition-colors hover:border-blue-500"
    >
      {disableLink ? (
        <div className="block h-full w-full">{cardContent}</div>
      ) : (
        <Link to={linkUrl} className="block h-full w-full">
          {cardContent}
        </Link>
      )}
    </BrutalistCard>
  );
}
