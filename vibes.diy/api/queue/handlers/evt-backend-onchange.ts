import { EventoHandler, EventoResult, HandleTriggerCtx, Option, Result, EventoResultType } from "@adviser/cement";
import { EvtBackendOnChange, MsgBase, isEvtBackendOnChange, msgBase } from "@vibes.diy/api-types";
import { type } from "arktype";
import { eq, and } from "drizzle-orm";
import { QueueCtx } from "../queue-ctx.js";

export const evtBackendOnChangeEvento: EventoHandler<unknown, MsgBase<EvtBackendOnChange>, void> = {
  hash: "evt-backend-onchange",
  validate: async (ctx) => {
    const msg = msgBase(ctx.enRequest);
    if (msg instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    if (!isEvtBackendOnChange(msg.payload)) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(Option.Some(msg as MsgBase<EvtBackendOnChange>));
  },
  handle: async (ctx: HandleTriggerCtx<unknown, MsgBase<EvtBackendOnChange>, void>): Promise<Result<EventoResultType>> => {
    const qctx = ctx.ctx.getOrThrow<QueueCtx>("queueCtx");
    const backendDo = qctx.params.cf.BACKEND_DO;
    if (!backendDo) {
      console.warn("evtBackendOnChangeEvento: BACKEND_DO binding not available — skipping");
      return Result.Ok(EventoResult.Continue);
    }

    const payload = ctx.validated.payload;
    const { ownerHandle, appSlug, dbName, docId, doc, oldDoc, writerHandle } = payload;

    // Look up BackendFunctionBindings row to get source CID and asset URI
    const tBfb = qctx.sql.tables.backendFunctionBindings;
    const bfbRow = await qctx.sql.db
      .select({
        backendCid: tBfb.backendCid,
        backendAssetUri: tBfb.backendAssetUri,
        hasOnChange: tBfb.hasOnChange,
      })
      .from(tBfb)
      .where(and(eq(tBfb.ownerHandle, ownerHandle), eq(tBfb.appSlug, appSlug)))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!bfbRow || !bfbRow.hasOnChange) {
      // No backend binding or onChange not exported — nothing to do
      return Result.Ok(EventoResult.Continue);
    }

    if (!bfbRow.backendAssetUri) {
      console.error(`evtBackendOnChangeEvento: no backendAssetUri for ${ownerHandle}/${appSlug}`);
      return Result.Ok(EventoResult.Continue);
    }

    // Load the backend.js source from storage
    const s3 = qctx.storageSystems.s3;
    if (!s3) {
      console.error("evtBackendOnChangeEvento: no S3/R2 storage available — cannot load backend source");
      return Result.Ok(EventoResult.Continue);
    }

    const fetchResult = await s3.get(bfbRow.backendAssetUri);
    if (fetchResult.type !== "fetch.ok") {
      console.error(`evtBackendOnChangeEvento: failed to fetch backend source for ${ownerHandle}/${appSlug}:`, fetchResult);
      return Result.Ok(EventoResult.Continue);
    }

    const reader = fetchResult.data.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    const source = new TextDecoder().decode(merged);

    // Build the putDocUrl for db.put / db.get inside the backend handler
    const baseUrl = qctx.params.vibes.env.VIBES_DIY_PUBLIC_BASE_URL.replace(/\/$/, "");
    const putDocUrl = `${baseUrl}/api/internal/backend-put-doc/${ownerHandle}/${appSlug}/${dbName}`;

    // Dispatch to BackendDO
    const doId = backendDo.idFromName(`${ownerHandle}/${appSlug}`);
    const stub = backendDo.get(doId);

    try {
      const resp = await stub.fetch(
        new Request("https://internal/invoke", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "onChange",
            source,
            cid: bfbRow.backendCid,
            event: {
              doc,
              oldDoc: oldDoc ?? null,
              db: dbName,
            },
            ownerHandle,
            appSlug,
            writerHandle: writerHandle ?? "",
            putDocUrl,
          }),
        }) as unknown as Parameters<typeof stub.fetch>[0]
      );

      if (!resp.ok) {
        const body = await resp.text();
        console.error(
          `evtBackendOnChangeEvento: BackendDO returned ${resp.status} for ${ownerHandle}/${appSlug} doc ${docId}:`,
          body
        );
      }
    } catch (err: unknown) {
      console.error(`evtBackendOnChangeEvento: BackendDO fetch threw for ${ownerHandle}/${appSlug} doc ${docId}:`, err);
    }

    return Result.Ok(EventoResult.Continue);
  },
};
