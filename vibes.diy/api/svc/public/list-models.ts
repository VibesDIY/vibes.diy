import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  Lazy,
  stream2string,
  BuildURI,
  exception2Result,
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

// Lazy cache resets every 10s, so on a slow worker every 11th caller eats
// the asset fetch latency. When that fetch is slow, every consumer of
// withModelDefaults (ensureAppSettings, prompt-chat-section) stalls. Logging
// the fetch path lets us see in `wrangler tail` how often we miss + how long
// the network leg actually takes.
export const loadModels = Lazy(
  async (vctx: VibesApiSQLCtx): Promise<Result<ResListModels>> => {
    const logger = ensureLogger(vctx.sthis, "loadModels");
    const vibePkgModelsUrl = BuildURI.from(vctx.params.pkgRepos.workspace)
      .appendRelative("@vibes.diy/api-svc/models.json")
      .toString();

    const startMs = Date.now();
    const rAsset = await vctx.fetchAsset(vibePkgModelsUrl);
    const fetchMs = Date.now() - startMs;
    if (rAsset.isErr()) {
      logger.Warn().Any({ url: vibePkgModelsUrl, fetchMs, error: rAsset.Err() }).Msg("fetchAsset failed");
      return Result.Err(rAsset);
    }
    const rRaw = await exception2Result(async () => JSON.parse(await stream2string(rAsset.Ok())));
    if (rRaw.isErr()) {
      logger.Warn().Any({ url: vibePkgModelsUrl, fetchMs, error: rRaw.Err() }).Msg("models.json parse failed");
      return Result.Err(rRaw);
    }
    const { filtered: models, warning: modelsWarning } = parseArrayWarning(rRaw.Ok(), Model);
    if (modelsWarning.length > 0) {
      logger.Warn().Any({ parseErrors: modelsWarning }).Msg("skip");
    }
    if (fetchMs > 500) {
      logger.Warn().Any({ url: vibePkgModelsUrl, fetchMs, count: models.length }).Msg("slow models.json fetch");
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
