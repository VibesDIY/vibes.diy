import {
  EventoHandler,
  HandleTriggerCtx,
  Result,
  ValidateTriggerCtx,
  Option,
  EventoResultType,
  EventoResult,
} from "@adviser/cement";
import {
  isReqPutDoc,
  type ReqPutDoc,
  isReqGetDoc,
  type ReqGetDoc,
  isReqQueryDocs,
  type ReqQueryDocs,
  isReqDeleteDoc,
  type ReqDeleteDoc,
  isReqSetDbAcl,
  type ReqSetDbAcl,
  isReqSubscribeDocs,
  type ReqSubscribeDocs,
  isReqListDbNames,
  type ReqListDbNames,
} from "@vibes.diy/vibe-types";
import type { VibesDiyApiIface } from "@vibes.diy/api-types";
import type { VibeApiCapableSandbox } from "./srv-sandbox-types.js";

// ── Firefly document handlers ──────────────────────────────────────

// Vibe document data + DB subscriptions must ride AppSessions (vibeApi), which
// wires the doc-changed emit. A missing vibeApi is a hard error, never a silent
// fallback to chatApi (ChatSessions) — that fallback was the #2306 leak.
export async function requireVibeApi(
  sandbox: VibeApiCapableSandbox,
  ctx: HandleTriggerCtx<unknown, { tid: string; ownerHandle?: string; appSlug?: string }, unknown>,
  resType: string
): Promise<VibesDiyApiIface | undefined> {
  const vibeApi = sandbox.vibeApi;
  if (vibeApi !== undefined) return vibeApi;
  // Single error path. Now that the transient startup race is gone (vibeApi is
  // resolved live — #2348), reaching here means the route isn't vibe-bound yet
  // or the provider/session is mismatched — spell that out, with owner/app
  // context when the request carried it.
  const { ownerHandle, appSlug } = ctx.validated;
  const where = ownerHandle !== undefined && appSlug !== undefined ? ` for ${ownerHandle}/${appSlug}` : "";
  await ctx.send.send(ctx, {
    tid: ctx.validated.tid,
    type: resType,
    status: "error",
    message: `vibeApi unavailable — no active app session for this route${where} (route not vibe-bound yet or provider/session mismatch)`,
  });
  return undefined;
}

export function vibePutDoc(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.putDoc",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqPutDoc(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqPutDoc, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibes.diy.res-put-doc");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const rRes = await api.putDoc({
        ownerHandle: ctx.validated.ownerHandle,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
        doc: ctx.validated.doc,
        docId: ctx.validated.docId,
      });
      if (rRes.isErr()) {
        const err = rRes.Err();
        const errMessage = typeof err === "string" ? err : (err?.message ?? "unknown error");
        // Access-function denials carry `code: "access-denied"` (custom forbidden(...)
        // reasons and helper messages). Show those verbatim so app authors see why a
        // write was rejected; the platform's bare "Access denied" keeps the friendly
        // read-only copy, and anything else is treated as an infra/DB failure.
        const code = typeof err === "string" ? undefined : err?.error?.code;
        const isAccessDenied = code === "access-denied" || errMessage === "Access denied";
        let toast: string;
        if (code === "access-denied") {
          // App-authored text lands directly in the toast; trim + cap so a long
          // string can't overwhelm it (Charlie review, PR #2331). Plain-string render,
          // so no HTML/XSS concern. The iframe still gets the full reason below.
          const trimmed = errMessage.trim();
          toast = trimmed.length > 200 ? `${trimmed.slice(0, 199)}…` : trimmed;
        } else if (errMessage === "Access denied") {
          toast = "You have read-only access to this app.";
        } else {
          toast = "Failed to save your changes. Please try again.";
        }
        sandbox.args.errorLogger(toast);
        if (!isAccessDenied) {
          console.debug("vibePutDoc failed", err);
        }
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-put-doc",
          status: "error",
          message: errMessage,
        });
      } else {
        const res = rRes.Ok();
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-put-doc",
          status: "ok",
          id: res.id,
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeGetDoc(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.getDoc",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqGetDoc(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqGetDoc, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibes.diy.res-get-doc");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const rRes = await api.getDoc({
        ownerHandle: ctx.validated.ownerHandle,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
        docId: ctx.validated.docId,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-get-doc",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        const res = rRes.Ok();
        await ctx.send.send(ctx, {
          ...res,
          tid: ctx.validated.tid,
          type: "vibes.diy.res-get-doc",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeQueryDocs(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.queryDocs",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqQueryDocs(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqQueryDocs, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibes.diy.res-query-docs");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const rRes = await api.queryDocs({
        ownerHandle: ctx.validated.ownerHandle,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-query-docs",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        const res = rRes.Ok();
        await ctx.send.send(ctx, {
          ...res,
          tid: ctx.validated.tid,
          type: "vibes.diy.res-query-docs",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeDeleteDoc(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.deleteDoc",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqDeleteDoc(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqDeleteDoc, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibes.diy.res-delete-doc");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const rRes = await api.deleteDoc({
        ownerHandle: ctx.validated.ownerHandle,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
        docId: ctx.validated.docId,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-delete-doc",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        const res = rRes.Ok();
        await ctx.send.send(ctx, {
          ...res,
          tid: ctx.validated.tid,
          type: "vibes.diy.res-delete-doc",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeSubscribeDocs(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.subscribeDocs",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqSubscribeDocs(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqSubscribeDocs, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibes.diy.res-subscribe-docs");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const rRes = await api.subscribeDocs({
        ownerHandle: ctx.validated.ownerHandle,
        appSlug: ctx.validated.appSlug,
        dbName: ctx.validated.dbName,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-subscribe-docs",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        await ctx.send.send(ctx, {
          ...rRes.Ok(),
          tid: ctx.validated.tid,
          type: "vibes.diy.res-subscribe-docs",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeSetDbAcl(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.setDbAcl",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqSetDbAcl(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqSetDbAcl, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibes.diy.res-set-db-acl");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const rRes = await api.ensureAppSettings({
        ownerHandle: ctx.validated.ownerHandle,
        appSlug: ctx.validated.appSlug,
        dbAcl: { dbName: ctx.validated.dbName, acl: ctx.validated.acl },
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-set-db-acl",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-set-db-acl",
          status: "ok",
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeListDbNames(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.listDbNames",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqListDbNames(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<Request, ReqListDbNames, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibes.diy.res-list-db-names");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const rRes = await api.listDbNames({
        ownerHandle: ctx.validated.ownerHandle,
        appSlug: ctx.validated.appSlug,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid: ctx.validated.tid,
          type: "vibes.diy.res-list-db-names",
          status: "error",
          message: rRes.Err().message,
        });
      } else {
        await ctx.send.send(ctx, {
          ...rRes.Ok(),
          tid: ctx.validated.tid,
        });
      }
      return Result.Ok(EventoResult.Stop);
    },
  };
}
