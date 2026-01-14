import {
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  VibeFile,
} from "vibes-diy-api-pkg";
import {
  exception2Result,
  Result,
  to_uint8,
  toSortedObject,
} from "@adviser/cement";
import { StorageResult, VibesApiSQLCtx } from "../api.js";
import { AppSlugBinding } from "./ensure-slug-binding.js";
import { ReqWithVerifiedAuth } from "../check-auth.js";
import { sqlApps } from "../sql/assets-fs.js";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { and, eq, or } from "drizzle-orm";
import { FileSystemItem } from "../types.js";
import mime from "mime";
import { transform } from "sucrase";
import { calcCid } from "./ensure-storage.ts";
import {
  ExportAllDeclaration,
  ExportNamedDeclaration,
  ImportDeclaration,
  parse,
} from "acorn";
import { importMap } from "./import-map.ts";

async function checkMaxAppsPerUser(
  ctx: VibesApiSQLCtx,
  userId: string,
  appSlug: string,
): Promise<Result<number>> {
  const userApps = await ctx.db
    .select()
    .from(sqlApps)
    .where(eq(sqlApps.userId, userId))
    .orderBy(sqlApps.created)
    .all();
  if (userApps.length >= ctx.params.maxAppSlugPerUserId) {
    const devApps = userApps
      .filter((app) => app.mode === "dev")
      .slice(0, ~~(userApps.length / 10) + 1);
    if (devApps.length === 0) {
      return Result.Err(
        `user has reached max apps limit: ${ctx.params.maxAppSlugPerUserId}`,
      );
    }
    await ctx.db
      .delete(sqlApps)
      .where(
        or(
          ...devApps.map((app) =>
            and(
              eq(sqlApps.userId, userId),
              eq(sqlApps.releaseSeq, app.releaseSeq),
              eq(sqlApps.appSlug, app.appSlug),
            ),
          ),
        ),
      );
  }
  return Result.Ok(
    userApps
      .filter((app) => app.appSlug === appSlug)
      .reduce((max, app) => Math.max(app.releaseSeq, max), 0),
  );
}

async function computeFsId(
  env: Record<string, string>,
  fs: { vibeFileItem: VibeFile; storage: StorageResult }[],
): Promise<string> {
  // Better don't change this code it's used to generate a stable fsId
  const fsIdStr = [
    fs
      .sort((a, b) =>
        a.vibeFileItem.filename.localeCompare(b.vibeFileItem.filename),
      )
      .map((fs) => [
        fs.vibeFileItem.filename,
        fs.vibeFileItem.mimetype,
        fs.storage.cid,
      ]),
    JSON.stringify(toSortedObject(env ?? {})),
  ]
    .flat()
    .join("|");
  const uint8Content = to_uint8(fsIdStr);
  const hash = await sha256.digest(uint8Content);
  const fsId = base58btc.encode(hash.digest);
  return fsId.toLocaleLowerCase(); // this feels stupid but DNS is case insensitive
  // we increase chance of collision by 2^35 or the significant bits are 256 - 35 = 221 bits
  // for this use case this is acceptable
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
      (
        n,
      ): n is
        | ImportDeclaration
        | ExportNamedDeclaration
        | ExportAllDeclaration =>
        n.type === "ImportDeclaration" ||
        (n.type === "ExportNamedDeclaration" && n.source !== null) ||
        n.type === "ExportAllDeclaration",
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
): Promise<
  {
    vibeFileItem: VibeFile;
    prepareStorage?: Awaited<ReturnType<typeof calcCid>>;
    fsItem: FileSystemItem;
  }[]
> {
  const acc: {
    vibeFileItem: VibeFile;
    prepareStorage?: Awaited<ReturnType<typeof calcCid>>;
    fsItem: FileSystemItem;
  }[] = [];
  for (const item of givenFsItems) {
    if (
      item.fsItem.transform?.type === "jsx-to-js" &&
      item.vibeFileItem.type == "code-block"
    ) {
      const jsStr = transformJSXToJS(item.vibeFileItem.content);
      const dataCid = await calcCid(ctx, jsStr);
      // reference original item to set transformedAssetId
      acc.push({
        ...item,
        fsItem: {
          ...item.fsItem,
          transform: { type: "jsx-to-js", transformedAssetId: dataCid.cid },
        },
      });
      // new entry for import calculation
      acc.push({
        ...item,
        fsItem: {
          fileName: `@@transformed@@/${item.fsItem.assetId}`,
          mimeType: "application/javascript",
          assetId: dataCid.cid,
          assetURI: `unk://${dataCid.cid}`,
          transform: {
            type: "transformed",
            action: "jsx-to-js",
            transformedAssetId: item.fsItem.assetId,
          },
          size: jsStr.length,
        },
        prepareStorage: dataCid,
      });
    } else {
      acc.push(item);
    }
  }
  return acc;
}

async function createImportMap(
  ctx: VibesApiSQLCtx,
  transformed: {
    vibeFileItem: VibeFile;
    prepareStorage?: Awaited<ReturnType<typeof calcCid>>;
    fsItem: FileSystemItem;
  }[],
): Promise<
  {
    vibeFileItem: VibeFile;
    prepareStorage?: Awaited<ReturnType<typeof calcCid>>;
    fsItem: FileSystemItem;
  }[]
> {
  const importFiles = transformed.reduce(
    (acc, item) => {
      let res: string[];
      if (
        item.vibeFileItem.type == "code-block" &&
        item.vibeFileItem.lang === "js"
      ) {
        res = importsFromJS(item.vibeFileItem.content);
      } else if (
        item.prepareStorage &&
        item.fsItem.transform?.type === "transformed" &&
        item.fsItem.transform.action === "jsx-to-js"
      ) {
        res = importsFromJS(item.prepareStorage.dataStr());
        // console.log("imports from", item.vibeFileItem.filename, res)
        if (res.length > 0) {
          res.forEach((imp) => acc.imports.add(imp));
          acc.files.push(item.vibeFileItem.filename);
        }
      }
      return acc;
    },
    { imports: new Set<string>(), files: [] as string[] },
  );
  if (importFiles.imports.size >= 0) {
    const imap = await importMap(
      Array.from(importFiles.imports),
      ctx.params.importMapProps,
      ctx.fetch,
    );
    const imapStr = JSON.stringify({ imports: imap });
    const dataCid = await calcCid(ctx, imapStr);
    return [
      {
        vibeFileItem: {
          type: "str-asset-block" as const,
          filename: `@@calculated@@/import-map.json`,
          mimetype: "application/importmap+json",

          content: imapStr,
        },
        prepareStorage: dataCid,
        fsItem: {
          fileName: `@@calculated@@/import-map.json`,
          mimeType: "application/importmap+json",
          assetId: dataCid.cid,
          assetURI: `unk://${dataCid.cid}`,
          transform: {
            type: "import-map",
            fromAssetIds: importFiles.files,
          },
          size: imapStr.length,
        },
      },
    ];
  }
  return [];
}
async function toFileSystemItems(
  ctx: VibesApiSQLCtx,
  fs: { vibeFileItem: VibeFile; storage: StorageResult }[],
): Promise<Result<FileSystemItem[]>> {
  const givenFsItems = fs.map((f) => {
    const ret: FileSystemItem = {
      fileName: f.vibeFileItem.filename,
      assetId: f.storage.cid,
      mimeType:
        f.vibeFileItem.mimetype ??
        mime.getType(f.vibeFileItem.filename) ??
        "application/octet-stream",
      assetURI: f.storage.getURL,
      size: f.storage.size,
    };
    if (f.vibeFileItem.type === "code-block" && f.vibeFileItem.lang === "jsx") {
      ret.transform = {
        type: "jsx-to-js",
        transformedAssetId: "setAfterTransform",
      };
    }
    if (f.vibeFileItem.type === "code-block" && f.vibeFileItem.lang == "js") {
      ret.transform = {
        type: "imports",
        importMapAssetId: "setAfterTransform",
      };
    }
    if (f.vibeFileItem.entryPoint) {
      ret.entryPoint = true;
    }
    return { ...f, fsItem: ret };
  });

  // do transforms
  const transformed = await transformJSXAndImports(ctx, givenFsItems);
  transformed.push(...(await createImportMap(ctx, transformed)));

  const rStore = await ctx.ensureStorage(
    ...transformed
      .filter((item) => item.prepareStorage)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map((item) => item.prepareStorage!),
  );
  if (rStore.isErr()) {
    return Result.Err(rStore);
  }
  const storeMap = rStore.Ok().reduce((acc, item) => {
    acc.set(item.cid, item);
    return acc;
  }, new Map<string, StorageResult>());

  const assetUris = transformed.map((item) => {
    if (!item.prepareStorage) {
      return item;
    }
    const storeItem = storeMap.get(item.prepareStorage.cid);
    if (!storeItem) {
      throw new Error("internal error: storage result not found");
    }
    return {
      ...item,
      fsItem: {
        ...item.fsItem,
        assetURI: storeItem.getURL,
        size: storeItem.size,
      },
    };
  });
  return Result.Ok(assetUris.map((item) => item.fsItem));
}

export async function ensureApps(
  ctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureAppSlug>,
  binding: AppSlugBinding,
  fs: { vibeFileItem: VibeFile; storage: StorageResult }[],
): Promise<Result<Omit<ResEnsureAppSlug, "type">>> {
  const fsId = await computeFsId(req.env ?? {}, fs);
  const exist = await ctx.db
    .select()
    .from(sqlApps)
    .where(and(eq(sqlApps.fsId, fsId), eq(sqlApps.userId, binding.userId)))
    .get();
  if (exist) {
    if (req.mode === "production" && exist.mode === "dev") {
      // upgrade dev to production
      await ctx.db
        .update(sqlApps)
        .set({ mode: req.mode })
        .where(and(eq(sqlApps.userId, binding.userId), eq(sqlApps.fsId, fsId)));
    }
    const rFileSystem = await toFileSystemItems(ctx, fs);
    if (rFileSystem.isErr()) {
      return Result.Err(rFileSystem);
    }
    return Result.Ok({
      ...binding,
      mode: req.mode,
      fsId,
      env: req.env ?? {},
      fileSystem: rFileSystem.Ok(),
      wrapperUrl: "string",
      entryPointUrl: "string",
    });
  }

  // transaction start
  const rMaxSeq = await checkMaxAppsPerUser(
    ctx,
    req.auth.verifiedAuth.claims.sub,
    binding.appSlug,
  );
  if (rMaxSeq.isErr()) {
    return Result.Err(rMaxSeq);
  }
  const rFileSystem = await toFileSystemItems(ctx, fs);
  if (rFileSystem.isErr()) {
    return Result.Err(rFileSystem);
  }
  const sqlVal = {
    appSlug: binding.appSlug,
    userId: binding.userId,
    userSlug: binding.userSlug,
    releaseSeq: rMaxSeq.Ok() + 1,
    fsId,
    env: req.env ?? {},
    fileSystem: rFileSystem.Ok(),
    mode: req.mode,
    created: new Date().toISOString(),
  };
  // console.log("ensureApps sqlVal", sqlVal);
  // console.log("appSlug", await ctx.db.select().from(sqlAppSlugBinding).all());
  // console.log("userSlug", await ctx.db.select().from(sqlUserSlugBinding).all());
  const rIns = await exception2Result(() =>
    ctx.db.insert(sqlApps).values(sqlVal),
  );
  if (rIns.isErr()) {
    return Result.Err(rIns);
  }
  // console.log("ensureApps sqlVal", sqlVal);
  // .returning();
  // const appSlug = sqlAppToResEnsureAppSlug(sqlVal);

  return Result.Ok({
    ...binding,
    mode: req.mode,
    fsId,
    env: req.env ?? {},
    fileSystem: rFileSystem.Ok(),
    wrapperUrl: "string",
    entryPointUrl: "string",
  });
}
