import { useEffect, useState } from "react";
import { isMetaTitle } from "@vibes.diy/api-types";
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

export interface CuratedGroup {
  category: string;
  items: AppItem[];
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
            group.vibes.map(async (ref): Promise<AppItem | null> => {
              // A single bad app must never take down the whole showcase, so any
              // unexpected throw (network, missing app) just drops that card.
              try {
                const res = await sharedApi.getAppByFsId({ ownerHandle: ref.ownerHandle, appSlug: ref.appSlug });
                if (res.isErr()) return null;
                const app = res.Ok();
                if (app.error || !isViewable(app.grant)) return null;
                const title = app.meta.find(isMetaTitle)?.title ?? app.appSlug;
                return {
                  ownerHandle: app.ownerHandle,
                  appSlug: app.appSlug,
                  title,
                  ...(app.icon ? { icon: app.icon } : {}),
                };
              } catch {
                return null;
              }
            })
          );
          return { category: group.category, items: items.filter((i): i is AppItem => i !== null) };
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
