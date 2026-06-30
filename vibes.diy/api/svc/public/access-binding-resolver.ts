import { stream2uint8array } from "@adviser/cement";
import { and, eq, inArray, sql } from "drizzle-orm";
import { isDirectChannel, directChannelParticipants } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";
import { DM_BUILTIN_CID, DM_BUILTIN_SOURCE } from "./dm-access-fn.js";

export interface ResolvedAccessBinding {
  readonly accessFnCid: string;
  // Asset URI to fetch the source from. `undefined` for the synthetic DM
  // binding, whose source is compiled in (resolveAccessFnSource short-circuits).
  readonly accessFnAssetUri?: string;
  // The binding's dbName ("messages", the requested dbName, or "*"). Callers pass
  // it to extractExportSource to pull the right export out of a multi-fn source.
  readonly dbName: string;
}

// Resolve the effective access-fn binding for a (ownerHandle, appSlug, dbName).
//
// Direct-message dbs have no `/access.js` and no AccessFunctionBindings row —
// they resolve to the compiled-in DM access fn via a synthetic binding, so DM
// reads/writes flow through the same access-fn + channel-gating path as every
// other channelized db (#2290).
//
// The DM discriminator is the `_d.<a>.<b>` ownerHandle slug (isDirectChannel),
// NOT the appSlug: a user-created vibe can legitimately have the slug "dm"
// (ensureAppSlug doesn't reserve it), and that real app must keep using the
// normal ACL / access-fn path — only the synthetic `_d.` channel namespace is a
// DM db (Codex review).
//
// For all other apps this is the binding lookup that was previously duplicated
// inline in putDoc / deleteDoc / queryDocs / subscribeDocs: a named dbName
// binding beats the app-wide "*" wildcard.
export async function resolveAccessBinding(
  vctx: VibesApiSQLCtx,
  ownerHandle: string,
  appSlug: string,
  dbName: string
): Promise<ResolvedAccessBinding | undefined> {
  if (isDirectChannel(ownerHandle)) {
    return { accessFnCid: DM_BUILTIN_CID, dbName };
  }
  const tAfb = vctx.sql.tables.accessFunctionBindings;
  const row = await vctx.sql.db
    .select({ accessFnCid: tAfb.accessFnCid, accessFnAssetUri: tAfb.accessFnAssetUri, dbName: tAfb.dbName })
    .from(tAfb)
    .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug), inArray(tAfb.dbName, [dbName, "*"])))
    .orderBy(sql`CASE WHEN ${tAfb.dbName} = ${dbName} THEN 0 ELSE 1 END`)
    .limit(1)
    .then((r) => r[0]);
  if (!row) return undefined;
  return { accessFnCid: row.accessFnCid, accessFnAssetUri: row.accessFnAssetUri ?? undefined, dbName: row.dbName };
}

// Resolve which of the channel's two participant handles the caller owns, for a
// DM db. A user with multiple handles can be addressed at a handle that is not
// their active/default one, so the access fn (and the read channel filter) must
// act as the handle that actually appears in the `_d.<a>.<b>` slug — not the
// global active handle. Returns undefined if the caller owns neither participant
// handle (the access fn then forbids the write / the filter shows nothing).
// This restores the old checkDirectChannelAccess "any bound participant handle"
// behavior (Codex review).
export async function resolveDmParticipantHandle(
  vctx: VibesApiSQLCtx,
  userId: string,
  channelSlug: string
): Promise<string | undefined> {
  const participants = directChannelParticipants(channelSlug);
  if (!participants) return undefined;
  const t = vctx.sql.tables.handleBinding;
  const row = await vctx.sql.db
    .select({ handle: t.handle })
    .from(t)
    .where(and(eq(t.userId, userId), inArray(t.handle, participants)))
    .then((r) => r[0]);
  return row?.handle;
}

// Resolve the raw access.js source bytes for a CID. The synthetic DM binding's
// CID maps to the compiled-in source (no storage round-trip); every other CID
// goes through the per-DO source cache, then the asset store, caching the bytes
// on a miss. Mirrors the inline resolution the write path used before #2290.
export async function resolveAccessFnSource(
  vctx: VibesApiSQLCtx,
  cid: string,
  assetUri: string | undefined
): Promise<string | undefined> {
  if (cid === DM_BUILTIN_CID) return DM_BUILTIN_SOURCE;
  const cached = vctx.accessFnSourceCache?.get(cid);
  if (cached !== undefined) return cached;
  if (!assetUri) return undefined;
  const rFetch = await vctx.storage.fetch(assetUri);
  if (rFetch.type !== "fetch.ok") return undefined;
  const source = new TextDecoder().decode(await stream2uint8array(rFetch.data));
  vctx.accessFnSourceCache?.set(cid, source);
  return source;
}
