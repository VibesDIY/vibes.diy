import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  uint8array2stream,
  to_uint8,
  exception2Result,
} from "@adviser/cement";
import {
  EvtNewFsId,
  isResEnsureAppSlugError,
  isResEnsureAppSlugOk,
  MsgBase,
  ReqEnsureAppSlug,
  ReqWithVerifiedAuth,
  ResEnsureAppSlug,
  VibeFile,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase as unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth as checkAuth } from "../check-auth.js";
import { ensureSlugBinding } from "../intern/ensure-slug-binding.js";
import { ensureApps } from "../intern/write-apps.js";
import { calcEntryPointUrl } from "../entry-point-utils.js";

// ReqWithVerifiedAuth<ReqEnsureAppSlug>
export async function ensureAppSlugItem(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureAppSlug>
): Promise<Result<ResEnsureAppSlug>> {
  // console.log("handle ensureAppSlugItem", ctx.validated);

  const rAppSlugBinding = await ensureSlugBinding(vctx, {
    claims: req._auth.verifiedAuth.claims,
    userId: req._auth.verifiedAuth.claims.userId,
    appSlug: req.appSlug,
    userSlug: req.userSlug,
  });
  if (rAppSlugBinding.isErr()) {
    return Result.Err(rAppSlugBinding);
  }
  const writeAppSlugsOp: {
    fsItem: VibeFile;
    assetOp: {
      data: string | Uint8Array;
    };
  }[] = [];
  for (const fsItem of req.fileSystem) {
    // console.log(`ensureAppSlugItem fsItem:`, fsItem);
    switch (fsItem.type) {
      case "code-block":
      case "str-asset-block":
      case "uint8-asset-block":
        {
          writeAppSlugsOp.push({
            fsItem,
            assetOp: { data: fsItem.content },
          });
        }
        break;
      case "uint8-asset-ref":
      case "code-ref":
      case "str-asset-ref":
      default:
        // needs to rewind content from ref
        return Result.Err(`unsupported file system item type: ${fsItem.type}`);
    }
  }
  const rStorageResults = await vctx.storage.ensure(...writeAppSlugsOp.map((op) => uint8array2stream(to_uint8(op.assetOp.data))));
  if (rStorageResults.some((r) => r.isErr())) {
    return Result.Err(
      `failed to store one or more assets: ${rStorageResults.map((r) => (r.isErr() ? r.Err().message : "ok")).join(", ")}`
    );
  }
  const fullFileSystem = rStorageResults.map((op, idx) => ({
    vibeFileItem: writeAppSlugsOp[idx].fsItem,
    storage: op.Ok(),
  }));

  const rEnsure = await ensureApps(vctx, req, rAppSlugBinding.Ok(), fullFileSystem);
  if (rEnsure.isErr()) {
    return Result.Err(rEnsure);
  }
  if (isResEnsureAppSlugError(rEnsure.Ok())) {
    return Result.Ok(rEnsure.Ok());
  }
  const ensured = rEnsure.Ok();
  if (!isResEnsureAppSlugOk(ensured)) {
    return Result.Err(`Expected ensureApps to return ResEnsureAppSlugOk on success, got ${JSON.stringify(ensured)}`);
  }

  // let wrapperUrl: string;
  // if (req.mode === "production") {
  //   wrapperUrl = `${vctx.params.wrapperBaseUrl}/${res.Ok().userSlug}/${res.Ok().appSlug}/${res.Ok().fsId}`;
  // } else {
  //   wrapperUrl = `${vctx.params.wrapperBaseUrl}/${res.Ok().userSlug}/${res.Ok().appSlug}/${res.Ok().fsId}`;
  // }
  const entryPointUrl = calcEntryPointUrl({
    ...vctx.params.vibes.svc,
    bindings: {
      userSlug: ensured.userSlug,
      appSlug: ensured.appSlug,
      fsId: ensured.fsId,
    },
  });
  if (ensured.fsId) {
    // console.log(`Posting evt-new-fs-id for fsId ${ensured.fsId}, entryPointUrl: ${entryPointUrl}`);
    await vctx.postQueue({
      payload: {
        type: "vibes.diy.evt-new-fs-id",
        userSlug: ensured.userSlug,
        appSlug: ensured.appSlug,
        fsId: ensured.fsId,
        vibeUrl: entryPointUrl,
        sessionToken: "offline",
      },
      tid: "queue-event",
      src: "ensureAppSlugItem",
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtNewFsId>);
  }
  return Result.Ok({
    type: "vibes.diy.res-ensure-app-slug",
    appSlug: ensured.appSlug,
    userSlug: ensured.userSlug,
    // userId: req._auth.verifiedAuth.claims.userId,
    // promptId: req.promptId,
    // chatId: req.chatId,
    mode: req.mode,
    fsId: ensured.fsId,
    env: req.env ?? {},
    fileSystem: ensured.fileSystem,
    // wrapperUrl,
    entryPointUrl,
  });
}

export const ensureAppSlugItemEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqEnsureAppSlug>,
  ResEnsureAppSlug | VibesDiyError
> = {
  hash: "ensure-appSlug-item",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    // async (ctx): Promise<Result<Option<ReqEnsureAppSlug>>> => {
    const ret = ReqEnsureAppSlug(msg.payload);
    // console.log("validate ensureAppSlugItem", payload, ret);
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
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqEnsureAppSlug>>, ResEnsureAppSlug | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      const rAppSlugBinding = await ensureAppSlugItem(vctx, req);
      if (rAppSlugBinding.isErr()) {
        return Result.Err(rAppSlugBinding);
      }
      const res = rAppSlugBinding.Ok();

      // Create a ChatContext for CLI pushes so the app appears in DevBox
      if (isResEnsureAppSlugOk(res)) {
        const chatId = vctx.sthis.nextId(12).str;
        const promptId = vctx.sthis.nextId(12).str;
        const now = new Date().toISOString();
        const rChat = await exception2Result(async () => {
          await vctx.sql.db.insert(vctx.sql.tables.chatContexts).values({
            chatId,
            userId: req._auth.verifiedAuth.claims.userId,
            appSlug: res.appSlug,
            userSlug: res.userSlug,
            created: now,
          });
          await vctx.sql.db.insert(vctx.sql.tables.chatSections).values([
            {
              chatId,
              promptId,
              blockSeq: 0,
              blocks: [
                {
                  seq: 0,
                  type: "prompt.block-begin",
                  chatId,
                  streamId: promptId,
                  timestamp: now,
                },
              ],
              created: now,
            },
            {
              chatId,
              promptId,
              blockSeq: 1,
              blocks: [
                {
                  seq: 1,
                  type: "prompt.req",
                  chatId,
                  request: {
                    messages: [
                      {
                        role: "user",
                        content: [{ text: `Deployed via CLI`, type: "text" }],
                      },
                    ],
                  },
                  streamId: promptId,
                  timestamp: now,
                },
              ],
              created: now,
            },
          ]);
        });
        if (rChat.isErr()) {
          console.warn(`Failed to create ChatContext for ${res.appSlug}:`, rChat.Err());
        }
      }

      await ctx.send.send(ctx, res);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
