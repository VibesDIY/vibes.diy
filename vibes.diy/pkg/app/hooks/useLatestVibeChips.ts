import { useEffect, useState } from "react";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";

// The chip-projection logic now lives in the browser-safe leaf package
// `@vibes.diy/api-types` so the server's anonymous read endpoint (`getVibeChips`,
// #2755) and the frontend share ONE implementation. Re-exported here so existing
// importers — `useInVibeGeneration` (parses its own freshly-streamed block) and
// the chip tests — keep their paths unchanged.
export { chipsFromNarration, latestTurnChips } from "@vibes.diy/api-types";

/**
 * Load the latest suggestion chips for a vibe's edit card.
 *
 * Sources the chips from the dedicated `getVibeChips` projection endpoint — a
 * server-side read that returns ONLY the latest turn's `▸` chips (never the
 * private chat body) and is gated on app-access visibility, not ownership
 * (#2755). So non-owners and anonymous visitors landing on a public vibe now see
 * its curated transforms instead of an empty text-input-only card. Returns `[]`
 * until loaded, on any error, and whenever the viewer can't see the app.
 */
export function useLatestVibeChips(args: {
  readonly sharedApi: Pick<VibesDiyApiIface, "getVibeChips">;
  readonly ownerHandle?: string;
  readonly appSlug?: string;
  /** The code version being viewed; chips prefer this turn's suggestions. */
  readonly fsId?: string;
}): readonly string[] {
  const { sharedApi, ownerHandle, appSlug, fsId } = args;
  const [chips, setChips] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!ownerHandle || !appSlug) {
      setChips([]);
      return;
    }
    let cancelled = false;
    void sharedApi
      .getVibeChips({ ownerHandle, appSlug, ...(fsId ? { fsId } : {}) })
      .then((r) => {
        if (cancelled) return;
        setChips(r.isErr() ? [] : r.Ok().chips);
      })
      .catch(() => {
        if (!cancelled) setChips([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sharedApi, ownerHandle, appSlug, fsId]);

  return chips;
}
