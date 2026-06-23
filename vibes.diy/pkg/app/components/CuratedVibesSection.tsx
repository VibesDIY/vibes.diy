import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppDetailPanel, screenshotSrc, type AppItem } from "./MyAppsSection.js";
import { useCuratedVibes, type CuratedAppItem } from "../hooks/useCuratedVibes.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";
import {
  getGalleryContainerStyle,
  getGalleryLabelStyle,
  getGalleryContentStyle,
  getGalleryDescriptionStyle,
} from "./NewSessionContent/NewSessionContent.styles.js";

interface CuratedVibesSectionProps {
  isMobile: boolean;
}

/**
 * Logged-out counterpart to MyAppsSection: instead of the visitor's own apps it
 * shows a curated, category-grouped showcase sourced from curated-vibes.json.
 * Each card leads with the app screenshot and overlaps its icon on the
 * top-left corner; opening the info panel reuses My Apps' detail panel.
 */
export function CuratedVibesSection({ isMobile }: CuratedVibesSectionProps) {
  const { groups, loading } = useCuratedVibes();
  const [detailItem, setDetailItem] = useState<AppItem | null>(null);
  const appHostBaseUrl = getAppHostBaseUrl();

  // Signed-out visitors must land on the authless public viewer (/vibe), not
  // the /chat editor which lives behind the auth layout.
  const publicHref = (item: AppItem) => `/vibe/${item.ownerHandle}/${item.appSlug}`;

  // ESC closes the detail panel (mirrors MyAppsSection).
  useEffect(() => {
    if (!detailItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailItem]);

  return (
    <section className="mt-6" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={getGalleryContainerStyle(isMobile)}>
        <div style={getGalleryLabelStyle(isMobile)}>Featured</div>
        <div style={getGalleryContentStyle()}>
          {loading && groups.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
            </div>
          ) : groups.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: "var(--vibes-near-black)", opacity: 0.6 }}>
              No featured vibes right now.
            </div>
          ) : (
            <div style={{ padding: isMobile ? 12 : 24, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 32 }}>
              {groups.map((group) => (
                <div key={group.category}>
                  <h3
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--vibes-near-black)", opacity: 0.7, marginBottom: isMobile ? 14 : 18 }}
                  >
                    {group.category}
                  </h3>
                  <div
                    className={isMobile ? "grid grid-cols-1" : "grid grid-cols-2"}
                    style={{ rowGap: isMobile ? 24 : 28, columnGap: isMobile ? 16 : 20, alignItems: "start" }}
                  >
                    {group.items.map((item) => (
                      <CuratedVibeCard
                        key={`${item.ownerHandle}/${item.appSlug}`}
                        item={item}
                        appHostBaseUrl={appHostBaseUrl}
                        isMobile={isMobile}
                        onOpenInfo={() => setDetailItem(item)}
                        hrefFor={publicHref}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={getGalleryDescriptionStyle()}>A few of our favorite vibes to remix.</p>
        </div>
      </div>

      <AppDetailPanel item={detailItem} appHostBaseUrl={appHostBaseUrl} onClose={() => setDetailItem(null)} hrefFor={publicHref} />
    </section>
  );
}

interface CuratedVibeCardProps {
  item: CuratedAppItem;
  appHostBaseUrl: string;
  isMobile: boolean;
  onOpenInfo: () => void;
  hrefFor: (item: AppItem) => string;
}

/**
 * Screenshot-forward showcase card: the screenshot fills the card and the app
 * icon sits on the top-left corner, three-quarters overlapping the screenshot
 * with the remaining quarter poking past the corner.
 */
function CuratedVibeCard({ item, appHostBaseUrl, isMobile, onOpenInfo, hrefFor }: CuratedVibeCardProps) {
  const label = item.title ?? item.appSlug;
  const iconUrl = item.icon ? cidAssetUrl(item.icon.cid, item.icon.mime, appHostBaseUrl) : undefined;
  const shotUrl = item.screenshot ? screenshotSrc(item.screenshot) : undefined;
  const [isHovered, setIsHovered] = useState(false);
  const [shotFailed, setShotFailed] = useState(false);

  const iconSize = isMobile ? 48 : 56;
  // 1/4 of the icon hangs past the corner, so 3/4 overlaps the screenshot.
  const iconOverhang = iconSize / 4;
  const iconRadius = isMobile ? 12 : 14;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div
        className="group"
        style={{ position: "relative", width: "100%" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Link
          to={hrefFor(item)}
          aria-label={`Open ${label}`}
          style={{
            display: "block",
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 10",
            borderRadius: 14,
            overflow: "hidden",
            border: "2px solid var(--vibes-near-black)",
            backgroundColor: "rgb(255, 254, 240)",
            boxShadow: isHovered ? "2px 2px 0 0 var(--vibes-near-black)" : "5px 5px 0 0 var(--vibes-near-black)",
            transform: isHovered ? "translate(3px, 3px)" : "translate(0, 0)",
            transition: "transform 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          {shotUrl && !shotFailed ? (
            <img
              src={shotUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={() => setShotFailed(true)}
            />
          ) : iconUrl ? (
            // No screenshot yet: center the icon large so the card never renders
            // empty (the corner-overlap icon below still anchors the top-left).
            <div className="flex h-full w-full items-center justify-center" style={{ padding: "16%" }}>
              <img src={iconUrl} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", opacity: 0.9 }} />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "var(--vibes-near-black)", opacity: 0.5 }}
              >
                {item.appSlug.slice(0, 12)}
              </span>
            </div>
          )}
        </Link>

        {/* App icon, overlapping the top-left corner. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -iconOverhang,
            left: -iconOverhang,
            width: iconSize,
            height: iconSize,
            borderRadius: iconRadius,
            backgroundColor: "rgb(255, 254, 240)",
            border: "2px solid var(--vibes-near-black)",
            boxShadow: "2px 2px 0 0 var(--vibes-near-black)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            padding: 6,
            zIndex: 2,
            pointerEvents: "none",
          }}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="text-[9px] font-bold uppercase" style={{ color: "var(--vibes-near-black)", opacity: 0.6 }}>
              {item.appSlug.slice(0, 3)}
            </span>
          )}
        </div>

        {/* Info button — top-right of the card, fades in on hover; on touch
            (no hover) stays faintly visible. */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpenInfo();
          }}
          aria-label={`Info about ${label}`}
          style={{ top: -8, right: -8 }}
          className="absolute z-[3] flex items-center justify-center w-6 h-6 rounded-full bg-[var(--vibes-near-black)] text-[var(--vibes-cream)] border-2 border-[var(--vibes-cream)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 [@media(hover:none)]:opacity-60"
        >
          <span className="text-[11px] font-bold italic leading-none" style={{ fontFamily: "Georgia, serif" }}>
            i
          </span>
        </button>
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 500,
          color: "var(--vibes-near-black)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
}
