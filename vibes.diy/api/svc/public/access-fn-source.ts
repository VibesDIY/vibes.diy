import { EventoHandler, Result, Option, EventoResultType, HandleTriggerCtx, EventoResult } from "@adviser/cement";
import { MsgBase, ReqWithOptionalAuth, VibesDiyError, ResError, W3CWebSocketEvent } from "@vibes.diy/api-types";
import { ReqVibeAccessFnSource, ResVibeAccessFnSource, isReqVibeAccessFnSource } from "@vibes.diy/vibe-types";
import { and, eq } from "drizzle-orm";
import { unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { optAuth } from "../check-auth.js";

export interface ResolveAccessFnSourceArgs {
  ownerHandle: string;
  appSlug: string;
  cid: string;
}

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(merged);
}

// Resolves a vibe's full access.js source bytes for a content-addressed CID.
// Primary path: read the binding's accessFnAssetUri via the storage abstraction
// (handles SQL and R2). Fallback (legacy rows with a null URI): the CID *is* the
// Assets.assetId, so read the content blob directly. Returns { cid, source: null }
// when nothing is found — callers treat that as "unknown", never a hard deny.
export async function resolveAccessFnSource(
  vctx: VibesApiSQLCtx,
  args: ResolveAccessFnSourceArgs
): Promise<Result<{ cid: string; source: string | null }>> {
  const { ownerHandle, appSlug, cid } = args;

  const tAfb = vctx.sql.tables.accessFunctionBindings;
  const rows = await vctx.sql.db
    .select({ accessFnAssetUri: tAfb.accessFnAssetUri })
    .from(tAfb)
    .where(and(eq(tAfb.ownerHandle, ownerHandle), eq(tAfb.appSlug, appSlug), eq(tAfb.accessFnCid, cid)));

  const assetUri = rows.find((r) => r.accessFnAssetUri !== null && r.accessFnAssetUri !== undefined)?.accessFnAssetUri;
  if (assetUri !== null && assetUri !== undefined) {
    const rFetch = await vctx.storage.fetch(assetUri);
    if (rFetch.type === "fetch.ok") {
      return Result.Ok({ cid, source: await streamToString(rFetch.data) });
    }
  }

  // Fallback: content-addressed Assets row keyed by assetId === cid.
  const tAssets = vctx.sql.tables.assets;
  const assetRows = await vctx.sql.db.select({ content: tAssets.content }).from(tAssets).where(eq(tAssets.assetId, cid));
  const content = assetRows[0]?.content;
  if (content !== undefined && content !== null) {
    let bytes: Uint8Array;
    if (content instanceof Uint8Array) {
      bytes = content;
    } else if (Buffer.isBuffer(content)) {
      bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    } else {
      bytes = new Uint8Array(content as ArrayBufferLike);
    }
    return Result.Ok({ cid, source: new TextDecoder().decode(bytes) });
  }

  return Result.Ok({ cid, source: null });
}

// Evento handler — used by the WS bridge to serve vibe.req.accessFnSource.
// Uses optAuth for framework consistency (same as whoAmIEvento); auth is not
// required to retrieve source bytes — the CID is content-addressed and the
// bytes are already available to the running iframe anyway.
export const accessFnSourceEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqVibeAccessFnSource>,
  ResVibeAccessFnSource | VibesDiyError
> = {
  hash: "vibe.accessFnSource",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    if (!isReqVibeAccessFnSource(msg.payload)) return Result.Ok(Option.None());
    return Result.Ok(Option.Some({ ...msg, payload: msg.payload as ReqVibeAccessFnSource }));
  }),
  handle: optAuth(
    async (
      ctx: HandleTriggerCtx<
        W3CWebSocketEvent,
        MsgBase<ReqWithOptionalAuth<ReqVibeAccessFnSource>>,
        ResVibeAccessFnSource | VibesDiyError
      >
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
      const rRes = await resolveAccessFnSource(vctx, {
        ownerHandle: req.ownerHandle,
        appSlug: req.appSlug,
        cid: req.cid,
      });
      if (rRes.isErr()) {
        await ctx.send.send(ctx, {
          type: "vibes.diy.res-error",
          error: { message: rRes.Err().message },
        } satisfies ResError);
        return Result.Ok(EventoResult.Continue);
      }
      const r = rRes.Ok();
      await ctx.send.send(ctx, {
        type: "vibe.res.accessFnSource",
        tid: req.tid,
        cid: r.cid,
        source: r.source,
      } satisfies ResVibeAccessFnSource);
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
