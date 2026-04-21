import {
  ReqEnsureAppSlug,
  VibeFile,
  FileSystemItem,
  isVibeCodeBlock,
  VibeCodeBlock,
  ReqWithVerifiedAuth,
  StorageResult,
  ResEnsureAppSlug,
  ResEnsureAppSlugMaxAppsError,
  isResEnsureAppSlugMaxAppsError,
  MetaItem,
  isCrossReleaseMetaItem,
  parseArrayWarning,
} from "@vibes.diy/api-types";
import { exception2Result, Result, string2stream, to_uint8, toSortedObject } from "@adviser/cement";
import { ensureLogger } from "@fireproof/core-runtime";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { and, desc, eq } from "drizzle-orm/sql/expressions";
import mime from "mime";
import { transform } from "sucrase";
import { ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration, parse } from "acorn";
import { AppUserSlugBinding, VibesApiSQLCtx } from "../types.js";

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
      type: "vibes.diy.error",
      message: `User has reached the maximum number of app slugs (${ctx.params.maxAppSlugPerUserId}). Please delete existing apps before creating new ones.`,
      code: "max-app-slugs-reached",
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
        // console.log("do jsx transform for file:", item.fsItem.fileName);
        const rJsStr = exception2Result(() => transformJSXToJS((item.vibeFileItem as VibeCodeBlock).content));
        if (rJsStr.isErr()) {
          console.error(`Failed to transform JSX to JS for file ${item.vibeFileItem.filename}: ${rJsStr.Err()}`);
          return;
        }
        const jsStr = rJsStr.Ok();
        // const dataCid = await calcCid(ctx, jsStr);
        // reference original item to set transformedAssetId

        const rImports = importsFromJS(jsStr);
        rImports.forEach((imp) => {
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
        // console.log("do import extraction for file:", item);
        const rImports = exception2Result(() => importsFromJS((item.vibeFileItem as VibeCodeBlock).content));
        if (rImports.isErr()) {
          console.error(`Failed to extract imports from JS for file ${item.vibeFileItem.filename}: ${rImports.Err()}`);
          return;
        }
        rImports.Ok().forEach((imp) => {
          if (!imports.has(imp)) {
            imports.set(imp, []);
          }
          imports.get(imp)?.push(item.fsItem.assetId);
        });
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
    console.log("toFileSystemItems - processing file:", f.vibeFileItem.filename, (f.vibeFileItem as { lang: string }).lang);
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
    // console.log("toFileSystemItems - processing file:", f);
    if (isVibeCodeBlock(f.vibeFileItem) && ["js", "jsx", "javascript"].includes(f.vibeFileItem.lang)) {
      // console.log("marking for jsx transform for file:", f.vibeFileItem.filename);
      ret.transform = {
        type: "jsx-to-js",
        transformedAssetId: "setAfterTransform",
      };
    }
    // if (isVibeCodeBlock(f.vibeFileItem) && f.vibeFileItem.lang == "js") {
    //   // console.log("marking for import extraction for file:", f.vibeFileItem.filename);
    //   ret.transform = {
    //     type: "imports",
    //     importMapAssetId: "setAfterTransform",
    //   };
    // }
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

export async function ensureApps(
  ctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureAppSlug>,
  binding: AppUserSlugBinding,
  fs: { vibeFileItem: VibeFile; storage: StorageResult }[]
): Promise<Result<ResEnsureAppSlug>> {
  // console.log("0-ensureApps called with req:", req, "binding:", binding, "fs:", fs);
  const fsId = await computeFsId(req.env ?? {}, fs);
  const exist = await ctx.sql.db
    .select()
    .from(ctx.sql.tables.apps)
    .where(
      and(
        eq(ctx.sql.tables.apps.appSlug, binding.appSlug.appSlug),
        eq(ctx.sql.tables.apps.userSlug, binding.userSlug.userSlug),
        eq(ctx.sql.tables.apps.fsId, fsId),
        eq(ctx.sql.tables.apps.userId, binding.userSlug.userId)
      )
    )
    .limit(1)
    .then((r) => r[0]);
  if (exist) {
    // console.log("1-ensureApps called with req:", req, "binding:", binding, "fs:", fs);
    if (req.mode === "production" && exist.mode === "dev") {
      // upgrade dev to production
      await ctx.sql.db
        .update(ctx.sql.tables.apps)
        .set({ mode: req.mode })
        .where(
          and(
            eq(ctx.sql.tables.apps.userId, binding.userSlug.userId),
            eq(ctx.sql.tables.apps.fsId, fsId),
            eq(ctx.sql.tables.apps.appSlug, binding.appSlug.appSlug),
            eq(ctx.sql.tables.apps.userSlug, binding.userSlug.userSlug)
          )
        );
    }
    const rFileSystems = await toFileSystemItems(ctx, req.mode, fs);
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
      userSlug: binding.userSlug.userSlug,
      appSlug: binding.appSlug.appSlug,
      mode: req.mode,
      fsId,
      env: req.env ?? {},
      fileSystem: rFileSystems.map((item) => item.Ok()),
      // wrapperUrl: "string",
      // entryPointUrl: "string",
    });
  }

  // console.log("2-ensureApps called with req:", req, "binding:", binding, "fs:", fs);
  // transaction start
  const rMaxSeq = await checkMaxAppsPerUser(ctx, req._auth.verifiedAuth.claims.userId, binding.appSlug.appSlug);
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
  const rFileSystems = await toFileSystemItems(ctx, req.mode, fs);
  if (rFileSystems.some((item) => item.isErr())) {
    return Result.Err(
      `Failed to process file system items: ${rFileSystems
        .filter((item) => item.isErr())
        .map((item) => item.Err().message)
        .join(", ")}`
    );
  }
  // Carry forward cross-release meta (title, remix-of) from the prior
  // release at this (appSlug, userSlug, userId). fsId-bound entries like
  // screen-shot-ref are excluded by the allow-list and get regenerated per
  // release by the screenshot queue.
  const priorRow = await ctx.sql.db
    .select({ meta: ctx.sql.tables.apps.meta })
    .from(ctx.sql.tables.apps)
    .where(
      and(
        eq(ctx.sql.tables.apps.appSlug, binding.appSlug.appSlug),
        eq(ctx.sql.tables.apps.userSlug, binding.userSlug.userSlug),
        eq(ctx.sql.tables.apps.userId, binding.userSlug.userId)
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

  const sqlVal = {
    appSlug: binding.appSlug.appSlug,
    userId: binding.userSlug.userId,
    userSlug: binding.userSlug.userSlug,
    releaseSeq: maxSeq + 1,
    fsId,
    env: req.env ?? {},
    fileSystem: rFileSystems.map((item) => item.Ok()),
    meta: carriedMeta,
    mode: req.mode,
    created: new Date().toISOString(),
  };
  const rIns = await exception2Result(() => ctx.sql.db.insert(ctx.sql.tables.apps).values(sqlVal));
  // console.log("Inserted app record into database with values:", sqlVal);
  if (rIns.isErr()) {
    return Result.Err(rIns);
  }
  return Result.Ok({
    type: "vibes.diy.res-ensure-app-slug",
    appSlug: binding.appSlug.appSlug,
    userSlug: binding.userSlug.userSlug,
    mode: req.mode,
    fsId,
    env: req.env ?? {},
    fileSystem: rFileSystems.map((item) => item.Ok()),
    wrapperUrl: "string",
    entryPointUrl: "string",
  });
}
