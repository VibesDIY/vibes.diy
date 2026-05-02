import { Result } from "@adviser/cement";
import { COMMENTS_DB_NAME, COMMENTS_DEFAULT_ACL, DbAcl, DbAclSubject } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { DocAccessLevel, canRead, canWrite } from "./access-helpers.js";
import { ensureAppSettings } from "./ensure-app-settings.js";

// Built-in groups projected from existing role grants.
//
// Owner is implicitly in every group, so the resolver never requires owners
// to appear in an ACL. Each non-owner case maps directly to a single role,
// since DocAccessLevel = Role | "owner" | "none".
export function inGroup(level: DocAccessLevel, group: DbAclSubject): boolean {
  if (level === "owner") return true;
  switch (group) {
    case "members":
      return level === "editor" || level === "viewer" || level === "submitter";
    case "editors":
      return level === "editor";
    case "submitters":
      return level === "submitter";
    case "readers":
      return level === "editor" || level === "viewer";
  }
}

// Resolve the per-(userSlug, appSlug, dbName) ACL.
//
// Storage: each ACL lives as one ActiveDbAcl entry in the AppSettings JSON
// blob. Loading goes through the same ensureAppSettings path used for every
// other app config — no dedicated table.
//
// Returns Result so the caller can fail-closed on settings-read errors: a
// transient ensureAppSettings failure must NOT silently revert a tightened
// ACL back to the open default.
//
// Fallback for missing entries (only when settings load succeeds):
//   - dbName === "comments" → COMMENTS_DEFAULT_ACL (write/delete: members)
//   - any other dbName → undefined (caller falls back to canRead / canWrite)
export async function resolveDbAcl(
  vctx: VibesApiSQLCtx,
  userSlug: string,
  appSlug: string,
  dbName: string
): Promise<Result<DbAcl | undefined>> {
  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    userSlug,
    env: [],
  });
  if (rSettings.isErr()) return Result.Err(rSettings);
  const stored = rSettings.Ok().settings.entry.dbAcls?.[dbName];
  if (stored !== undefined) return Result.Ok(stored);
  if (dbName === COMMENTS_DB_NAME) return Result.Ok(COMMENTS_DEFAULT_ACL);
  return Result.Ok(undefined);
}

// Decide whether `access` may exercise `cap` against `acl`. When the ACL
// does not list the capability, fall back to today's role gate (canRead for
// reads, canWrite for writes/deletes).
export function aclAllows(
  acl: DbAcl | undefined,
  cap: "read" | "write" | "delete",
  access: DocAccessLevel
): boolean {
  const subjects = acl?.[cap];
  if (subjects === undefined) {
    return cap === "read" ? canRead(access) : canWrite(access);
  }
  return subjects.some((g) => inGroup(access, g));
}
