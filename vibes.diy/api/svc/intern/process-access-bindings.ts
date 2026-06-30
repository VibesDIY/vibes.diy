import { exception2Result, Result, stream2uint8array } from "@adviser/cement";
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { AccessDescriptor, FileSystemItem, StorageResult, VibeFile } from "@vibes.diy/api-types";
import type { VibesApiSQLCtx } from "../types.js";
import { extractExportSource } from "../public/access-function.js";

export interface ProcessAccessBindingsOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly fullFileSystem: readonly { readonly vibeFileItem: VibeFile; readonly storage: StorageResult }[];
  // Which lane is writing the binding (#2902). The AccessFunctionBindings row is
  // keyed per (ownerHandle, appSlug, dbName) with no version dimension and is read
  // by every write-time enforcement, so the LAST writer governs the whole live
  // namespace. Once an app has a *published* (production) version, an unpublished
  // dev draft must NOT re-bind that live access function — publishing is the
  // consent step. While no production version exists yet, the latest dev draft
  // governs so an owner can iterate on access.js before first publish.
  readonly mode: "dev" | "production";
}

export async function processAccessBindings(vctx: VibesApiSQLCtx, opts: ProcessAccessBindingsOpts): Promise<Result<void>> {
  return exception2Result(async () => {
    const { ownerHandle, appSlug, fullFileSystem, mode } = opts;
    const tAfb = vctx.sql.tables.accessFunctionBindings;

    // #2902: a dev draft is inert once the app has a published version — the
    // published version's access.js governs the live data namespace until the
    // owner publishes again (see publishAccessBindings, called from publishApp).
    if (mode === "dev" && (await hasPublishedVersion(vctx, ownerHandle, appSlug))) {
      return;
    }

    const accessJsEntry = fullFileSystem.find(
      (e) => e.vibeFileItem.filename === "/access.js" || e.vibeFileItem.filename.endsWith("/access.js")
    );

    if (accessJsEntry === undefined) {
      await vctx.sql.db.delete(tAfb).where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
      return;
    }

    const cid = accessJsEntry.storage.cid;
    if (cid === undefined) {
      console.error(`processAccessBindings: access.js has no CID for ${ownerHandle}/${appSlug}`);
      return;
    }

    const item = accessJsEntry.vibeFileItem;
    const accessJsSource: string | undefined =
      item.type === "code-block" || item.type === "str-asset-block" ? (item.content as string) : undefined;

    const exportNames = parseExportNames(accessJsSource);

    const existingBindings = await vctx.sql.db
      .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
      .from(tAfb)
      .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
    const oldCids = new Map(existingBindings.map((b) => [b.dbName, b.accessFnCid]));

    if (exportNames.length > 0) {
      for (const dbName of exportNames) {
        await vctx.sql.db
          .insert(tAfb)
          .values({
            ownerHandle: ownerHandle,
            appSlug,
            dbName,
            accessFnCid: cid,
            accessFnAssetUri: accessJsEntry.storage.getURL,
            updated: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: [tAfb.ownerHandle, tAfb.appSlug, tAfb.dbName],
            set: {
              accessFnCid: cid,
              accessFnAssetUri: accessJsEntry.storage.getURL,
              updated: new Date().toISOString(),
            },
          });
      }

      await vctx.sql.db
        .delete(tAfb)
        .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug), notInArray(tAfb.dbName, exportNames)));

      await backfillAccessFnOutputs(vctx, {
        ownerHandle,
        appSlug,
        cid,
        exportNames,
        oldCids,
        accessJsSource,
        accessJsEntry,
      });
    } else {
      await vctx.sql.db.delete(tAfb).where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug)));
    }
  });
}

// True when a production (published) Apps row exists for (ownerHandle, appSlug).
// Soft-unpublish (#2688) only tombstones AppSlugBindings — it never removes the
// production rows — so existence is the stable "has ever been published" signal.
async function hasPublishedVersion(vctx: VibesApiSQLCtx, ownerHandle: string, appSlug: string): Promise<boolean> {
  const tApps = vctx.sql.tables.apps;
  const row = await vctx.sql.db
    .select({ fsId: tApps.fsId })
    .from(tApps)
    .where(and(eq(tApps.ownerHandle, ownerHandle), eq(tApps.appSlug, appSlug), eq(tApps.mode, "production")))
    .limit(1)
    .then((r) => r[0]);
  return row !== undefined;
}

// Re-bind the live access function to a *published* version's access.js (#2902).
// Called from publishApp after a production release is minted, so the binding the
// write-time gate reads tracks the published version rather than whatever dev draft
// was saved last. The stored filesystem only carries content-addressed refs, so we
// re-hydrate the access.js source bytes (parseExportNames needs real source) and
// hand a synthetic in-memory entry to processAccessBindings in production mode.
export async function publishAccessBindings(
  vctx: VibesApiSQLCtx,
  opts: { readonly ownerHandle: string; readonly appSlug: string; readonly fileSystem: readonly FileSystemItem[] }
): Promise<Result<void>> {
  const { ownerHandle, appSlug, fileSystem } = opts;
  const accessItem = fileSystem.find((f) => f.fileName === "/access.js" || f.fileName.endsWith("/access.js"));

  // Published version has no access.js → clear any stale binding from a prior
  // published version (processAccessBindings deletes when no access.js is present).
  if (accessItem === undefined) {
    return processAccessBindings(vctx, { ownerHandle, appSlug, fullFileSystem: [], mode: "production" });
  }

  const rSource = await exception2Result(async () => {
    const rFetch = await vctx.storage.fetch(accessItem.assetURI);
    if (rFetch.type !== "fetch.ok") {
      throw new Error(`failed to fetch access.js source from ${accessItem.assetURI}`);
    }
    return vctx.sthis.txt.decode(await stream2uint8array(rFetch.data));
  });
  if (rSource.isErr()) {
    return Result.Err(`publishAccessBindings: ${rSource.Err().message}`);
  }

  const vibeFileItem: VibeFile = {
    type: "code-block",
    lang: "js",
    filename: accessItem.fileName,
    content: rSource.Ok(),
  };
  const storage: StorageResult = {
    cid: accessItem.assetId,
    getURL: accessItem.assetURI,
    mode: "existing",
    created: new Date(),
    size: accessItem.size,
  };
  return processAccessBindings(vctx, {
    ownerHandle,
    appSlug,
    fullFileSystem: [{ vibeFileItem, storage }],
    mode: "production",
  });
}

function parseExportNames(source: string | undefined): string[] {
  if (source === undefined) return [];

  const exportNames: string[] = [];

  const fnPattern = /export\s+function\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = fnPattern.exec(source)) !== null) {
    const name = match[1];
    if (name !== undefined && name !== "default") {
      exportNames.push(name);
    }
  }

  const asPattern = /export\s*\{\s*\w+\s+as\s+["']([^"']+)["']\s*\}/g;
  while ((match = asPattern.exec(source)) !== null) {
    const name = match[1];
    if (name !== undefined) {
      exportNames.push(name);
    }
  }

  const hasDefaultExport =
    /export\s+default\s+function/.test(source) ||
    /export\s+default\s+\(/.test(source) ||
    /export\s+default\s+\w+\s*=>/.test(source);

  if (hasDefaultExport) {
    exportNames.push("*");
  }

  return exportNames;
}

interface BackfillOpts {
  readonly ownerHandle: string;
  readonly appSlug: string;
  readonly cid: string;
  readonly exportNames: readonly string[];
  readonly oldCids: ReadonlyMap<string, string>;
  readonly accessJsSource: string | undefined;
  readonly accessJsEntry: { readonly storage: StorageResult };
}

async function backfillAccessFnOutputs(vctx: VibesApiSQLCtx, opts: BackfillOpts): Promise<void> {
  const invokeAccessFn = vctx.invokeAccessFn;
  if (invokeAccessFn === undefined) return;

  const { ownerHandle, appSlug, cid, exportNames, oldCids } = opts;
  const changedDbNames = exportNames.filter((name) => oldCids.get(name) !== cid);
  if (changedDbNames.length === 0) return;

  let backfillSource: string | undefined = opts.accessJsSource;
  if (backfillSource === undefined && opts.accessJsEntry.storage.getURL !== undefined) {
    const rFetch = await vctx.storage.fetch(opts.accessJsEntry.storage.getURL);
    if (rFetch.type === "fetch.ok") {
      const reader = rFetch.data.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value !== undefined) chunks.push(value);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const merged = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      backfillSource = new TextDecoder().decode(merged);
    }
  }

  if (backfillSource === undefined) return;

  const tDocs = vctx.sql.tables.appDocuments;
  const tOutputs = vctx.sql.tables.accessFnOutputs;
  const namedExportNames = exportNames.filter((n) => n !== "*");

  const expandedDbNames: string[] = [];
  for (const dbName of changedDbNames) {
    if (dbName === "*") {
      const distinctDbs = await vctx.sql.db
        .selectDistinct({ dbName: tDocs.dbName })
        .from(tDocs)
        .where(and(eq(tDocs.ownerHandle, ownerHandle), eq(tDocs.appSlug, appSlug)));
      for (const row of distinctDbs) {
        if (!namedExportNames.includes(row.dbName)) {
          expandedDbNames.push(row.dbName);
        }
      }
    } else {
      expandedDbNames.push(dbName);
    }
  }

  for (const dbName of expandedDbNames) {
    const t0 = Date.now();
    let docsTotal = 0;
    let docsUpserted = 0;
    let docsForbiddenSkipped = 0;
    let invokeErrors = 0;
    let upsertErrors = 0;

    const allRows = await vctx.sql.db
      .select({ docId: tDocs.docId, data: tDocs.data, deleted: tDocs.deleted })
      .from(tDocs)
      .where(and(eq(tDocs.ownerHandle, ownerHandle), eq(tDocs.appSlug, appSlug), eq(tDocs.dbName, dbName)))
      .orderBy(sql`${tDocs.docId}, ${tDocs.seq}`);

    const latest = new Map<string, (typeof allRows)[0]>();
    for (const row of allRows) {
      latest.set(row.docId, row);
    }

    const isWildcardExpanded = !namedExportNames.includes(dbName);
    const dbSource = isWildcardExpanded ? extractExportSource(backfillSource, "*") : extractExportSource(backfillSource, dbName);
    const effectiveSource = dbSource ?? backfillSource;

    for (const [docId, row] of latest) {
      if (row.deleted === 1) continue;
      docsTotal++;

      const rInvoke = await exception2Result(() =>
        invokeAccessFn({
          cid,
          doc: { ...(row.data as Record<string, unknown>), _id: docId },
          oldDoc: null,
          user: null,
          source: effectiveSource,
          grantState: { members: {}, roleGrants: {}, userGrants: {} },
        })
      );

      if (rInvoke.isErr()) {
        invokeErrors++;
        console.warn(`backfill: access fn threw for ${ownerHandle}/${appSlug}/${dbName}/${docId}:`, rInvoke.Err());
        continue;
      }

      const invokeResult = rInvoke.Ok();
      if ("forbidden" in invokeResult) {
        docsForbiddenSkipped++;
        continue;
      }

      const accessResult = invokeResult as AccessDescriptor;
      const outputHasGrants =
        (accessResult.members !== undefined && Object.keys(accessResult.members).length > 0) ||
        (accessResult.grant?.users !== undefined && Object.keys(accessResult.grant.users).length > 0) ||
        (accessResult.grant?.roles !== undefined && Object.keys(accessResult.grant.roles).length > 0) ||
        (accessResult.grant?.public !== undefined && accessResult.grant.public.length > 0)
          ? 1
          : 0;

      const rUpsert = await exception2Result(() =>
        vctx.sql.db
          .insert(tOutputs)
          .values({
            ownerHandle: ownerHandle,
            appSlug,
            dbName,
            docId,
            fnCid: cid,
            output: JSON.stringify(accessResult),
            hasGrants: outputHasGrants,
          })
          .onConflictDoUpdate({
            target: [tOutputs.ownerHandle, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
            set: {
              fnCid: cid,
              output: JSON.stringify(accessResult),
              hasGrants: outputHasGrants,
            },
          })
      );
      if (rUpsert.isErr()) {
        upsertErrors++;
        console.warn(`backfill: output upsert failed for ${ownerHandle}/${appSlug}/${dbName}/${docId}:`, rUpsert.Err());
      } else {
        docsUpserted++;
      }
    }

    console.info(
      `backfill: ${ownerHandle}/${appSlug}/${dbName} cid=${cid.slice(0, 8)}` +
        ` total=${docsTotal} upserted=${docsUpserted} forbidden=${docsForbiddenSkipped}` +
        ` invokeErr=${invokeErrors} upsertErr=${upsertErrors} elapsed=${Date.now() - t0}ms`
    );
  }
}
