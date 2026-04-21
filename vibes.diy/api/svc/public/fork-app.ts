import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  reqForkApp,
  ReqForkApp,
  ResForkApp,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  FileSystemItem,
  MetaItem,
  VibeFile,
  isResHasAccessInviteAccepted,
  isResHasAccessRequestApproved,
  isFetchOkResult,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, eq } from "drizzle-orm/sql/expressions";
import { max } from "drizzle-orm/sql";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth } from "../check-auth.js";
import {
  ensureAppSlug,
  ensureUserSlug,
  getDefaultUserSlug,
  persistDefaultUserSlug,
} from "../intern/ensure-slug-binding.js";
import { ensureAppSettings } from "./ensure-app-settings.js";
import { hasAccessInvite } from "./invite-flow.js";
import { hasAccessRequest } from "./request-flow.js";

async function streamToUint8(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

function langFromFilename(fileName: string): string {
  const ext = fileName.toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (ext === "jsx") return "jsx";
  if (ext === "tsx") return "tsx";
  if (ext === "ts") return "ts";
  if (ext === "js") return "js";
  if (ext === "css") return "css";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "json") return "json";
  return ext ?? "txt";
}

function isOriginalCodeItem(item: FileSystemItem): boolean {
  // Skip derived artifacts: compiled .js from jsx transform and generated import map.
  if (item.fileName.startsWith("/~~")) return false;
  if (item.transform?.type === "transformed") return false;
  if (item.transform?.type === "import-map") return false;
  return true;
}

const TEXTUAL_MIME_ALLOWLIST = new Set([
  "application/json",
  "application/javascript",
  "application/typescript",
  "application/xml",
  "application/importmap+json",
  "image/svg+xml",
]);

function isTextualMime(mimeType: string): boolean {
  return mimeType.startsWith("text/") || TEXTUAL_MIME_ALLOWLIST.has(mimeType);
}

function isCodeFromItem(item: FileSystemItem): boolean {
  // jsx-to-js marker is the only lossless signal that the source was a
  // VibeCodeBlock with a jsx-transformable lang (js/jsx).
  if (item.transform?.type === "jsx-to-js") return true;
  // ts/tsx aren't transformed today but are still code-shaped source we want to
  // round-trip as code-block so the chat editor treats them as editable code.
  const ext = item.fileName.toLowerCase().match(/\.([^.]+)$/)?.[1];
  return ext === "ts" || ext === "tsx";
}

// Exported for direct unit testing — the end-to-end path is covered separately.
export async function reconstructSourceFiles(
  vctx: VibesApiSQLCtx,
  fileSystem: FileSystemItem[]
): Promise<Result<VibeFile[]>> {
  const originals = fileSystem.filter(isOriginalCodeItem);
  const results = await Promise.all(
    originals.map(async (item): Promise<Result<VibeFile>> => {
      const rFetch = await vctx.storage.fetch(item.assetURI);
      if (!isFetchOkResult(rFetch)) {
        return Result.Err(`fork-fetch-failed: ${item.fileName} (${item.assetURI})`);
      }
      const bytes = await streamToUint8(rFetch.data);
      let file: VibeFile;
      if (isCodeFromItem(item)) {
        file = {
          type: "code-block",
          lang: langFromFilename(item.fileName),
          filename: item.fileName,
          content: new TextDecoder().decode(bytes),
          mimetype: item.mimeType,
        };
      } else if (isTextualMime(item.mimeType)) {
        file = {
          type: "str-asset-block",
          filename: item.fileName,
          content: new TextDecoder().decode(bytes),
          mimetype: item.mimeType,
        };
      } else {
        file = {
          type: "uint8-asset-block",
          filename: item.fileName,
          content: bytes,
          mimetype: item.mimeType,
        };
      }
      if (item.entryPoint) (file as VibeFile & { entryPoint?: boolean }).entryPoint = true;
      return Result.Ok(file);
    })
  );
  const firstErr = results.find((r) => r.isErr());
  if (firstErr) return Result.Err(firstErr.Err().message);
  return Result.Ok(results.map((r) => r.Ok()));
}

export async function forkApp(
  vctx: VibesApiSQLCtx,
  req: ReqForkApp,
  userId: string,
  claims: ReqWithVerifiedAuth<ReqForkApp>["_auth"]["verifiedAuth"]["claims"]
): Promise<Result<ResForkApp>> {
  // 1. Locate the source app row. Mirrors get-app-by-fsid.ts selection.
  let src: typeof vctx.sql.tables.apps.$inferSelect | undefined;
  if (req.srcFsId) {
    src = await vctx.sql.db
      .select()
      .from(vctx.sql.tables.apps)
      .where(
        and(
          eq(vctx.sql.tables.apps.fsId, req.srcFsId),
          eq(vctx.sql.tables.apps.appSlug, req.srcAppSlug),
          eq(vctx.sql.tables.apps.userSlug, req.srcUserSlug)
        )
      )
      .limit(1)
      .then((r) => r[0]);
  } else {
    const maxCreatedSub = vctx.sql.db
      .select({ mode: vctx.sql.tables.apps.mode, maxCreated: max(vctx.sql.tables.apps.created).as("max_created") })
      .from(vctx.sql.tables.apps)
      .where(and(eq(vctx.sql.tables.apps.userSlug, req.srcUserSlug), eq(vctx.sql.tables.apps.appSlug, req.srcAppSlug)))
      .groupBy(vctx.sql.tables.apps.mode)
      .as("mc");
    const rows = await vctx.sql.db
      .select({
        appSlug: vctx.sql.tables.apps.appSlug,
        userId: vctx.sql.tables.apps.userId,
        userSlug: vctx.sql.tables.apps.userSlug,
        releaseSeq: vctx.sql.tables.apps.releaseSeq,
        fsId: vctx.sql.tables.apps.fsId,
        env: vctx.sql.tables.apps.env,
        fileSystem: vctx.sql.tables.apps.fileSystem,
        meta: vctx.sql.tables.apps.meta,
        mode: vctx.sql.tables.apps.mode,
        created: vctx.sql.tables.apps.created,
      })
      .from(vctx.sql.tables.apps)
      .innerJoin(
        maxCreatedSub,
        and(
          eq(vctx.sql.tables.apps.mode, maxCreatedSub.mode),
          eq(vctx.sql.tables.apps.created, maxCreatedSub.maxCreated),
          eq(vctx.sql.tables.apps.userSlug, req.srcUserSlug),
          eq(vctx.sql.tables.apps.appSlug, req.srcAppSlug)
        )
      )
      .orderBy(vctx.sql.tables.apps.mode);
    src = rows[rows.length - 1];
  }
  if (!src) {
    return Result.Err("app-not-found");
  }

  // 2. Grant check mirrors /vibe view rules: allow owner, public-access,
  //    invite-accepted, or request-approved.
  const isOwner = userId === src.userId;
  if (!isOwner) {
    const rAppSet = await ensureAppSettings(vctx, {
      type: "vibes.diy.req-ensure-app-settings",
      appSlug: src.appSlug,
      userSlug: src.userSlug,
    });
    if (rAppSet.isErr()) return Result.Err("app-settings-not-found");
    const settings = rAppSet.Ok().settings;
    const isPublic = settings.entry.publicAccess?.enable && src.mode === "production";
    let granted = isPublic;
    if (!granted) {
      const rInvite = await hasAccessInvite(vctx, { appSlug: src.appSlug, userSlug: src.userSlug, grantUserId: userId });
      if (rInvite.isOk() && isResHasAccessInviteAccepted(rInvite.Ok())) granted = true;
    }
    if (!granted) {
      const rReq = await hasAccessRequest(vctx, { appSlug: src.appSlug, userSlug: src.userSlug, foreignUserId: userId });
      if (rReq.isOk() && isResHasAccessRequestApproved(rReq.Ok())) granted = true;
    }
    if (!granted) return Result.Err("not-grant");
  }

  // 3. Reconstruct source VibeFile[] from the Apps row's storage refs.
  //    This lets the client replay the code via the same promptFS path that
  //    manual editor saves use, writing a fresh chat section + Apps row.
  //    Fail the whole fork if any asset fetch fails — a partial file set would
  //    seed a broken Apps row downstream.
  const rFiles = await reconstructSourceFiles(vctx, src.fileSystem as FileSystemItem[]);
  if (rFiles.isErr()) return Result.Err(rFiles.Err().message);
  const sourceFiles = rFiles.Ok();
  if (sourceFiles.length === 0) {
    return Result.Err("fork-no-source-files");
  }

  // 4. Resolve caller's default userSlug; mirror ensureChatId.
  let destUserSlug: string;
  const rDefault = await getDefaultUserSlug(vctx, userId);
  if (rDefault.isErr()) return Result.Err(`Failed to get default userSlug: ${rDefault.Err().message}`);
  const defaultBinding = rDefault.Ok();
  if (defaultBinding) {
    destUserSlug = defaultBinding.userSlug;
  } else {
    const rNew = await ensureUserSlug(vctx, claims, { userId });
    if (rNew.isErr()) return Result.Err(`Failed to ensure userSlug: ${rNew.Err().message}`);
    destUserSlug = rNew.Ok().userSlug;
    await persistDefaultUserSlug(vctx, userId, destUserSlug);
  }

  // 5. Allocate a fresh appSlug under the caller. Seed preferredPairs with
  //    `${srcAppSlug}-remix` using the source title when available.
  const titleMeta = (src.meta as MetaItem[] | undefined)?.find((m) => m.type === "title") as { title?: string } | undefined;
  const sourceTitle = titleMeta?.title ?? req.srcAppSlug;
  const rApp = await ensureAppSlug(vctx, {
    userId,
    userSlug: destUserSlug,
    preferredPairs: [{ title: sourceTitle, slug: `${req.srcAppSlug}-remix` }],
  });
  if (rApp.isErr()) return Result.Err(`Failed to ensure appSlug: ${rApp.Err().message}`);
  const destAppSlug = rApp.Ok().appSlug;

  // 6. Create the chat-context row so the client's openChat finds this pair.
  const chatId = vctx.sthis.nextId(12).str;
  const rChat = await exception2Result(() =>
    vctx.sql.db.insert(vctx.sql.tables.chatContexts).values({
      chatId,
      userId,
      appSlug: destAppSlug,
      userSlug: destUserSlug,
      created: new Date().toISOString(),
    })
  );
  if (rChat.isErr()) return Result.Err(`Failed to create chatContext: ${rChat.Err().message}`);

  return Result.Ok({
    type: "vibes.diy.res-fork-app",
    userSlug: destUserSlug,
    appSlug: destAppSlug,
    chatId,
    remixOf: `${req.srcUserSlug}/${req.srcAppSlug}`,
    sourceFiles,
  } satisfies ResForkApp);
}

export const forkAppEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqForkApp>, ResForkApp | VibesDiyError> = {
  hash: "fork-app",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    const ret = reqForkApp(msg.payload);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqForkApp>>, ResForkApp | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rRes = await forkApp(vctx, req as unknown as ReqForkApp, req._auth.verifiedAuth.claims.userId, req._auth.verifiedAuth.claims);
      if (rRes.isErr()) {
        return Result.Err(rRes);
      }
      await ctx.send.send(ctx, rRes.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
