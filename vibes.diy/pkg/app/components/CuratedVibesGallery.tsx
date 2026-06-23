import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { screenshotSrc, type AppItem } from "./MyAppsSection.js";
import type { CuratedAppItem } from "../hooks/useCuratedVibes.js";
import { cidAssetUrl, getAppHostBaseUrl } from "../utils/vibeUrls.js";
import {
  getGalleryContainerStyle,
  getGalleryLabelStyle,
  getGalleryContentStyle,
  getGalleryDescriptionStyle,
} from "./NewSessionContent/NewSessionContent.styles.js";

// Initial window + how many more cards reveal each time the visitor scrolls to
// the bottom of the list.
const PAGE_SIZE = 5;

interface CuratedVibesGalleryProps {
  items: CuratedAppItem[];
  loading: boolean;
  isMobile: boolean;
}

/**
 * Pure presentation: a single-column feed of curated cards. Renders the first
 * PAGE_SIZE and reveals PAGE_SIZE more whenever the bottom sentinel scrolls into
 * view (infinite scroll). Each card leads with the app screenshot, overlaps its
 * icon on the top-left corner, and captions it with the LLM-enriched description.
 *
 * This lives in its own module (not alongside CuratedVibesSection) so tests can
 * import it directly: HomePage specs mock the CuratedVibesSection module
 * wholesale, and under vitest's shared-module setup (isolate:false) that mock
 * would otherwise clobber a named export imported from the same module.
 */
export function CuratedVibesGallery({ items, loading, isMobile }: CuratedVibesGalleryProps) {
  const appHostBaseUrl = getAppHostBaseUrl();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Signed-out visitors must land on the authless public viewer (/vibe), not
  // the /chat editor which lives behind the auth layout.
  const publicHref = (item: AppItem) => `/vibe/${item.ownerHandle}/${item.appSlug}`;

  const visible = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  // Reveal another page when the sentinel near the bottom enters the viewport.
  // rootMargin pre-loads slightly early; while the sentinel stays visible (e.g.
  // the first page doesn't fill the viewport) it keeps firing until it's filled.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((c) => Math.min(c + PAGE_SIZE, items.length));
      },
      { root: null, rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, items.length]);

  return (
    <section className="mt-6" style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <div style={getGalleryContainerStyle(isMobile)}>
        <div style={getGalleryLabelStyle(isMobile)}>Featured</div>
        <div style={getGalleryContentStyle()}>
          {loading && items.length === 0 ? (
            <div className="flex justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-t-2 border-b-2 border-blue-500" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: "var(--vibes-near-black)", opacity: 0.6 }}>
              No featured vibes right now.
            </div>
          ) : (
            <div style={{ padding: isMobile ? 12 : 24, display: "flex", flexDirection: "column", gap: isMobile ? 24 : 28 }}>
              {visible.map((item) => (
                <CuratedVibeCard
                  key={`${item.ownerHandle}/${item.appSlug}`}
                  item={item}
                  appHostBaseUrl={appHostBaseUrl}
                  isMobile={isMobile}
                  hrefFor={publicHref}
                />
              ))}
              {hasMore && <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />}
            </div>
          )}
          <p style={getGalleryDescriptionStyle()}>A few of our favorite vibes to remix.</p>
        </div>
      </div>
    </section>
  );
}

interface CuratedVibeCardProps {
  item: CuratedAppItem;
  appHostBaseUrl: string;
  isMobile: boolean;
  hrefFor: (item: AppItem) => string;
}

/**
 * Screenshot-forward showcase card: the screenshot fills the card with the app
 * icon three-quarters overlapping the top-left corner, and the enriched-prompt
 * description sits underneath as a caption.
 */
function CuratedVibeCard({ item, appHostBaseUrl, isMobile, hrefFor }: CuratedVibeCardProps) {
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
    <Link
      to={hrefFor(item)}
      aria-label={`Open ${label}`}
      className="group"
      style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", textDecoration: "none" }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ position: "relative", width: "100%" }}>
        <div
          style={{
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
        </div>

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

      {/* Caption: the enriched-prompt description, clamped so a long blurb never
          unbalances the card. Hidden entirely when an app has no description. */}
      {item.description ? (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            color: "var(--vibes-near-black)",
            opacity: 0.7,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.description}
        </div>
      ) : null}
    </Link>
  );
}
