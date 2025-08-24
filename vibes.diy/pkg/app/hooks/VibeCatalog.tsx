import React from "react";
import { useCatalog } from "./useCatalog.js";
import type { LocalVibe } from "../utils/vibeUtils.js";

/**
 * Implementation component that contains all the hooks and logic.
 * This is only rendered when userId and vibes are available.
 */
function VibeCatalogImpl({
  userId,
  vibes,
}: {
  userId?: string;
  vibes: Array<LocalVibe>;
}) {
  const { count } = useCatalog(userId, vibes);

  return (
    <span style={{ display: "inline-block", marginBottom: 8, fontWeight: 500 }}>
      Cataloging {count} vibes locally
    </span>
  );
}

/**
 * Public wrapper component that handles conditional rendering.
 * Users can include this without checking for userId themselves.
 */
export function VibeCatalog({
  userId,
  vibes,
}: {
  userId?: string;
  vibes?: Array<LocalVibe>;
}) {
  if (!vibes) return null;
  return <VibeCatalogImpl userId={userId} vibes={vibes} />;
}
