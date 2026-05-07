import {
  EventoHandler,
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  EventoResultType,
  Option,
  EventoResult,
  URI,
  exception2Result,
} from "@adviser/cement";
import { HttpResponseJsonType } from "@vibes.diy/api-types";
import { VibesApiSQLCtx } from "../types.js";

// HTTP `POST /assets` upload endpoint. Auth comes from the X-Asset-Grant
// header (a short-lived signed JWT minted by the WS asset-upload-grant
// handler) — *not* from the dashboard auth header. The grant carries the
// (userId, userSlug, appSlug, jti) tuple the audit row needs.
//
// Body streams via `request.body` directly into `vctx.storage.ensure()`,
// which writes to the SQL peer for ≤4KB or to R2 for larger uploads.
// AssetUploads is the audit/quota table; the read handler resolves
// uploadId → assetURI from it. assetURI is the storageResult.getURL —
// recovering the URI from a bare CID would require peer-probing, which
// we ruled out.
//
// Replay is benign: storage is content-addressed, so a replayed upload
// with the same bytes produces the same CID. Worst case, a duplicate
// AssetUploads audit row.

interface PutAssetValidated {
  readonly grant: string;
  readonly contentType: string | undefined;
  readonly body: ReadableStream<Uint8Array> | null;
}

const GRANT_HEADER = "X-Asset-Grant";

export const putAsset: EventoHandler<Request, PutAssetValidated, unknown> = {
  hash: "put-asset",
  validate: (ctx: ValidateTriggerCtx<Request, PutAssetValidated, unknown>) => {
    const { request: req } = ctx;
    if (!req || req.method !== "POST") return Promise.resolve(Result.Ok(Option.None()));
    const url = URI.from(req.url);
    if (url.pathname !== "/assets") return Promise.resolve(Result.Ok(Option.None()));
    const grant = req.headers.get(GRANT_HEADER) ?? req.headers.get(GRANT_HEADER.toLowerCase());
    if (!grant) {
      // We've claimed the route, so respond rather than fall through.
      return Promise.resolve(
        Result.Ok(
          Option.Some({
            grant: "",
            contentType: req.headers.get("Content-Type") ?? undefined,
            body: req.body as ReadableStream<Uint8Array> | null,
          })
        )
      );
    }
    return Promise.resolve(
      Result.Ok(
        Option.Some({
          grant,
          contentType: req.headers.get("Content-Type") ?? undefined,
          body: req.body as ReadableStream<Uint8Array> | null,
        })
      )
    );
  },
  handle: async (ctx: HandleTriggerCtx<Request, PutAssetValidated, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { grant, contentType, body } = ctx.validated;

    if (!grant) {
      return sendErr(ctx, 401, `missing ${GRANT_HEADER} header`);
    }
    const rClaims = await vctx.assetGrantSigner.verify(grant);
    if (rClaims.isErr()) {
      // jose flags expired tokens with err.code === "ERR_JWT_EXPIRED"; map to
      // 410 Gone per the design (other failures are 401).
      const errMsg = rClaims.Err().message ?? "";
      const status = /JWTExpired|ERR_JWT_EXPIRED|exp" claim timestamp/.test(errMsg) ? 410 : 401;
      return sendErr(ctx, status, status === 410 ? "grant expired" : "invalid grant");
    }
    const claims = rClaims.Ok();

    // mimeType claim, when present, is advisory: warn on mismatch, don't
    // reject. CLI uploads carry the inferred mimetype; browser uploads have
    // a stricter type and should rely on the doc-side `type` field anyway.
    if (claims.mimeType && contentType && contentType !== "application/octet-stream" && contentType !== claims.mimeType) {
      vctx.logger.Warn().Str("expected", claims.mimeType).Str("got", contentType).Msg("put-asset Content-Type mismatch");
    }

    if (!body) {
      return sendErr(ctx, 400, "request body required");
    }

    const rEnsure = await exception2Result(() => vctx.storage.ensure(body));
    if (rEnsure.isErr()) {
      return sendErr(ctx, 500, `storage.ensure failed: ${rEnsure.Err().message}`);
    }
    const results = rEnsure.Ok();
    if (results.length === 0 || results[0].isErr()) {
      return sendErr(ctx, 500, `storage.ensure failed: ${results[0]?.Err()?.message ?? "no result"}`);
    }
    const stored = results[0].Ok();

    const uploadsTable = vctx.sql.tables.assetUploads;
    const rInsert = await exception2Result(() =>
      vctx.sql.db.insert(uploadsTable).values({
        uploadId: claims.jti,
        userId: claims.userId,
        userSlug: claims.userSlug,
        appSlug: claims.appSlug,
        cid: stored.cid,
        assetURI: stored.getURL,
        size: stored.size,
        mimeType: claims.mimeType ?? null,
        created: new Date().toISOString(),
      })
    );
    if (rInsert.isErr()) {
      return sendErr(ctx, 500, `audit insert failed: ${rInsert.Err().message}`);
    }

    await ctx.send.send(ctx, {
      type: "http.Response.JSON",
      status: 200,
      json: {
        type: "vibes.diy.res-put-asset",
        cid: stored.cid,
        getURL: stored.getURL,
        size: stored.size,
        uploadId: claims.jti,
      },
    } satisfies HttpResponseJsonType);
    return Result.Ok(EventoResult.Stop);
  },
};

function sendErr(
  ctx: HandleTriggerCtx<Request, PutAssetValidated, unknown>,
  status: number,
  message: string
): Result<EventoResultType> {
  ctx.send.send(ctx, {
    type: "http.Response.JSON",
    status,
    json: { type: "error", message },
  } satisfies HttpResponseJsonType);
  return Result.Ok(EventoResult.Stop);
}
