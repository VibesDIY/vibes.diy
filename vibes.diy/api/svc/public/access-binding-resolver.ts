import { stream2uint8array } from "@adviser/cement";
import { and, eq, inArray, sql } from "drizzle-orm";
import { VibesApiSQLCtx } from "../types.js";
import { DM_APP_SLUG, DM_BUILTIN_CID, DM_BUILTIN_SOURCE } from "./dm-access-fn.js";

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
// Direct-message dbs (appSlug "dm") have no `/access.js` and no
// AccessFunctionBindings row — they resolve to the compiled-in DM access fn via
// a synthetic binding, so DM reads/writes flow through the same access-fn +
// channel-gating path as every other channelized db (#2290).
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
  if (appSlug === DM_APP_SLUG) {
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
