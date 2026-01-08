import React, { ReactElement, useEffect, useMemo, useState } from "react";
import { BrutalistCard } from "./vibes/BrutalistCard.js";
import { DocFileMeta } from "@fireproof/use-fireproof";
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
  children?: React.ReactNode;
}

export default function PublishedVibeCard({
  slug,
  name,
  localScreenshot,
  disableLink = false,
  children,
}: PublishedVibeCardProps): ReactElement {
  // Construct asset URLs with query parameters
  const screenshotUrl = useMemo(() => constructVibeScreenshotUrl(slug), [slug]);
  const iconUrl = useMemo(() => constructVibeIconUrl(slug), [slug]);
  const [imageSrc, setImageSrc] = useState(iconUrl);
  const [usingIcon, setUsingIcon] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // Reset state when slug changes
  useEffect(() => {
    if (!localScreenshot) {
      setImageSrc(iconUrl);
      setUsingIcon(true);
      setImageLoaded(false);
      setImageFailed(false);
    }
  }, [iconUrl, localScreenshot]);

  const handleImageError: React.ReactEventHandler<HTMLImageElement> = (
    event,
  ) => {
    const failedSrc = event.currentTarget.src;

    // If the screenshot also fails, mark as failed and stop
    if (failedSrc === screenshotUrl) {
      setImageFailed(true);
      return;
    }

    // Try screenshot as fallback
    setImageSrc(screenshotUrl);
    setUsingIcon(false);
    setImageLoaded(false);
  };

  const handleImageLoad: React.ReactEventHandler<HTMLImageElement> = (
    event,
  ) => {
    const loadedSrc = event.currentTarget.src;
    setUsingIcon(loadedSrc === iconUrl);
    setImageLoaded(true);
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
          {/* Empty placeholder if image failed to load */}
          {imageFailed && (
            <div
              className="flex h-48 w-full items-center justify-center"
              style={{
                backgroundColor: "rgb(128, 128, 128)",
                opacity: 0.5,
                filter: "blur(10px)",
              }}
            >
              <span className="text-sm text-gray-400">No preview</span>
            </div>
          )}

          {/* Hidden image for loading */}
          {!imageFailed && (
            <>
              {/* Blurred background version when using screenshot - only show after load */}
              {!usingIcon && imageLoaded && (
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

              {/* Foreground image with fixed height - only show after load */}
              <div className="relative z-10 flex h-48 w-full justify-center py-2">
                <img
                  src={imageSrc}
                  alt={
                    usingIcon
                      ? `Icon for ${vibeName}`
                      : `Screenshot from ${vibeName}`
                  }
                  className="max-h-full max-w-full object-contain"
                  style={{ opacity: imageLoaded ? 1 : 0 }}
                  loading="lazy"
                  onError={handleImageError}
                  onLoad={handleImageLoad}
                />
              </div>
            </>
          )}
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
        <div className="block h-full w-full">
          {cardContent}
          {children}
        </div>
      ) : (
        <a href={linkUrl} className="block h-full w-full">
          {cardContent}
        </a>
      )}
      {!disableLink && children}
    </BrutalistCard>
  );
}
