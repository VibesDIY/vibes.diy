import {
  env,
  ReqEnsureAppSlug,
  ResEnsureAppSlug,
  VibeFile,
} from "vibes-diy-api-pkg";
import { exception2Result, Result, to_uint8 } from "@adviser/cement";
import { StorageResult, VibesApiSQLCtx } from "../api.js";
import { AppSlugBinding } from "./ensure-slug-binding.js";
import { ReqWithVerifiedAuth } from "../check-auth.js";
import { sqlApps, sqlAppSlugBinding, sqlUserSlugBinding } from "../sql/assets-fs.js";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "multiformats/hashes/sha2";
import { and, eq, or } from "drizzle-orm";
import { FileSystemItem, fileSystemItem } from "../types.js";
import { type } from "arktype";
import mime from "mime";

async function checkMaxAppsPerUser(
  ctx: VibesApiSQLCtx,
  userId: string,
  appSlug: string
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
        `user has reached max apps limit: ${ctx.params.maxAppSlugPerUserId}`
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
              eq(sqlApps.appSlug, app.appSlug)
            )
          )
        )
      );
  }
  return Result.Ok(
    userApps
      .filter((app) => app.appSlug === appSlug)
      .reduce((max, app) => Math.max(app.releaseSeq, max), 0)
  );
}

function sqlAppToResEnsureAppSlug(
  app: typeof sqlApps.$inferSelect
): Result<
  Pick<ResEnsureAppSlug, "appSlug" | "userSlug" | "env" | "fileSystem">
> {
  return exception2Result(() => {
    const fileSystem: FileSystemItem[] = JSON.parse(
      app.fileSystem as string
    ).map((item: unknown) => {
      const res = fileSystemItem(item);
      if (res instanceof type.errors) {
        throw new Error(
          `invalid file system item in app fs: ${JSON.stringify(item)}`
        );
      }
      return res;
    });
    const e = env(JSON.parse(app.env as string));
    if (e instanceof type.errors) {
      throw new Error(`invalid env in app env: ${JSON.stringify(app.env)}`);
    }
    return {
      appSlug: app.appSlug,
      userSlug: app.userSlug,
      env: e,
      fileSystem: fileSystem,
    };
  });
}

export async function ensureApps(
  ctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureAppSlug>,
  binding: AppSlugBinding,
  fs: { fsItem: VibeFile; storage: StorageResult }[]
): Promise<Result<Omit<ResEnsureAppSlug, "type">>> {
  const fsIdStr = fs
    .sort((a, b) => a.fsItem.filename.localeCompare(b.fsItem.filename))
    .map((fs) => [fs.fsItem.filename, fs.fsItem.mimetype, fs.storage.cid])
    .join("|");
  const uint8Content = to_uint8(fsIdStr);
  const hash = await sha256.digest(uint8Content);
  const fsId = base58btc.encode(hash.digest);

  const exist = await ctx.db
    .select()
    .from(sqlApps)
    .where(and(eq(sqlApps.fsId, fsId), eq(sqlApps.userId, binding.userId)))
    .get();
  if (exist) {
    const sqlAppSlug = sqlAppToResEnsureAppSlug(exist);
    if (sqlAppSlug.isErr()) {
      return Result.Err(sqlAppSlug.Err());
    }
    if (req.mode === "production" && exist.mode === "dev") {
      // upgrade dev to production
      await ctx.db
        .update(sqlApps)
        .set({ mode: req.mode })
        .where(and(eq(sqlApps.userId, binding.userId), eq(sqlApps.fsId, fsId)));
    }
    return Result.Ok({
      ...sqlAppSlug.Ok(),
      mode: req.mode,
      fsId,
      fileSystem: sqlAppSlug.Ok().fileSystem,
      wrapperUrl: "string",
      entryPointUrl: "string",
    });
  }

  // transaction start
  const rMaxSeq = await checkMaxAppsPerUser(
    ctx,
    req.auth.verifiedAuth.claims.sub,
    binding.appSlug
  );
  if (rMaxSeq.isErr()) {
    return Result.Err(rMaxSeq);
  }
  const fileSystem: FileSystemItem[] = fs.map((f) => {
    const ret: FileSystemItem = {
      fileName: f.fsItem.filename,
      mimeType:
        f.fsItem.mimetype ??
        mime.getType(f.fsItem.filename) ??
        "application/octet-stream",
      assetURI: f.storage.getURL,
      size: f.storage.size,
    };
    if (f.fsItem.type === "code-block" && f.fsItem.lang === "jsx") {
      ret.transform = "jsx-to-js";
    }
    if (f.fsItem.entryPoint) {
      ret.entryPoint = true;
    }
    return ret;
  });
  const sqlVal = {
    appSlug: binding.appSlug,
    userId: binding.userId,
    userSlug: binding.userSlug,
    releaseSeq: rMaxSeq.Ok() + 1,
    fsId,
    env: req.env ?? {},
    fileSystem: fileSystem,
    mode: req.mode,
    created: new Date().toISOString(),
  };
  // console.log("ensureApps sqlVal", sqlVal);
  // console.log("appSlug", await ctx.db.select().from(sqlAppSlugBinding).all());
  // console.log("userSlug", await ctx.db.select().from(sqlUserSlugBinding).all());
  const rIns = await exception2Result(() => ctx.db.insert(sqlApps).values(sqlVal))
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
    fileSystem: fileSystem,
    wrapperUrl: "string",
    entryPointUrl: "string",
  });
}
