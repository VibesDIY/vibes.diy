import { EventoHandler, HandleTriggerCtx, Result, ValidateTriggerCtx, Option, EventoResultType, EventoResult } from "@adviser/cement";
import {
  isReqVibePutAsset,
  type ReqVibePutAsset,
  type ResOkVibePutAsset,
  type ResErrorVibePutAsset,
  type EvtVibePutAssetProgress,
  isReqVibeWhoAmI,
  type ReqVibeWhoAmI,
  type ResVibeWhoAmI,
  type ReqVibeUpdateAvatarCid,
  type ResVibeUpdateAvatarCid,
  isReqVibeUpdateAvatarCid,
  isReqVibeLogin,
  type ReqVibeLogin,
} from "@vibes.diy/vibe-types";
import { requireVibeApi } from "./srv-sandbox-firefly-doc-handlers.js";
import type { VibeApiCapableSandbox } from "./srv-sandbox-types.js";

// Stage B Phase 5 host-side handler. Receives a Blob from the iframe,
// mints a put-asset grant via the server WS, then POSTs the bytes to the
// returned uploadUrl. Emits `vibe.evt.putAsset.progress` heartbeats every
// 3s while the fetch is in flight so the sandbox-side request's idle
// timer doesn't fire during a slow upload.
//
// Auth: the grant request goes through VibesDiyApi.send() which attaches
// the dashboard auth token automatically. The HTTP POST carries
// X-Asset-Grant; verifyAuth is NOT called server-side — the grant IS the
// auth (see vibes.diy/api/svc/public/put-asset.ts).
const PROGRESS_INTERVAL_MS = 3000;

export function vibePutAsset(sandbox: VibeApiCapableSandbox): EventoHandler {
  const doFetch: typeof fetch = sandbox.args.fetch ?? ((...a) => fetch(...a));
  return {
    hash: "vibe.putAsset",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibePutAsset(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, ReqVibePutAsset, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibe.res.putAsset");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const { tid, blob, ownerHandle, appSlug, mimeType } = ctx.validated;
      const sendErr = async (message: string) => {
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.putAsset",
          status: "error",
          message,
        } satisfies ResErrorVibePutAsset);
      };

      const rGrant = await api.requestAssetUploadGrant({
        ownerHandle,
        appSlug,
        ...(mimeType ? { mimeType } : mimeType === undefined && blob.type ? { mimeType: blob.type } : {}),
      });
      if (rGrant.isErr()) {
        await sendErr(`grant minting failed: ${rGrant.Err().message}`);
        return Result.Ok(EventoResult.Stop);
      }
      const grant = rGrant.Ok();

      // Heartbeat the iframe every 3s while the upload is in flight so
      // its 10s idle-reset timer doesn't expire during slow networks.
      const progressTimer = setInterval(() => {
        ctx.send.send(ctx, {
          tid,
          type: "vibe.evt.putAsset.progress",
          bytes: blob.size,
        } satisfies EvtVibePutAssetProgress);
      }, PROGRESS_INTERVAL_MS);

      try {
        const res = await doFetch(grant.uploadUrl, {
          method: "POST",
          headers: {
            "X-Asset-Grant": grant.grant,
            "Content-Type": blob.type || "application/octet-stream",
          },
          body: blob,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          await sendErr(`POST ${grant.uploadUrl} returned ${res.status}: ${text}`);
          return Result.Ok(EventoResult.Stop);
        }
        const body = (await res.json()) as { cid: string; getURL: string; size: number; uploadId: string };
        // Remember the server-supplied storage URI for this CID so a later
        // avatar-confirm gate can preview the exact bytes without trusting a
        // sandbox-supplied URL (#2418). The getURL here came from the put-asset
        // response, not the iframe.
        sandbox.recordAssetGetURL(body.cid, body.getURL);
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.putAsset",
          status: "ok",
          cid: body.cid,
          getURL: body.getURL,
          size: body.size,
          uploadId: body.uploadId,
        } satisfies ResOkVibePutAsset);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sendErr(`upload failed: ${msg}`);
      } finally {
        clearInterval(progressTimer);
      }

      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeWhoAmI(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.whoAmI",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibeWhoAmI(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, ReqVibeWhoAmI, unknown>): Promise<Result<EventoResultType>> => {
      const api = await requireVibeApi(sandbox, ctx, "vibe.res.whoAmI");
      if (api === undefined) return Result.Ok(EventoResult.Stop);
      const { tid, appSlug, ownerHandle, adminMode } = ctx.validated;
      const rRes = await api.whoAmI({ tid, appSlug, ownerHandle, adminMode });

      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.whoAmI",
          viewer: null,
          access: "none",
        } satisfies ResVibeWhoAmI);
        return Result.Ok(EventoResult.Stop);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        tid,
        type: "vibe.res.whoAmI",
        viewer: r.viewer,
        access: r.access,
        ...(r.isOwner !== undefined ? { isOwner: r.isOwner } : {}),
        ...(r.dbAcls !== undefined ? { dbAcls: r.dbAcls } : {}),
        ...(r.grants !== undefined ? { grants: r.grants } : {}),
      } satisfies ResVibeWhoAmI);
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeUpdateAvatarCid(sandbox: VibeApiCapableSandbox): EventoHandler {
  const { chatApi } = sandbox.args;
  return {
    hash: "vibe.updateAvatarCid",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibeUpdateAvatarCid(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (ctx: HandleTriggerCtx<MessageEvent, ReqVibeUpdateAvatarCid, unknown>): Promise<Result<EventoResultType>> => {
      const { tid, cid, mimeType, handle } = ctx.validated;

      // Host-side consent gate (#1968): a sandbox can't silently overwrite the
      // viewer's avatar. The provider shows a preview/confirm modal and only an
      // explicit approval lets the write through. No handler (server/test paths
      // with no UI) proceeds, matching the optional openSignIn pattern.
      //
      // The preview is driven by the storage URI the host recorded when it
      // proxied the upload for this CID (server-supplied, #2418) — never a value
      // the vibe passed in. If the CID wasn't uploaded through this host session
      // the getURL is absent and the modal shows "preview unavailable"; the
      // consent gate and the persisted CID are unchanged.
      if (sandbox.args.confirmAvatarUpdate) {
        const getURL = sandbox.getAssetGetURL(cid);
        const confirmed = await sandbox.args.confirmAvatarUpdate({
          cid,
          ...(mimeType ? { mimeType } : {}),
          ...(getURL ? { getURL } : {}),
        });
        if (!confirmed) {
          await ctx.send.send(ctx, {
            tid,
            type: "vibe.res.updateAvatarCid",
            status: "cancelled",
          } satisfies ResVibeUpdateAvatarCid);
          return Result.Ok(EventoResult.Stop);
        }
      }

      // Write the avatar to the VIEWER-selected handle (per-handle store). The
      // server re-validates that `handle` belongs to the authenticated viewer
      // and resolves `cid` to the authoritative storage URL — so neither the app
      // owner (vibeApp.ownerHandle) nor a forged URL can be used here.
      const rRes = await chatApi.ensureHandleAvatar({
        handle,
        cid,
        ...(mimeType ? { mime: mimeType } : {}),
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          tid,
          type: "vibe.res.updateAvatarCid",
          status: "error",
          message: rRes.Err().message,
        } satisfies ResVibeUpdateAvatarCid);
        return Result.Ok(EventoResult.Stop);
      }
      await ctx.send.send(ctx, {
        tid,
        type: "vibe.res.updateAvatarCid",
        status: "ok",
      } satisfies ResVibeUpdateAvatarCid);
      return Result.Ok(EventoResult.Stop);
    },
  };
}

export function vibeRequestLogin(sandbox: VibeApiCapableSandbox): EventoHandler {
  return {
    hash: "vibe.requestLogin",
    validate: (ctx: ValidateTriggerCtx<MessageEvent, unknown, unknown>) => {
      const { request: req } = ctx;
      if (isReqVibeLogin(req?.data)) {
        return Promise.resolve(Result.Ok(Option.Some(req.data)));
      }
      return Promise.resolve(Result.Ok(Option.None()));
    },
    handle: async (_ctx: HandleTriggerCtx<MessageEvent, ReqVibeLogin, unknown>): Promise<Result<EventoResultType>> => {
      sandbox.args.openSignIn?.();
      return Result.Ok(EventoResult.Stop);
    },
  };
}
