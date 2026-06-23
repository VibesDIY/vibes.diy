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
// top-left corner), so each curated item carries the live screenshot alongside
// the fields a normal AppItem has.
export type CuratedAppItem = AppItem & { screenshot?: MetaScreenShot };

export interface CuratedGroup {
  category: string;
  items: CuratedAppItem[];
}

export interface UseCuratedVibes {
  groups: CuratedGroup[];
  loading: boolean;
}

const config = curatedData as CuratedConfig;

// Grants that mean the signed-out (or any) visitor can actually open the app —
// only these get a card so the showcase never links to something gated.
function isViewable(grant: string): boolean {
  return grant === "public-access" || grant === "owner" || grant.startsWith("granted-access");
}

/**
 * Fetches the curated homepage vibes (from curated-vibes.json) live via
 * getAppByFsId so titles, icons, and screenshots stay in sync with each app.
 * Apps that are missing or not publicly viewable are dropped, and empty groups
 * are removed.
 */
export function useCuratedVibes(): UseCuratedVibes {
  const { sharedApi } = useVibesDiy();
  const [groups, setGroups] = useState<CuratedGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      const resolvedGroups = await Promise.all(
        config.groups.map(async (group) => {
          const items = await Promise.all(
            group.vibes.map(async (ref): Promise<CuratedAppItem | null> => {
              // A single bad app must never take down the whole showcase, so any
              // unexpected throw (network, missing app) just drops that card.
              try {
                // summary: this path only reads grant/title/icon/screenshot (all
                // in meta), so skip the heavy fileSystem/env payloads.
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
                };
              } catch {
                return null;
              }
            })
          );
          return { category: group.category, items: items.filter((i): i is CuratedAppItem => i !== null) };
        })
      );

      if (cancelled) return;
      setGroups(resolvedGroups.filter((g) => g.items.length > 0));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sharedApi]);

  return { groups, loading };
}
