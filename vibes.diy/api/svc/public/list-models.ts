import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  Lazy,
  urlDirname,
  stream2string,
  BuildURI,
} from "@adviser/cement";
import {
  isReqListModels,
  Model,
  MsgBase,
  parseArrayWarning,
  ReqListModels,
  ResListModels,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { ensureLogger } from "@fireproof/core-runtime";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";

export const loadModels = Lazy(
  async (vctx: VibesApiSQLCtx): Promise<Result<ResListModels>> => {
    const modelsUrl = urlDirname(import.meta.url)
      .build()
      .appendRelative("../models.json")
      .toString();
    console.log("Fetching Models.json", modelsUrl, vctx.params.pkgRepos.workspace);
    const vibePkgModelsUrl = BuildURI.from(vctx.params.pkgRepos.workspace)
      .appendRelative("@vibes.diy/api-svc/models.json")
      .toString();

    const rAsset = await vctx.fetchAsset(vibePkgModelsUrl);
    // console.log("Fetched models.json asset", { vibePkgModelsUrl, success: rAsset.isOk() });
    if (rAsset.isErr()) return Result.Err(rAsset);
    const raw = JSON.parse(await stream2string(rAsset.Ok()));
    const { filtered: models, warning: modelsWarning } = parseArrayWarning(raw, Model);
    // console.log("Loaded models:", models);
    if (modelsWarning.length > 0) {
      ensureLogger(vctx.sthis, "loadModels").Warn().Any({ parseErrors: modelsWarning }).Msg("skip");
    }
    return Result.Ok({
      type: "vibes.diy.res-list-models",
      models: models.sort((a, b) => a.name.localeCompare(b.name)),
    } satisfies ResListModels);
  },
  { resetAfter: 10000 }
);

export const listModelsEvento: EventoHandler<W3CWebSocketEvent, MsgBase<ReqListModels>, ResListModels | VibesDiyError> = {
  hash: "list-models",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (isReqListModels(msg.payload)) {
      return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqListModels }));
    }
    return Result.Ok(Option.None());
  }),
  handle: async (
    ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqListModels>, ResListModels | VibesDiyError>
  ): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const rResult = await loadModels(vctx);
    if (rResult.isErr()) return Result.Err(rResult);
    await ctx.send.send(ctx, rResult.Ok());
    return Result.Ok(EventoResult.Continue);
  },
};
