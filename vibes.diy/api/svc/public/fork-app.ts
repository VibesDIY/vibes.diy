import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult, exception2Result } from "@adviser/cement";
import {
  MsgBase,
  reqForkApp,
  ReqForkApp,
  ResForkApp,
  ReqWithVerifiedAuth,
  VibesDiyError,
  W3CWebSocketEvent,
  MetaItem,
  FileSystemItem,
  PromptAndBlockMsgs,
  isResHasAccessInviteAccepted,
  isResHasAccessRequestApproved,
  isFetchOkResult,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { and, eq, like } from "drizzle-orm/sql/expressions";
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

// Pad a remix index so the suffix always carries a leading '0': `01..09`,
// `010..099`, `0100..0999`, `01000..09999`, ...
function padRemixIndex(n: number): string {
  return "0" + String(n);
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Build the n-th remix candidate for a source appSlug. Preference order
// within the 32-byte RFC2822 budget:
//   1. `${srcAppSlug}-remix`              (n === 0)
//   2. `${srcAppSlug}-remix-${pad(n)}`    (n >= 1, if it fits)
//   3. `${srcAppSlug}-${pad(n)}`          (fallback for long source slugs;
//                                          drops the redundant `-remix`
//                                          word rather than truncating it
//                                          to a stub like `-r`)
// Returns undefined if no candidate fits (source slug itself >= 32 bytes
// with no room for a one-char suffix).
function buildRemixCandidate(srcAppSlug: string, n: number): string | undefined {
  const src = sanitizeSlug(srcAppSlug);
  const suffix = n === 0 ? "" : `-${padRemixIndex(n)}`;
  const withRemix = sanitizeSlug(`${src}-remix${suffix}`);
  if (withRemix.length <= 32) return withRemix;
  if (n === 0) return undefined; // no way to fit just `-remix` — skip; caller tries n>=1
  const bare = sanitizeSlug(`${src}${suffix}`);
  if (bare.length <= 32 && bare !== src) return bare;
  return undefined;
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

  // 3. Resolve caller's default userSlug; mirror ensureChatId.
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

  // 4. Allocate a fresh appSlug under the caller. Try `${srcAppSlug}-remix`
  //    first, then `-remix-01`..`-99`, `-0100`..`-0999`, `-01000`.. etc. A
  //    single `LIKE` prequery finds taken candidates so we pick the first
  //    free deterministically; a handful of next candidates are passed
  //    through to ensureAppSlug to absorb any race on the uniqueness check.
  const srcMeta = (src.meta as MetaItem[] | undefined) ?? [];
  const titleMeta = srcMeta.find((m): m is Extract<MetaItem, { type: "title" }> => m.type === "title");
  const sourceTitle = titleMeta?.title ?? req.srcAppSlug;
  // Prequery: any appSlug that begins with the sanitized source covers
  // both `${src}-remix*` and the `${src}-${pad}` fallback form.
  const srcSanitized = sanitizeSlug(req.srcAppSlug);
  const taken = await vctx.sql.db
    .select({ appSlug: vctx.sql.tables.appSlugBinding.appSlug })
    .from(vctx.sql.tables.appSlugBinding)
    .where(like(vctx.sql.tables.appSlugBinding.appSlug, `${srcSanitized}%`));
  const takenSet = new Set(taken.map((r) => r.appSlug));
  const candidates: string[] = [];
  for (let n = 0; candidates.length < 5 && n < 100_000; n++) {
    const cand = buildRemixCandidate(req.srcAppSlug, n);
    if (!cand) continue;
    if (takenSet.has(cand)) continue;
    if (!candidates.includes(cand)) candidates.push(cand);
  }
  if (candidates.length === 0) return Result.Err("fork-slug-exhausted");
  const rApp = await ensureAppSlug(vctx, {
    userId,
    userSlug: destUserSlug,
    preferredPairs: candidates.map((slug) => ({ title: sourceTitle, slug })),
  });
  if (rApp.isErr()) return Result.Err(`Failed to ensure appSlug: ${rApp.Err().message}`);
  const destAppSlug = rApp.Ok().appSlug;

  // 5. Insert a new Apps row that shares the source's fileSystem/env refs.
  //    Storage is content-addressed so the new owner points at the same
  //    underlying assets with no copy. The `remix-of` meta entry carries
  //    srcFsId as the immutable anchor; display slugs are resolved live on
  //    read so renames of srcUserSlug/srcAppSlug are followed automatically.
  //    Only the direct parent is stored — full lineage is reconstructed by
  //    walking srcFsId pointers across Apps rows. Screenshot carries over as
  //    a placeholder until the fork generates its own.
  const destMeta: MetaItem[] = [
    ...srcMeta.filter((m) => m.type !== "remix-of"),
    { type: "remix-of", srcFsId: src.fsId },
  ];
  const rIns = await exception2Result(() =>
    vctx.sql.db.insert(vctx.sql.tables.apps).values({
      appSlug: destAppSlug,
      userId,
      userSlug: destUserSlug,
      releaseSeq: 1,
      fsId: src.fsId,
      env: src.env,
      fileSystem: src.fileSystem,
      meta: destMeta,
      mode: "dev",
      created: new Date().toISOString(),
    })
  );
  if (rIns.isErr()) return Result.Err(`Failed to insert forked app: ${rIns.Err().message}`);

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

  // 7. Seed a ChatSection that mirrors the structure of a real prompt turn:
  //    a synthetic user message + the source /App.jsx rendered as an
  //    assistant code block, block.end pinning fsRef to srcFsId. The chat
  //    editor's sectionStream then hydrates the editor normally, and the
  //    next LLM prompt sees the current code via reconstructConversationMessages.
  const fsItems = src.fileSystem as FileSystemItem[];
  const srcEntry =
    fsItems.find((f) => f.entryPoint && f.fileName === "/App.jsx") ?? fsItems.find((f) => f.fileName === "/App.jsx");
  if (srcEntry) {
    const rFetch = await vctx.storage.fetch(srcEntry.assetURI);
    if (!isFetchOkResult(rFetch)) {
      return Result.Err(`fork-fetch-app-jsx: ${srcEntry.fileName} (${srcEntry.assetURI})`);
    }
    const content = await new Response(rFetch.data as unknown as BodyInit).text();
    const lines = content.split("\n");
    const promptId = vctx.sthis.nextId(12).str;
    const blockId = vctx.sthis.nextId(12).str;
    const streamId = blockId;
    const sectionId = promptId;
    const now = new Date();
    const baseBlock = { blockId, streamId, blockNr: 0, timestamp: now };
    const userText = `Remix of ${src.userSlug}/${src.appSlug}`;
    // Order matters: promptReducer only opens a PromptBlock on
    // prompt.block-begin, so prompt.req MUST come after it or the chat
    // renderer falls back to "User edited code" instead of showing the
    // remix message.
    const blocks: PromptAndBlockMsgs[] = [
      { type: "prompt.block-begin", chatId, streamId, seq: 0, timestamp: now },
      {
        type: "prompt.req",
        request: { messages: [{ role: "user", content: [{ type: "text", text: userText }] }] },
        chatId,
        streamId,
        seq: 1,
        timestamp: now,
      },
      { type: "block.begin", ...baseBlock, seq: 2 },
      { type: "block.code.begin", sectionId, lang: "jsx", ...baseBlock, seq: 3 },
      ...lines.map((line, i) => ({
        type: "block.code.line" as const,
        sectionId,
        lang: "jsx",
        line,
        lineNr: i + 1,
        ...baseBlock,
        seq: 4 + i,
      })),
      {
        type: "block.code.end",
        sectionId,
        lang: "jsx",
        stats: { lines: lines.length, bytes: content.length },
        ...baseBlock,
        seq: 4 + lines.length,
      },
      {
        type: "block.end",
        stats: {
          toplevel: { lines: 0, bytes: 0 },
          code: { lines: lines.length, bytes: content.length },
          image: { lines: 0, bytes: 0 },
          total: { lines: lines.length, bytes: content.length },
        },
        usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
        fsRef: { appSlug: destAppSlug, userSlug: destUserSlug, mode: "dev", fsId: src.fsId },
        ...baseBlock,
        seq: 5 + lines.length,
      },
      { type: "prompt.block-end", chatId, streamId, seq: 6 + lines.length, timestamp: now },
    ];
    const rSection = await exception2Result(() =>
      vctx.sql.db.insert(vctx.sql.tables.chatSections).values({
        chatId,
        promptId,
        blockSeq: 0,
        blocks,
        created: now.toISOString(),
      })
    );
    if (rSection.isErr()) return Result.Err(`Failed to seed chatSection: ${rSection.Err().message}`);
  }

  return Result.Ok({
    type: "vibes.diy.res-fork-app",
    userSlug: destUserSlug,
    appSlug: destAppSlug,
    chatId,
    srcFsId: src.fsId,
    srcUserSlug: src.userSlug,
    srcAppSlug: src.appSlug,
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
