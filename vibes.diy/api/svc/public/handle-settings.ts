import { Result, exception2Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm";
import {
  ActiveAvatar,
  ActiveEntry,
  isActiveAvatar,
  isUserSettingDefaultHandle,
  isUserSettingProfile,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

// Per-handle settings store (HandleSettings table). Currently holds just the
// avatar (an `active.avatar` ActiveEntry). Keyed by `handle`; each handle a user
// owns has its own row so two handles never share avatar bytes (the privacy
// invariant). See docs/superpowers/specs/2026-06-18-per-handle-avatar-design.md.

export interface ResolvedAvatar {
  // The storage getURL for the current avatar. `active.avatar`'s `currentCid`
  // holds the getURL (app-icon convention), so resolution needs no assetUploads
  // lookup — the value is served directly via the cid-asset endpoint.
  readonly getURL: string;
  readonly mime: string;
}

function parseEntries(settings: unknown): ActiveEntry[] {
  const { filtered } = parseArrayWarning((settings as unknown[]) ?? [], ActiveEntry);
  return filtered;
}

function currentAvatar(entries: ActiveEntry[]): ResolvedAvatar | undefined {
  const avatar = entries.find(isActiveAvatar) as ActiveAvatar | undefined;
  if (!avatar) return undefined;
  const version = avatar.versions.find((v) => v.cid === avatar.currentCid);
  if (!version) return undefined;
  return { getURL: avatar.currentCid, mime: version.mime };
}

// Read the current avatar for a handle, or undefined when the handle has no row
// or no `active.avatar`. Callers serve 404 on undefined — never a cross-handle
// fallback.
export async function readHandleAvatar(vctx: VibesApiSQLCtx, handle: string): Promise<ResolvedAvatar | undefined> {
  const t = vctx.sql.tables.handleSettings;
  const row = await vctx.sql.db
    .select({ settings: t.settings })
    .from(t)
    .where(eq(t.handle, handle))
    .limit(1)
    .then((r) => r[0]);
  if (!row) return undefined;
  return currentAvatar(parseEntries(row.settings));
}

// Append a new avatar version and point `currentCid` at it (getURL holds the
// content, app-icon convention). Upserts the handle's row, preserving any other
// entries. `userId` is the verified owner; callers MUST check handle ownership
// before invoking (the host validates the viewer-supplied handle).
export async function writeHandleAvatar(
  vctx: VibesApiSQLCtx,
  args: { handle: string; userId: string; getURL: string; mime: string }
): Promise<Result<ResolvedAvatar>> {
  const t = vctx.sql.tables.handleSettings;
  const now = new Date().toISOString();
  const newVersion = { cid: args.getURL, mime: args.mime, created: now };

  const rUpsert = await exception2Result(async () => {
    const existing = await vctx.sql.db
      .select({ settings: t.settings })
      .from(t)
      .where(eq(t.handle, args.handle))
      .limit(1)
      .then((r) => r[0]);

    const entries = existing ? parseEntries(existing.settings) : [];
    const idx = entries.findIndex(isActiveAvatar);
    if (idx >= 0) {
      const prev = entries[idx] as ActiveAvatar;
      entries[idx] = { type: "active.avatar", versions: [...prev.versions, newVersion], currentCid: args.getURL };
    } else {
      entries.push({ type: "active.avatar", versions: [newVersion], currentCid: args.getURL });
    }

    if (existing) {
      await vctx.sql.db.update(t).set({ settings: entries, updated: now }).where(eq(t.handle, args.handle));
    } else {
      await vctx.sql.db
        .insert(t)
        .values({ handle: args.handle, userId: args.userId, settings: entries, updated: now, created: now });
    }
  });
  if (rUpsert.isErr()) return Result.Err(rUpsert.Err());
  return Result.Ok({ getURL: args.getURL, mime: args.mime });
}

// One-time migration: seed a user's DEFAULT handle avatar from the legacy
// per-user `userSettings.profile.avatarCid`, then leave every other handle
// blank. Touches exactly one handle, so it creates no cross-handle correlation.
// Best-effort and idempotent — safe to call on every settings load.
//
// Guardrails (all must hold, per spec Decision 5):
//   1. a legacy `avatarCid` exists (the caller passes it from the profile);
//   2. the default handle is currently owned by the user;
//   3. the default handle has no `active.avatar` yet (idempotent);
//   4. no valid default handle ⇒ skip (the caller passes undefined → no-op).
export async function seedDefaultHandleAvatar(
  vctx: VibesApiSQLCtx,
  args: { userId: string; defaultHandle: string | undefined; avatarCid: string | undefined }
): Promise<void> {
  if (!args.avatarCid || !args.defaultHandle) return; // guardrails 1 + 4
  await exception2Result(async () => {
    // guardrail 2: ownership
    const hb = vctx.sql.tables.handleBinding;
    const owns = await vctx.sql.db
      .select({ handle: hb.handle })
      .from(hb)
      .where(and(eq(hb.handle, args.defaultHandle as string), eq(hb.userId, args.userId)))
      .limit(1)
      .then((r) => r[0]);
    if (!owns) return;

    // guardrail 3: idempotent
    if (await readHandleAvatar(vctx, args.defaultHandle as string)) return;

    // resolve the legacy bare CID to the storage URI, scoped to this user's uploads
    const au = vctx.sql.tables.assetUploads;
    const upload = await vctx.sql.db
      .select({ assetURI: au.assetURI, mimeType: au.mimeType })
      .from(au)
      .where(and(eq(au.cid, args.avatarCid as string), eq(au.userId, args.userId)))
      .limit(1)
      .then((r) => r[0]);
    if (!upload) return;

    await writeHandleAvatar(vctx, {
      handle: args.defaultHandle as string,
      userId: args.userId,
      getURL: upload.assetURI,
      mime: upload.mimeType ?? "application/octet-stream",
    });
  });
}

// Extract the legacy avatarCid + default handle from a userSettings array and
// run the one-time default-handle seed. Called from ensureUserSettings so the
// migration happens lazily on the next settings load — no batch runner.
export async function migrateLegacyAvatar(vctx: VibesApiSQLCtx, userId: string, settings: unknown[]): Promise<void> {
  const profile = settings.find(isUserSettingProfile);
  const def = settings.find(isUserSettingDefaultHandle);
  await seedDefaultHandleAvatar(vctx, { userId, defaultHandle: def?.ownerHandle, avatarCid: profile?.avatarCid });
}

// Delete a handle's settings row (handle-delete lifecycle). Scoped by userId so
// a stale/foreign call can't wipe another user's row.
export async function deleteHandleSettings(vctx: VibesApiSQLCtx, handle: string, userId: string): Promise<Result<void>> {
  const t = vctx.sql.tables.handleSettings;
  const r = await exception2Result(() => vctx.sql.db.delete(t).where(and(eq(t.handle, handle), eq(t.userId, userId))));
  if (r.isErr()) return Result.Err(r.Err());
  return Result.Ok(undefined);
}
