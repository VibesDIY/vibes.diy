import {
  ReqEnsureAppSlug,
  VibeFile,
  FileSystemItem,
  isVibeCodeBlock,
  VibeCodeBlock,
  StorageResult,
  ResEnsureAppSlug,
  ResEnsureAppSlugMaxAppsError,
  isResEnsureAppSlugMaxAppsError,
  MetaItem,
  isCrossReleaseMetaItem,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { exception2Result, Result, string2stream, to_uint8, toSortedObject } from "@adviser/cement";
import { ensureLogger } from "@vibes.diy/identity";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { and, desc, eq, ne } from "drizzle-orm/sql/expressions";
import mime from "mime";
import { transform } from "sucrase";
import { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration, parse } from "acorn";
import { AppHandleBinding, VibesApiSQLCtx } from "../types.js";
import { allocateAndInsertApp } from "../public/app-seq-allocation.js";
import { formatDbErrorChain } from "../public/seq-allocation.js";

async function checkMaxAppsPerUser(
  ctx: VibesApiSQLCtx,
  userId: string,
  appSlug: string
): Promise<Result<number | ResEnsureAppSlugMaxAppsError>> {
  const userApps = await ctx.sql.db
    .select()
    .from(ctx.sql.tables.apps)
    .where(eq(ctx.sql.tables.apps.userId, userId))
    .orderBy(ctx.sql.tables.apps.created);
  if (userApps.length >= ctx.params.maxAppSlugPerUserId) {
    return Result.Ok({
      type: "vibes.diy.res-error",
      error: {
        message: `User has reached the maximum number of app slugs (${ctx.params.maxAppSlugPerUserId}). Please delete existing apps before creating new ones.`,
        code: "max-app-slugs-reached",
      },
    } satisfies ResEnsureAppSlugMaxAppsError);
    // const devApps = userApps.filter((app) => app.mode === "dev").slice(0, ~~(userApps.length / 10) + 1);
    // if (devApps.length === 0) {
    // }
    // await ctx.sql.db
    //   .delete(ctx.sql.tables.apps)
    //   .where(
    //     or(
    //       ...devApps.map((app) =>
    //         and(
    //           eq(ctx.sql.tables.apps.userId, userId),
    //           eq(ctx.sql.tables.apps.releaseSeq, app.releaseSeq),
    //           eq(ctx.sql.tables.apps.appSlug, app.appSlug)
    //         )
    //       )
    //     )
    //   );
  }
  return Result.Ok(userApps.filter((app) => app.appSlug === appSlug).reduce((max, app) => Math.max(app.releaseSeq, max), 0));
}

async function computeFsId(env: Record<string, string>, fs: { vibeFileItem: VibeFile; storage: StorageResult }[]): Promise<string> {
  // Better don't change this code it's used to generate a stable fsId
  const fsIdStr = [
    fs
      .sort((a, b) => a.vibeFileItem.filename.localeCompare(b.vibeFileItem.filename))
      .map((fs) => [fs.vibeFileItem.filename, fs.vibeFileItem.mimetype, fs.storage.cid]),
    JSON.stringify(toSortedObject(env ?? {})),
  ]
    .flat()
    .join("|");
  const uint8Content = to_uint8(fsIdStr);
  const hash = await sha256.digest(uint8Content);
  const fsId = base58btc.encode(hash.digest);
  return fsId;
}

export function transformJSXToJS(code: string) {
  return transform(code, {
    transforms: ["jsx"],
    jsxRuntime: "automatic",
  }).code;
}

export function importsFromJS(js: string): string[] {
  // console.log("parsing js for imports", js);
  const ast = parse(js, { ecmaVersion: "latest", sourceType: "module" });
  const imports = ast.body
    .filter(
      (n): n is ImportDeclaration | ExportNamedDeclaration | ExportAllDeclaration =>
        n.type === "ImportDeclaration" ||
        (n.type === "ExportNamedDeclaration" && n.source !== null) ||
        n.type === "ExportAllDeclaration"
    )
    .map((n) => n.source?.value)
    .filter((v): v is string => typeof v === "string");
  return [...new Set(imports)];
}

// Relative paths and real absolute URLs — kept byte-identical to the hot-swap
// fallback's RELATIVE_OR_URL (vibe/runtime/bare-specifier-rewrite.ts) so the
// deploy-time scanner and the in-iframe resolver classify specifiers the same
// way. NOTE the scheme list is deliberately `https?://|blob:|data:` and NOT a
// generic `scheme:` match: `node:buffer` & friends are browser-polyfillable
// builtins that esm.sh serves at `https://esm.sh/node:buffer`, so they must
// stay bare and flow into the import map — exactly as the hot-swap path treats
// them. (Codex review on #2471.)
const RELATIVE_OR_URL = /^(?:\.\.?\/|\/|https?:\/\/|blob:|data:)/;

// A specifier belongs in the generated esm.sh import map only when it is a bare
// package name (`clsx`, `@scope/pkg`, `react-dom/client`, `node:buffer`).
// Relative paths and fully-qualified URLs must be left out: relative paths are
// served from the vibe origin, and absolute URLs (`https://esm.sh/canvas-confetti`,
// `blob:`, `data:`, protocol-relative `//host`) are fetched by the browser as-is.
// Capturing the latter would feed the URL to render_esm_sh, which prepends
// `https://esm.sh/` onto it — producing `https://esm.sh/https:/esm.sh/canvas-confetti`
// and a 400.
export function isBareImportSpecifier(spec: string): boolean {
  return !RELATIVE_OR_URL.test(spec);
}

interface GivenFsItem {
  vibeFileItem: VibeFile;
  fsItem: FileSystemItem;
}

async function transformJSXAndImports(
  ctx: VibesApiSQLCtx,
  givenFsItems: GivenFsItem[],
  imports: Map<string, string[]>
): Promise<Result<FileSystemItem>[]> {
  const acc: Result<FileSystemItem>[] = [];
  //   vibeFileItem: VibeFile;
  //   // prepareStorage?: Awaited<ReturnType<typeof calcCid>>;
  //   fsItem: FileSystemItem;
  // }>[] = [];
  // const id = ctx.sthis.nextId().str;
  await Promise.all(
    givenFsItems.map(async (item) => {
      // console.log("Processing file system item:", id, idx, item.fsItem.transform, {
      //   ...item.vibeFileItem,
      //   content: "[content hidden]",
      // });
      if (item.fsItem.transform?.type === "jsx-to-js" && isVibeCodeBlock(item.vibeFileItem)) {
        const rJsStr = exception2Result(() => transformJSXToJS((item.vibeFileItem as VibeCodeBlock).content));
        if (rJsStr.isErr()) {
          console.error(`Failed to transform JSX to JS for file ${item.vibeFileItem.filename}: ${rJsStr.Err()}`);
          const { transform: _dropped, ...withoutTransform } = item.fsItem;
          acc.push(Result.Ok(withoutTransform));
          return;
        }
        const jsStr = rJsStr.Ok();

        const rImports = exception2Result(() => importsFromJS(jsStr));
        if (rImports.isErr()) {
          console.error(`Failed to extract imports from transformed JS for file ${item.vibeFileItem.filename}: ${rImports.Err()}`);
          const { transform: _dropped, ...withoutTransform } = item.fsItem;
          acc.push(Result.Ok(withoutTransform));
          return;
        }
        rImports.Ok().forEach((imp) => {
          if (!isBareImportSpecifier(imp)) return;
          if (!imports.has(imp)) {
            imports.set(imp, []);
          }
          imports.get(imp)?.push(item.fsItem.assetId);
        });

        const [rStore] = await ctx.storage.ensure(string2stream(jsStr));
        if (rStore.isErr()) {
          acc.push(Result.Err(new Error(`Failed to store transformed JS: ${rStore.Err()}`)));
          return;
        }
        acc.push(
          Result.Ok({
            ...item.fsItem,
            transform: { type: "jsx-to-js", transformedAssetId: rStore.Ok().cid },
          })
        );
        // new entry for import calculation
        acc.push(
          Result.Ok({
            fileName: `/~~transformed~~/${item.fsItem.assetId}`,
            mimeType: "text/javascript",
            assetId: rStore.Ok().cid,
            assetURI: rStore.Ok().getURL,
            transform: {
              type: "transformed",
              action: "jsx-to-js",
              transformedAssetId: item.fsItem.assetId,
            },
            size: jsStr.length,
            // prepareStorage: dataCid,
          })
        );
      } else if (isVibeCodeBlock(item.vibeFileItem) && item.vibeFileItem.lang === "js") {
        const rImports = exception2Result(() => importsFromJS((item.vibeFileItem as VibeCodeBlock).content));
        if (rImports.isErr()) {
          console.error(`Failed to extract imports from JS for file ${item.vibeFileItem.filename}: ${rImports.Err()}`);
          acc.push(Result.Ok(item.fsItem));
          return;
        }
        rImports.Ok().forEach((imp) => {
          if (!isBareImportSpecifier(imp)) return;
          if (!imports.has(imp)) {
            imports.set(imp, []);
          }
          imports.get(imp)?.push(item.fsItem.assetId);
        });
        acc.push(Result.Ok(item.fsItem));
      } else {
        // Bare assets (str-asset-block, uint8-asset-block, etc.) — include as-is so
        // serv-entry-point can serve them at their original filename path.
        acc.push(Result.Ok(item.fsItem));
      }
    })
  );
  return acc;
}

async function createImportMap(
  ctx: VibesApiSQLCtx,
  _mode: ReqEnsureAppSlug["mode"], // controls locked vs unlocked import map
  // transformed: {
  //   vibeFileItem: VibeFile;
  //   fsItem: FileSystemItem;
  // }[],
  imports: Map<string, string[]>
): Promise<Result<FileSystemItem>[]> {
  const imapStr = JSON.stringify({
    imports: Object.fromEntries(Array.from(imports.entries()).map(([imp, files]) => [imp, `vibed:${files.join(",")}`])),
  });
  const [rStore] = await ctx.storage.ensure(string2stream(imapStr));
  if (rStore.isErr()) {
    return [Result.Err(rStore)];
  }
  // console.log("Generated import map:", imapStr, imports, Array.from(new Set(Array.from(imports.values()).flat())) );
  return [
    Result.Ok({
      fileName: `/~~calculated~~/import-map.json`,
      mimeType: "application/importmap+json",
      assetId: rStore.Ok().cid,
      assetURI: rStore.Ok().getURL,
      transform: {
        type: "import-map",
        fromAssetIds: Array.from(new Set(Array.from(imports.values()).flat())),
      },
      size: imapStr.length,
    }),
  ];
}

async function toFileSystemItems(
  ctx: VibesApiSQLCtx,
  mode: ReqEnsureAppSlug["mode"],
  fs: { vibeFileItem: VibeFile; storage: StorageResult }[]
): Promise<Result<FileSystemItem>[]> {
  const givenFsItems = fs.map((f) => {
    const ret: FileSystemItem = {
      fileName: f.vibeFileItem.filename,
      assetId: f.storage.cid,
      mimeType:
        f.vibeFileItem.mimetype ??
        mime.getType(
          f.vibeFileItem.filename.replace(/.jsx$/, ".js") // for better jsx transform and import extraction, we treat .jsx as .js for mime type
        ) ??
        "application/octet-stream",
      assetURI: f.storage.getURL,
      size: f.storage.size,
    };
    // Only .jsx/.tsx files need the JSX→JS transform; plain .js files are valid ES modules as-is
    if (isVibeCodeBlock(f.vibeFileItem) && ["jsx", "tsx"].includes(f.vibeFileItem.lang)) {
      ret.transform = {
        type: "jsx-to-js",
        transformedAssetId: "setAfterTransform",
      };
    }
    if (f.vibeFileItem.entryPoint) {
      ret.entryPoint = true;
    }
    return { ...f, fsItem: ret };
  });

  const imports = new Map<string, string[]>();
  // do transforms
  const transformed = await transformJSXAndImports(ctx, givenFsItems, imports);
  transformed.push(
    ...(await createImportMap(
      ctx,
      mode,
      // transformed.filter((item) => item.isOk()).map((item) => item.Ok())
      imports
    ))
  );
  return transformed;
}

export interface EnsureAppsOpts {
  readonly env: Record<string, string>;
  readonly mode: "dev" | "production";
  readonly userId: string;
  readonly runId?: string;
}

export async function ensureApps(
  ctx: VibesApiSQLCtx,
  opts: EnsureAppsOpts,
  binding: AppHandleBinding,
  fs: { vibeFileItem: VibeFile; storage: StorageResult }[]
): Promise<Result<ResEnsureAppSlug>> {
  // console.log("0-ensureApps called with opts:", opts, "binding:", binding, "fs:", fs);
  const fsId = await computeFsId(opts.env ?? {}, fs);

  // One release per generate operation (#2616): a run is identified by `runId`
  // (the promptId), threaded through both the server-side dev publish and the
  // CLI production push. The dev->production reconcile is NOT done here — it
  // happens atomically inside allocateAndInsertApp, under the same
  // per-(user,app) lock as release allocation, so two same-runId writers can't
  // append two releases and a late dev publish can't clobber a finalized
  // production one (the pre-lock check this used to do raced under out-of-order
  // writers). This read is only a hint to skip the max-apps gate for a
  // reconcile (which appends no new row); it is not the authoritative decision.
  const runReconcile =
    opts.runId === undefined
      ? undefined
      : await ctx.sql.db
          .select({ releaseSeq: ctx.sql.tables.apps.releaseSeq })
          .from(ctx.sql.tables.apps)
          .where(
            and(
              eq(ctx.sql.tables.apps.appSlug, binding.appSlug.appSlug),
              eq(ctx.sql.tables.apps.ownerHandle, binding.ownerHandle.ownerHandle),
              eq(ctx.sql.tables.apps.userId, binding.ownerHandle.userId),
              eq(ctx.sql.tables.apps.runId, opts.runId)
            )
          )
          .limit(1)
          .then((r) => r[0]);

  const exist =
    opts.runId !== undefined
      ? undefined
      : await ctx.sql.db
          .select()
          .from(ctx.sql.tables.apps)
          .where(
            and(
              eq(ctx.sql.tables.apps.appSlug, binding.appSlug.appSlug),
              eq(ctx.sql.tables.apps.ownerHandle, binding.ownerHandle.ownerHandle),
              eq(ctx.sql.tables.apps.fsId, fsId),
              eq(ctx.sql.tables.apps.userId, binding.ownerHandle.userId)
            )
          )
          .limit(1)
          .then((r) => r[0]);
  if (exist) {
    // console.log("1-ensureApps called with opts:", opts, "binding:", binding, "fs:", fs);
    if (opts.mode === "production" && exist.mode === "dev") {
      // upgrade dev to production
      await ctx.sql.db
        .update(ctx.sql.tables.apps)
        .set({ mode: opts.mode })
        .where(
          and(
            eq(ctx.sql.tables.apps.userId, binding.ownerHandle.userId),
            eq(ctx.sql.tables.apps.fsId, fsId),
            eq(ctx.sql.tables.apps.appSlug, binding.appSlug.appSlug),
            eq(ctx.sql.tables.apps.ownerHandle, binding.ownerHandle.ownerHandle)
          )
        );
    }
    const rFileSystems = await toFileSystemItems(ctx, opts.mode, fs);
    if (rFileSystems.some((item) => item.isErr())) {
      return Result.Err(
        `Failed to process file system items: ${rFileSystems
          .filter((item) => item.isErr())
          .map((item) => item.Err().message)
          .join(", ")}`
      );
    }
    return Result.Ok({
      type: "vibes.diy.res-ensure-app-slug",
      ownerHandle: binding.ownerHandle.ownerHandle,
      appSlug: binding.appSlug.appSlug,
      mode: opts.mode,
      fsId,
      env: opts.env,
      fileSystem: rFileSystems.map((item) => item.Ok()),
      // wrapperUrl: "string",
      // entryPointUrl: "string",
    });
  }

  // console.log("2-ensureApps called with opts:", opts, "binding:", binding, "fs:", fs);
  // transaction start
  // Reconciling an existing run appends no new row, so it must not be blocked by
  // the max-apps gate (the old pre-lock reconcile branch returned before this).
  if (!runReconcile) {
    const rMaxSeq = await checkMaxAppsPerUser(ctx, opts.userId, binding.appSlug.appSlug);
    if (rMaxSeq.isErr()) {
      return Result.Err(rMaxSeq);
    }
    const maxSeq = rMaxSeq.Ok();
    if (isResEnsureAppSlugMaxAppsError(maxSeq)) {
      return Result.Ok(maxSeq);
    }
    if (typeof maxSeq !== "number") {
      return Result.Err(`Unexpected result from checkMaxAppsPerUser: ${maxSeq}`);
    }
  }
  const rFileSystems = await toFileSystemItems(ctx, opts.mode, fs);
  if (rFileSystems.some((item) => item.isErr())) {
    return Result.Err(
      `Failed to process file system items: ${rFileSystems
        .filter((item) => item.isErr())
        .map((item) => item.Err().message)
        .join(", ")}`
    );
  }
  // Carry forward cross-release meta (title, remix-of) from the prior
  // release at this (appSlug, ownerHandle, userId). fsId-bound entries like
  // screen-shot-ref are excluded by the allow-list and get regenerated per
  // release by the screenshot queue.
  const priorRow = await ctx.sql.db
    .select({ meta: ctx.sql.tables.apps.meta })
    .from(ctx.sql.tables.apps)
    .where(
      and(
        eq(ctx.sql.tables.apps.appSlug, binding.appSlug.appSlug),
        eq(ctx.sql.tables.apps.ownerHandle, binding.ownerHandle.ownerHandle),
        eq(ctx.sql.tables.apps.userId, binding.ownerHandle.userId)
      )
    )
    .orderBy(desc(ctx.sql.tables.apps.releaseSeq))
    .limit(1)
    .then((r) => r[0]);
  const { filtered: priorMeta, warning: metaWarning } = parseArrayWarning(priorRow?.meta ?? [], MetaItem);
  if (metaWarning.length > 0) {
    ensureLogger(ctx.sthis, "ensureApps").Warn().Any({ parseErrors: metaWarning }).Msg("skip");
  }
  const carriedMeta: MetaItem[] = priorMeta.filter(isCrossReleaseMetaItem);

  // Allocate releaseSeq atomically. `maxSeq` above is only the soft max-apps
  // limit signal — the actual seq is computed inside the INSERT (COALESCE(MAX+1)
  // under a per-(user,app) advisory lock on pg) so the two concurrent writers a
  // single `generate` produces (server dev-publish + CLI production-push) can't
  // both land releaseSeq=1 and collide on the PK. See app-seq-allocation.ts (#2612).
  const rIns = await exception2Result(() =>
    allocateAndInsertApp({
      db: ctx.sql.db,
      flavour: ctx.sql.flavour,
      row: {
        appSlug: binding.appSlug.appSlug,
        userId: binding.ownerHandle.userId,
        ownerHandle: binding.ownerHandle.ownerHandle,
        fsId,
        runId: opts.runId,
        env: opts.env,
        fileSystem: rFileSystems.map((item) => item.Ok()),
        meta: carriedMeta,
        mode: opts.mode,
        created: new Date().toISOString(),
      },
    })
  );
  if (rIns.isErr()) {
    // Surface the full driver cause-chain (SQLSTATE + constraint) instead of the
    // opaque drizzle "Failed query: insert into Apps ..." wrapper (#2612).
    return Result.Err(`ensureApps: failed to allocate Apps release: ${formatDbErrorChain(rIns.Err())}`);
  }

  if (opts.runId !== undefined) {
    // The locked allocation guarantees exactly one row for this run. Read it
    // back so the response reflects the *effective* release: after a same-run
    // reconcile (or a late dev publish that no-ops against a finalized
    // production row) the persisted fsId/mode/files may differ from what this
    // call computed.
    const canonical = await ctx.sql.db
      .select()
      .from(ctx.sql.tables.apps)
      .where(
        and(
          eq(ctx.sql.tables.apps.appSlug, binding.appSlug.appSlug),
          eq(ctx.sql.tables.apps.ownerHandle, binding.ownerHandle.ownerHandle),
          eq(ctx.sql.tables.apps.userId, binding.ownerHandle.userId),
          eq(ctx.sql.tables.apps.runId, opts.runId)
        )
      )
      .orderBy(desc(ctx.sql.tables.apps.releaseSeq))
      .limit(1)
      .then((r) => r[0]);
    const effectiveFsId = canonical?.fsId ?? fsId;
    // Re-point this run's PromptContexts at the effective fsId. The dev publish
    // earlier in this operation stored its (possibly now-replaced) fsId, and
    // `loadVersionTimeline` resolves history by joining PromptContexts.fsId ->
    // Apps.fsId; without this the generated turn orphans and follow-up edits
    // seed from an empty buffer (#2616). Scoped to this run via promptId == runId.
    await ctx.sql.db
      .update(ctx.sql.tables.promptContexts)
      .set({ fsId: effectiveFsId })
      .where(
        and(
          eq(ctx.sql.tables.promptContexts.userId, binding.ownerHandle.userId),
          eq(ctx.sql.tables.promptContexts.promptId, opts.runId),
          ne(ctx.sql.tables.promptContexts.fsId, effectiveFsId)
        )
      );
    return Result.Ok({
      type: "vibes.diy.res-ensure-app-slug",
      appSlug: binding.appSlug.appSlug,
      ownerHandle: binding.ownerHandle.ownerHandle,
      mode: (canonical?.mode ?? opts.mode) as "dev" | "production",
      fsId: effectiveFsId,
      env: (canonical?.env ?? opts.env) as Record<string, string>,
      fileSystem: (canonical?.fileSystem ?? rFileSystems.map((item) => item.Ok())) as FileSystemItem[],
      wrapperUrl: "string",
      entryPointUrl: "string",
    });
  }

  return Result.Ok({
    type: "vibes.diy.res-ensure-app-slug",
    appSlug: binding.appSlug.appSlug,
    ownerHandle: binding.ownerHandle.ownerHandle,
    mode: opts.mode,
    fsId,
    env: opts.env,
    fileSystem: rFileSystems.map((item) => item.Ok()),
    wrapperUrl: "string",
    entryPointUrl: "string",
  });
}
