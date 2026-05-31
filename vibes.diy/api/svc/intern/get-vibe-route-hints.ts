import { exception2Result, Result } from "@adviser/cement";
import { ensureLogger } from "@fireproof/core-runtime";
import { and, desc, eq } from "drizzle-orm/sql/expressions";
import { isMetaTitle, MetaItem, parseArrayWarning, isEnablePublicAccess, isEnableRequest } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

export interface VibeSlugPair {
  readonly ownerHandle: string;
  readonly appSlug: string;
}

export interface VibeRouteHints {
  readonly ogTitle: string | undefined;
  readonly isWorldReadable: boolean;
}

// Pure derivation — no I/O. Scans the raw AppSettings entries array (as stored
// in the DB) to determine whether any visitor can access this app without owner
// action. The last entry of each type wins (append-only log semantics).
export function deriveIsWorldReadable(rawSettings: unknown): boolean {
  if (!Array.isArray(rawSettings)) return false;
  let publicAccess: boolean | undefined;
  let autoAcceptRole: boolean | undefined;
  for (const e of rawSettings) {
    if (isEnablePublicAccess(e)) publicAccess = e.enable;
    if (isEnableRequest(e)) autoAcceptRole = e.enable && e.autoAcceptRole !== undefined;
  }
  return publicAccess === true || autoAcceptRole === true;
}

// Pure pathname parser — no I/O, safe to call before any async work.
// Extracts the (ownerHandle, appSlug) pair from /vibe/:ownerHandle/:appSlug[/...].
export function parseVibePathname(pathname: string): VibeSlugPair | undefined {
  const parts = pathname.split("/");
  const ownerHandle = parts[2];
  const appSlug = parts[3];
  if (parts[1] !== "vibe" || ownerHandle === undefined || ownerHandle === "" || appSlug === undefined || appSlug === "") {
    return undefined;
  }
  return { ownerHandle, appSlug };
}

// Returns true when the vibe URL includes an explicit fsId segment
// (/vibe/:ownerHandle/:appSlug/:fsId). Uses the same split as parseVibePathname
// so both helpers stay in sync.
export function vibePathnameHasFsId(pathname: string): boolean {
  const parts = pathname.split("/");
  return parts[1] === "vibe" && parts[4] !== undefined && parts[4] !== "";
}

// Looks up both the OG title and world-readable flag for a vibe route SSR pass.
// Returns defaults on error so a lookup failure never breaks page rendering.
export async function getVibeRouteHints(ctx: VibesApiSQLCtx, slugs: VibeSlugPair): Promise<Result<VibeRouteHints>> {
  return exception2Result(async (): Promise<Result<VibeRouteHints>> => {
    const row = await ctx.sql.db
      .select({
        meta: ctx.sql.tables.apps.meta,
        settings: ctx.sql.tables.appSettings.settings,
      })
      .from(ctx.sql.tables.apps)
      .leftJoin(
        ctx.sql.tables.appSettings,
        and(
          eq(ctx.sql.tables.appSettings.userId, ctx.sql.tables.apps.userId),
          eq(ctx.sql.tables.appSettings.ownerHandle, ctx.sql.tables.apps.ownerHandle),
          eq(ctx.sql.tables.appSettings.appSlug, ctx.sql.tables.apps.appSlug)
        )
      )
      .where(
        and(
          eq(ctx.sql.tables.apps.ownerHandle, slugs.ownerHandle),
          eq(ctx.sql.tables.apps.appSlug, slugs.appSlug),
          eq(ctx.sql.tables.apps.mode, "production")
        )
      )
      .orderBy(desc(ctx.sql.tables.apps.releaseSeq))
      .limit(1)
      .then((r) => r[0]);

    if (row === undefined) return Result.Ok({ ogTitle: undefined, isWorldReadable: false });

    const { filtered: metaItems, warning } = parseArrayWarning(row.meta, MetaItem);
    if (warning.length > 0) {
      ensureLogger(ctx.sthis, "getVibeRouteHints").Warn().Any({ parseErrors: warning }).Msg("skip");
    }
    const titleItem = metaItems.find(isMetaTitle);

    return Result.Ok({
      ogTitle: titleItem === undefined ? undefined : titleItem.title,
      isWorldReadable: deriveIsWorldReadable(row.settings),
    });
  });
}
