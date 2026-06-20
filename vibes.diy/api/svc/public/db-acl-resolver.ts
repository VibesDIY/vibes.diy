import { Result } from "@adviser/cement";
import { COMMENTS_DB_NAME, COMMENTS_DEFAULT_ACL, DbAcl, directChannelParticipants } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { and, eq, inArray } from "drizzle-orm";

// ACL evaluation (inGroup / aclAllows / canRead / canWrite) is defined once in
// the shared @vibes.diy/vibe-types/db-acl-eval module. Re-export aclAllows so
// this module's consumers (app-documents-*, files-asset, the parity test) keep
// importing it from here unchanged.
export { aclAllows } from "@vibes.diy/vibe-types";

// Resolve the per-(ownerHandle, appSlug, dbName) ACL.
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
  ownerHandle: string,
  appSlug: string,
  dbName: string
): Promise<Result<DbAcl | undefined>> {
  const rSettings = await ensureAppSettings(vctx, {
    type: "vibes.diy.req-ensure-app-settings",
    appSlug,
    ownerHandle,
    env: [],
  });
  if (rSettings.isErr()) return Result.Err(rSettings);
  const stored = rSettings.Ok().settings.entry.dbAcls?.[dbName];
  if (stored !== undefined) return Result.Ok(stored);
  if (dbName === COMMENTS_DB_NAME) return Result.Ok(COMMENTS_DEFAULT_ACL);
  return Result.Ok(undefined);
}

// Check whether `userId` is a participant in a direct-channel ownerHandle.
//
// A direct-channel slug encodes exactly two participant ownerHandles. This
// function queries `handleBinding` to see if any of the caller's ownerHandles
// matches either participant — if it does, access is granted. No app
// membership check is required; channel participation IS the gate.
//
// Returns Result<false> on parse failure or DB error so the caller can
// fail-closed.
export async function checkDirectChannelAccess(
  vctx: VibesApiSQLCtx,
  channelUserSlug: string,
  userId: string
): Promise<Result<boolean>> {
  const participants = directChannelParticipants(channelUserSlug);
  if (!participants) return Result.Ok(false);
  const [ownerHandleA, ownerHandleB] = participants;
  const t = vctx.sql.tables.handleBinding;
  const matches = await vctx.sql.db
    .select({ handle: t.handle })
    .from(t)
    .where(and(eq(t.userId, userId), inArray(t.handle, [ownerHandleA, ownerHandleB])));
  return Result.Ok(matches.length > 0);
}
