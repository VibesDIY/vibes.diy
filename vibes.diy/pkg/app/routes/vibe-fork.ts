import type { ResForkApp } from "@vibes.diy/api-types";

/** Build the `/vibe` URL for a freshly-forked copy. The fork lands fsId-pinned at
 *  the source content anchor (`srcFsId`); `yours=1` triggers the one-time "it's
 *  yours now" message (#1856) on landing, and `prompt64` (when present) carries
 *  the non-owner's typed change so the forked page can auto-fire it. */
export function forkDestination(res: Pick<ResForkApp, "ownerHandle" | "appSlug" | "srcFsId">, prompt64: string | null): string {
  const params = new URLSearchParams({ yours: "1" });
  if (prompt64) params.set("prompt64", prompt64);
  return `/vibe/${res.ownerHandle}/${res.appSlug}/${res.srcFsId}?${params.toString()}`;
}
