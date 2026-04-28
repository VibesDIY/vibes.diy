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
  userSlug: string
): Promise<DocAccessLevel> {
  const binding = await vctx.sql.db
    .select({ userId: vctx.sql.tables.userSlugBinding.userId })
    .from(vctx.sql.tables.userSlugBinding)
    .where(eq(vctx.sql.tables.userSlugBinding.userSlug, userSlug))
    .limit(1)
    .then((r) => r[0]);

  if (binding?.userId === userId) return "owner";

  const rInvite = await hasAccessInvite(vctx, { grantUserId: userId, appSlug, userSlug });
  if (rInvite.isOk()) {
    const invite = rInvite.Ok();
    if (isResHasAccessInviteAccepted(invite)) {
      return invite.role;
    }
  }

  const rReq = await hasAccessRequest(vctx, { foreignUserId: userId, appSlug, userSlug });
  if (rReq.isOk()) {
    const req = rReq.Ok();
    if (isResHasAccessRequestApproved(req)) {
      return req.role;
    }
  }

  return "none";
}

export async function isPublicReadable(vctx: VibesApiSQLCtx, appSlug: string, userSlug: string): Promise<boolean> {
  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    userSlug,
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
        eq(vctx.sql.tables.apps.userSlug, userSlug),
        eq(vctx.sql.tables.apps.mode, "production")
      )
    )
    .limit(1)
    .then((r) => r[0]);

  return prodRow !== undefined;
}
