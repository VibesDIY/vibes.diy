import React, { useEffect, useState } from "react";
import { AppIconCard, AppDetailPanel, type AppItem } from "./MyAppsSection.js";
import { useCuratedVibes } from "../hooks/useCuratedVibes.js";
import { getAppHostBaseUrl } from "../utils/vibeUrls.js";
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
 * shows a curated, category-grouped showcase (icons + screenshots) sourced from
 * curated-vibes.json. Reuses the same icon cards and detail panel as My Apps.
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
            <div style={{ padding: isMobile ? 12 : 24, display: "flex", flexDirection: "column", gap: isMobile ? 20 : 28 }}>
              {groups.map((group) => (
                <div key={group.category}>
                  <h3
                    className="text-[11px] font-bold uppercase tracking-widest"
                    style={{ color: "var(--vibes-near-black)", opacity: 0.7, marginBottom: isMobile ? 10 : 14 }}
                  >
                    {group.category}
                  </h3>
                  <div
                    className="grid grid-cols-4 justify-items-center"
                    style={{ rowGap: isMobile ? 16 : 20, columnGap: isMobile ? 12 : 10, alignItems: "start" }}
                  >
                    {group.items.map((item, index) => (
                      <AppIconCard
                        key={`${item.ownerHandle}/${item.appSlug}`}
                        item={item}
                        appHostBaseUrl={appHostBaseUrl}
                        isMobile={isMobile}
                        index={index}
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
