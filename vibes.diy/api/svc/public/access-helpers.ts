import { and, eq, inArray, sql } from "drizzle-orm";
import { Role, isResHasAccessInviteAccepted, isResHasAccessRequestApproved } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { hasAccessInvite } from "./invite-flow.js";
import { hasAccessRequest } from "./request-flow.js";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { parseOwnerRoles } from "./grant-reduce.js";

/**
 * Effective declared `ownerRoles` for (ownerHandle, appSlug, dbName), with the
 * db-specific AccessFunctionBindings row winning over the `*` wildcard — the
 * same precedence access-fn binding resolution uses, so the owner seed can't
 * diverge between the write, read, and who-am-i paths. Returns [] when no
 * binding/column is set (the reserved `owner` role is seeded regardless).
 *
 * Used by the read reduces, which load access-fn outputs but not the afb row;
 * the write and who-am-i paths already load afb and read `ownerRoles` from it
 * directly (no extra query).
 */
export async function loadEffectiveOwnerRoles(
  vctx: VibesApiSQLCtx,
  ownerHandle: string,
  appSlug: string,
  dbName: string
): Promise<string[]> {
  const tAfb = vctx.sql.tables.accessFunctionBindings;
  const row = await vctx.sql.db
    .select({ ownerRoles: tAfb.ownerRoles })
    .from(tAfb)
    .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug), inArray(tAfb.dbName, [dbName, "*"])))
    .orderBy(sql`CASE WHEN ${tAfb.dbName} = ${dbName} THEN 0 ELSE 1 END`)
    .limit(1)
    .then((r) => r[0]);
  return parseOwnerRoles(row?.ownerRoles);
}

export type DocAccessLevel = Role | "override" | "none";

// canRead / canWrite are defined once in the shared @vibes.diy/vibe-types
// db-acl-eval module; re-exported here so existing importers (db-acl-resolver
// and friends) keep their import paths unchanged.
export { canRead, canWrite } from "@vibes.diy/vibe-types";

export async function checkDocAccess(
  vctx: VibesApiSQLCtx,
  userId: string,
  appSlug: string,
  ownerHandle: string,
  adminMode?: boolean
): Promise<{ access: DocAccessLevel; isOwner: boolean }> {
  const binding = await vctx.sql.db
    .select({ userId: vctx.sql.tables.handleBinding.userId })
    .from(vctx.sql.tables.handleBinding)
    .where(eq(vctx.sql.tables.handleBinding.handle, ownerHandle))
    .limit(1)
    .then((r) => r[0]);

  if (binding?.userId === userId) return { access: adminMode ? "override" : "editor", isOwner: true };

  const rInvite = await hasAccessInvite(vctx, { grantUserId: userId, appSlug, ownerHandle });
  if (rInvite.isOk()) {
    const invite = rInvite.Ok();
    if (isResHasAccessInviteAccepted(invite)) {
      return { access: invite.role, isOwner: false };
    }
  }

  const rReq = await hasAccessRequest(vctx, { foreignUserId: userId, appSlug, ownerHandle });
  if (rReq.isOk()) {
    const req = rReq.Ok();
    if (isResHasAccessRequestApproved(req)) {
      return { access: req.role, isOwner: false };
    }
  }

  return { access: "none", isOwner: false };
}

// Public readability is gated solely on the owner's explicit `publicAccess.enable`
// opt-in (set via `vibes-diy push --publicAccess` or the sharing panel toggle).
// We deliberately do NOT also require a `production`-mode app row: that extra gate
// meant access.js public-read grants only took effect after publishing, so creators
// couldn't exercise cross-user channels/`grant.public` on a dev app without a publish
// cycle (see VibesDIY/vibes.diy#2308). The flag is always an explicit owner action,
// so honoring it in dev is the correct semantics and unblocks local access-fn testing.
export async function isPublicReadable(vctx: VibesApiSQLCtx, appSlug: string, ownerHandle: string): Promise<boolean> {
  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    ownerHandle,
    env: [],
  });
  if (rSettings.isErr()) return false;
  return rSettings.Ok().settings.entry.publicAccess?.enable === true;
}

// "World-readable" = any visitor can gain read access without owner action.
// That's broader than `isPublicReadable` (anonymous publicAccess): it also
// covers auto-accept request apps (`enableRequest.enable` + `autoAcceptRole`),
// where any signed-in user self-approves into membership. Both are "anyone can
// use" vibes for the purposes of the member-list visibility gate (#2550). Kept
// in sync with `deriveIsWorldReadable` in get-vibe-route-hints.ts.
export async function isWorldReadable(vctx: VibesApiSQLCtx, appSlug: string, ownerHandle: string): Promise<boolean> {
  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    ownerHandle,
    env: [],
  });
  if (rSettings.isErr()) return false;
  const entry = rSettings.Ok().settings.entry;
  if (entry.publicAccess?.enable === true) return true;
  return entry.enableRequest?.enable === true && entry.enableRequest.autoAcceptRole !== undefined;
}
