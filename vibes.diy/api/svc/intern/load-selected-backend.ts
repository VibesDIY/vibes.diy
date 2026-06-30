import { exception2Result, stream2uint8array } from "@adviser/cement";
import type { FileSystemItem } from "@vibes.diy/api-types";
import { parseBackendConfig, type BackendConfigParseResult } from "@vibes.diy/vibe-runtime/parse-backend-config.js";
import type { VibesApiSQLCtx } from "../types.js";
import { selectLatestAppPerSlug } from "../public/select-app.js";

const BACKEND_FILENAME = "/backend.js";

/** Why the selected release had no usable `/backend.js` (each ⇒ "no backend here"). */
export type LoadSelectedBackendReason = "no_release" | "no_backend_file" | "source_unreadable";

export type LoadSelectedBackendResult =
  | { readonly ok: true; readonly source: string; readonly parsed: BackendConfigParseResult }
  | { readonly ok: false; readonly reason: LoadSelectedBackendReason };

/**
 * Resolve a vibe's **selected release** (`selectLatestAppPerSlug`, the same
 * production-preferring row the viewer sees), read its `/backend.js` source from
 * storage, and parse it (#2856). The single source of truth shared by every
 * backend trigger path — the B3 `_api` `fetch` gate (`attemptBackendFetch`) and
 * the B4 `scheduled` arm/tick — so they can never disagree about which code is
 * live or what it declares.
 *
 * Never throws; returns a structured `ok: false` reason instead. Gate and source
 * come from the same release row, so the "has handler X?" decision can't drift
 * from the code that runs (the Codex release-skew fix, factored out of B3).
 */
export async function loadSelectedBackend(
  vctx: VibesApiSQLCtx,
  ownerHandle: string,
  appSlug: string
): Promise<LoadSelectedBackendResult> {
  const rRow = await exception2Result(() => selectLatestAppPerSlug(vctx, { ownerHandle, appSlug }));
  if (rRow.isErr()) return { ok: false, reason: "no_release" };
  const row = rRow.Ok();
  if (row === undefined) return { ok: false, reason: "no_release" };

  const fileSystem = (row.fileSystem ?? []) as FileSystemItem[];
  const backendItem = fileSystem.find((f) => f.fileName === BACKEND_FILENAME);
  if (backendItem === undefined) return { ok: false, reason: "no_backend_file" };

  const rSource = await exception2Result(() => loadSource(vctx, backendItem.assetURI));
  if (rSource.isErr()) return { ok: false, reason: "source_unreadable" };
  const source = rSource.Ok();
  if (source.length === 0) return { ok: false, reason: "source_unreadable" };

  return { ok: true, source, parsed: parseBackendConfig(source) };
}

/**
 * The validated `scheduled` interval (ms) for a vibe's selected release, or `null`
 * when there's no backend / no `scheduled` export / no valid interval (#2856 B4).
 * `BackendDO.arm()` uses this to decide whether (and at what cadence) to arm its
 * alarm — read fresh from the selected release every time, so the cron can't drift
 * from the release `_api` serves.
 */
export async function resolveBackendSchedule(vctx: VibesApiSQLCtx, ownerHandle: string, appSlug: string): Promise<number | null> {
  const loaded = await loadSelectedBackend(vctx, ownerHandle, appSlug);
  if (!loaded.ok) return null;
  if (!loaded.parsed.handlers.includes("scheduled")) return null;
  return loaded.parsed.schedule?.intervalMs ?? null;
}

/** Read a FileSystemItem's stored bytes as text (the render-vibe source-read pattern). */
async function loadSource(vctx: VibesApiSQLCtx, assetURI: string): Promise<string> {
  const r = await vctx.storage.fetch(assetURI);
  if (r.type !== "fetch.ok") throw new Error(`backend source fetch ${r.type} for ${assetURI}`);
  return vctx.sthis.txt.decode(await stream2uint8array(r.data));
}
