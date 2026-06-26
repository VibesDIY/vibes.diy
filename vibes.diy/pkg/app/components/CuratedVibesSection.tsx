import React from "react";
import { useCuratedVibes } from "../hooks/useCuratedVibes.js";
import { CuratedVibesGallery } from "./CuratedVibesGallery.js";

interface CuratedVibesSectionProps {
  isMobile: boolean;
}

/**
 * Logged-out counterpart to MyAppsSection: instead of the visitor's own apps it
 * shows a curated, single-column showcase sourced from curated-vibes.json. Thin
 * wrapper that fetches the curated data and hands it to the presentational
 * gallery (CuratedVibesGallery, which is what tests render directly).
 */
export function CuratedVibesSection({ isMobile }: CuratedVibesSectionProps) {
  const { items, loading } = useCuratedVibes();
  return <CuratedVibesGallery items={items} loading={loading} isMobile={isMobile} />;
}
