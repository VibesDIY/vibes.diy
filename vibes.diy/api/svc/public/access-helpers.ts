import { eq, and } from "drizzle-orm";
import { Role, isResHasAccessInviteAccepted, isResHasAccessRequestApproved } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { hasAccessInvite } from "./invite-flow.js";
import { hasAccessRequest } from "./request-flow.js";
import { ensureAppSettings } from "./ensure-app-settings.js";

export type DocAccessLevel = Role | "owner" | "none";

export const canRead = (level: DocAccessLevel) => level === "owner" || level === "editor" || level === "viewer";
export const canWrite = (level: DocAccessLevel) => level === "owner" || level === "editor" || level === "submitter";

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

  if (binding?.userId === userId) return { access: adminMode ? "owner" : "editor", isOwner: true };

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

export async function isPublicReadable(vctx: VibesApiSQLCtx, appSlug: string, ownerHandle: string): Promise<boolean> {
  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    ownerHandle,
    env: [],
  });
  if (rSettings.isErr()) return false;
  if (rSettings.Ok().settings.entry.publicAccess?.enable !== true) return false;

  const prodRow = await vctx.sql.db
    .select({ mode: vctx.sql.tables.apps.mode })
    .from(vctx.sql.tables.apps)
    .where(
      and(
        eq(vctx.sql.tables.apps.appSlug, appSlug),
        eq(vctx.sql.tables.apps.ownerHandle, ownerHandle),
        eq(vctx.sql.tables.apps.mode, "production")
      )
    )
    .limit(1)
    .then((r) => r[0]);

  return prodRow !== undefined;
}
