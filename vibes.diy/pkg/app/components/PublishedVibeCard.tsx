import React, { ReactElement } from "react";
import { Link } from "react-router-dom";
import { BrutalistCard } from "@vibes.diy/use-vibes-base";
import { constructVibeScreenshotUrl } from "../utils/vibeUrls.js";

interface PublishedVibeCardProps {
  slug: string;
  name?: string;
}

export default function PublishedVibeCard({
  slug,
  name,
}: PublishedVibeCardProps): ReactElement {
  // Construct screenshot URL with query parameter
  const screenshotUrl = constructVibeScreenshotUrl(slug);
  const linkUrl = `/vibe/${slug}`;

  // Use provided name or extract from URL
  const vibeName = name || slug || "Published Vibe";

  return (
    <BrutalistCard
      size="md"
      className="overflow-hidden transition-colors hover:border-blue-500"
    >
      <Link to={linkUrl} className="block h-full w-full">
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

        <div className="relative w-full overflow-hidden">
          {/* Blurred background version */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <img
              src={screenshotUrl}
              className="h-full w-full scale-110 object-cover"
              alt=""
              style={{ filter: "blur(10px)", opacity: 0.9 }}
              loading="lazy"
            />
          </div>

          {/* Foreground image with fixed height */}
          <div className="relative z-10 flex h-48 w-full justify-center py-2">
            <img
              src={screenshotUrl}
              alt={`Screenshot from ${vibeName}`}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          </div>
        </div>
      </Link>
    </BrutalistCard>
  );
}
