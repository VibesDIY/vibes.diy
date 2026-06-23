import { useEffect, useState } from "react";
import { isMetaTitle, isMetaScreenShot, type MetaScreenShot } from "@vibes.diy/api-types";
import type { AppItem } from "../components/MyAppsSection.js";
import { useVibesDiy } from "../vibes-diy-provider.js";
import curatedData from "../data/curated-vibes.json" with { type: "json" };

interface CuratedVibeRef {
  ownerHandle: string;
  appSlug: string;
}

interface CuratedGroupConfig {
  category: string;
  vibes: CuratedVibeRef[];
}

interface CuratedConfig {
  groups: CuratedGroupConfig[];
}

// The showcase cards render the app screenshot (with the icon overlapping the
// top-left corner) captioned by the enriched-prompt description, so each curated
// item carries the live screenshot + description alongside a normal AppItem.
export type CuratedAppItem = AppItem & { screenshot?: MetaScreenShot; description?: string };

export interface UseCuratedVibes {
  items: CuratedAppItem[];
  loading: boolean;
}

const config = curatedData as CuratedConfig;

// The showcase is a single flat, ordered feed (category grouping in the JSON is
// just for editing convenience); flatten it once, preserving file order.
const flatRefs: CuratedVibeRef[] = config.groups.flatMap((g) => g.vibes);

// Grants that mean the signed-out (or any) visitor can actually open the app —
// only these get a card so the showcase never links to something gated.
function isViewable(grant: string): boolean {
  return grant === "public-access" || grant === "owner" || grant.startsWith("granted-access");
}

/**
 * Fetches the curated homepage vibes (from curated-vibes.json) live via
 * getAppByFsId so titles, icons, screenshots, and descriptions stay in sync with
 * each app. Returns one flat, file-ordered list; apps that are missing or not
 * publicly viewable are dropped. The gallery windows this list for infinite
 * scroll, so the order here is the order visitors page through.
 */
export function useCuratedVibes(): UseCuratedVibes {
  const { sharedApi } = useVibesDiy();
  const [items, setItems] = useState<CuratedAppItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const resolved = await Promise.all(
        flatRefs.map(async (ref): Promise<CuratedAppItem | null> => {
          // A single bad app must never take down the whole showcase, so any
          // unexpected throw (network, missing app) just drops that card.
          try {
            // summary: this path only reads grant/title/icon/screenshot (all
            // in meta) + enrichedPrompt, so skip the heavy fileSystem/env payloads.
            const res = await sharedApi.getAppByFsId({ ownerHandle: ref.ownerHandle, appSlug: ref.appSlug, summary: true });
            if (res.isErr()) return null;
            const app = res.Ok();
            if (app.error || !isViewable(app.grant)) return null;
            const title = app.meta.find(isMetaTitle)?.title ?? app.appSlug;
            const screenshot = app.meta.find(isMetaScreenShot);
            return {
              ownerHandle: app.ownerHandle,
              appSlug: app.appSlug,
              title,
              ...(app.icon ? { icon: app.icon } : {}),
              ...(screenshot ? { screenshot } : {}),
              ...(app.enrichedPrompt ? { description: app.enrichedPrompt } : {}),
            };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;
      setItems(resolved.filter((i): i is CuratedAppItem => i !== null));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sharedApi]);

  return { items, loading };
}
