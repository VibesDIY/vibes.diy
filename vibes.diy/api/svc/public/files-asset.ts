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
import { HttpResponseBodyType, isFetchErrResult, isFetchNotFoundResult, isFetchOkResult } from "@vibes.diy/api-types";
import { and, desc, eq } from "drizzle-orm";
import { VibesApiSQLCtx } from "../types.js";
import { checkDocAccess, isPublicReadable, type DocAccessLevel } from "./access-helpers.js";
import { aclAllows, resolveDbAcl } from "./db-acl-resolver.js";
import { isFileMeta } from "./files-url-mint.js";
import { ASSET_SESSION_COOKIE_NAME } from "./asset-session.js";
import { etagMatches, quoteEtag } from "./etag-utils.js";

// Handler for `/_files/<userSlug>/<appSlug>/<dbName>/<docId>/<key>` on
// the singleton asset host `assets.<base>`. Auth/ACL gate, doc lookup,
// AssetUploads resolution, vctx.storage.fetch, stream. CID and assetURI
// never leak to the client.
//
// Public-readable apps (`publicAccess.enable && mode === "production"`)
// serve to anonymous viewers. The auth/ACL gate (cookie + per-db ACL)
// is what controls visibility; the URL itself is durable (Cool URIs
// don't change) so the browser HTTP cache and Cache-Control headers
// actually function.
//
// Auth: cookie-only. The parent shell at vibes.diy POSTs its Clerk Bearer
// to /_auth/session at iframe boot; we mint an HttpOnly cookie scoped to
// the asset host, and browsers auto-attach it to every <img>/<video> sub-
// resource fetch. Bearer-via-Authorization is no longer accepted —
// browsers don't attach it to subresource requests anyway, so the path
// could never have served images in practice.

interface FilesAssetValidated {
  readonly userSlug: string;
  readonly appSlug: string;
  readonly dbName: string;
  readonly docId: string;
  readonly key: string;
  readonly cookie: string | undefined;
  readonly ifNoneMatch: string | undefined;
  readonly origin: string | undefined;
}

// Credentialed-CORS headers for cross-origin fetch() callers (e.g. an
// iframe at `<app>--<user>.<base>` calling `meta.file()` against
// `assets.<base>`). For `<img>`/`<video>` no-cors loads these are
// ignored — the cookie attaches based on cookie attributes alone, the
// browser doesn't enforce CORS on the response.
function credentialedCors(origin: string | undefined): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

const ASSETS_HOST_PREFIX = "assets.";
const ASSETS_PATH_RE = /^\/_files\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/([^/?]+)\/?$/;

// Read a single cookie value out of the Cookie header. Cookie names are
// case-sensitive per RFC 6265; the value is everything between `=` and
// the next `;`. We don't decode (cookie tokens are JWTs — base64url-safe).
function extractAssetCookie(req: Request): string | undefined {
  const header = req.headers.get("Cookie") ?? req.headers.get("cookie");
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const trimmed = pair.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq);
    if (name === ASSET_SESSION_COOKIE_NAME) {
      return trimmed.slice(eq + 1);
    }
  }
  return undefined;
}

export const filesAsset: EventoHandler<Request, FilesAssetValidated, unknown> = {
  hash: "files-asset",
  validate: (ctx: ValidateTriggerCtx<Request, FilesAssetValidated, unknown>) => {
    const { request: req } = ctx;
    if (!req) return Promise.resolve(Result.Ok(Option.None()));
    if (req.method !== "GET" && req.method !== "HEAD") {
      return Promise.resolve(Result.Ok(Option.None()));
    }
    const url = URI.from(req.url);
    if (!url.hostname.startsWith(ASSETS_HOST_PREFIX)) {
      return Promise.resolve(Result.Ok(Option.None()));
    }
    const pathMatch = ASSETS_PATH_RE.exec(url.pathname);
    if (!pathMatch) return Promise.resolve(Result.Ok(Option.None()));
    return Promise.resolve(
      Result.Ok(
        Option.Some({
          userSlug: decodeURIComponent(pathMatch[1]).toLowerCase(),
          appSlug: decodeURIComponent(pathMatch[2]).toLowerCase(),
          dbName: decodeURIComponent(pathMatch[3]),
          docId: decodeURIComponent(pathMatch[4]),
          key: decodeURIComponent(pathMatch[5]),
          cookie: extractAssetCookie(req),
          ifNoneMatch: req.headers.get("If-None-Match") ?? req.headers.get("if-none-match") ?? undefined,
          origin: req.headers.get("Origin") ?? req.headers.get("origin") ?? undefined,
        })
      )
    );
  },
  handle: async (ctx: HandleTriggerCtx<Request, FilesAssetValidated, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { userSlug, appSlug, dbName, docId, key, cookie, ifNoneMatch, origin } = ctx.validated;
    const corsHeaders = credentialedCors(origin);

    // 1. Resolve user identity from the asset-session cookie (best-effort —
    //    anonymous reads are valid for public-readable apps).
    let userId: string | undefined;
    if (cookie) {
      const rVerified = await vctx.assetSessionSigner.verify(cookie);
      if (rVerified.isOk()) {
        userId = rVerified.Ok().userId;
      }
    }
    const access: DocAccessLevel = userId ? await checkDocAccess(vctx, userId, appSlug, userSlug) : "none";

    // 2. ACL gate. If the db has an explicit dbAcl, use it. Otherwise allow
    //    when the user has any role OR when the app is public-readable.
    const rAcl = await resolveDbAcl(vctx, userSlug, appSlug, dbName);
    if (rAcl.isErr()) {
      // Fail closed: a settings-read error must not silently fall back to
      // the open default and re-open reads on a tightened ACL.
      return sendErr(ctx, 403, "Access denied");
    }
    const acl = rAcl.Ok();
    let allowed: boolean;
    let isPublic = false;
    if (acl !== undefined) {
      allowed = aclAllows(acl, "read", access);
    } else if (access !== "none") {
      allowed = true;
    } else {
      isPublic = await isPublicReadable(vctx, appSlug, userSlug);
      allowed = isPublic;
    }
    if (!allowed) {
      return sendErr(ctx, userId ? 403 : 401, userId ? "Access denied" : "Authentication required");
    }

    // 3. Load the doc, extract the _files entry's uploadId.
    const t = vctx.sql.tables.appDocuments;
    const rRow = await exception2Result(() =>
      vctx.sql.db
        .select()
        .from(t)
        .where(and(eq(t.userSlug, userSlug), eq(t.appSlug, appSlug), eq(t.dbName, dbName), eq(t.docId, docId)))
        .orderBy(desc(t.seq))
        .limit(1)
        .then((r) => r[0])
    );
    if (rRow.isErr()) {
      return sendErr(ctx, 500, `doc lookup failed: ${rRow.Err().message}`);
    }
    const row = rRow.Ok();
    if (!row || row.deleted === 1) {
      return sendErr(ctx, 404, `Document ${docId} not found`);
    }
    const data = row.data as Record<string, unknown> | null;
    const files = data && typeof data === "object" ? (data._files as Record<string, unknown> | undefined) : undefined;
    const meta = files?.[key];
    if (!isFileMeta(meta)) {
      return sendErr(ctx, 404, `_files.${key} not found on document ${docId}`);
    }

    // 4. Resolve uploadId → assetURI via the audit table.
    const uploadsT = vctx.sql.tables.assetUploads;
    const rUpload = await exception2Result(() =>
      vctx.sql.db
        .select({
          assetURI: uploadsT.assetURI,
          userSlug: uploadsT.userSlug,
          appSlug: uploadsT.appSlug,
          mimeType: uploadsT.mimeType,
          cid: uploadsT.cid,
        })
        .from(uploadsT)
        .where(eq(uploadsT.uploadId, meta.uploadId))
        .limit(1)
        .then((r) => r[0])
    );
    if (rUpload.isErr()) {
      return sendErr(ctx, 500, `upload lookup failed: ${rUpload.Err().message}`);
    }
    const upload = rUpload.Ok();
    if (!upload) {
      return sendErr(ctx, 404, `Upload ${meta.uploadId} not found`);
    }
    // Defense-in-depth: an uploadId stored in this app's doc must have been
    // minted for this app. If it isn't, the put-doc validation (Phase 3)
    // missed something — fail closed rather than serve cross-user bytes.
    if (upload.userSlug !== userSlug || upload.appSlug !== appSlug) {
      return sendErr(ctx, 403, "Access denied");
    }

    // 5. ETag conditional. Auth + ACL already passed above, so a 304 here
    //    is safe — the response body is the same identity-gated bytes the
    //    200 path would have streamed. cid is the content hash on the
    //    AssetUploads row; quoted-string ETag per RFC 7232.
    const etag = quoteEtag(upload.cid);
    if (ifNoneMatch && etagMatches(ifNoneMatch, etag)) {
      // 304 must not carry a body — undici rejects `new Response("", {status:304})`.
      // Pass null body; the send provider forwards it to Response unchanged.
      ctx.send.send(ctx, {
        type: "http.Response.Body",
        status: 304,
        body: null,
        headers: {
          ETag: etag,
          "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=30",
          ...corsHeaders,
        },
      } satisfies HttpResponseBodyType);
      return Result.Ok(EventoResult.Stop);
    }

    // 6. Stream bytes via the existing storage abstraction. mimeType prefers
    //    the audit row's stored value, falls back to the doc-side type hint.
    const mime = upload.mimeType ?? meta.type ?? "application/octet-stream";
    const rAsset = await vctx.storage.fetch(upload.assetURI);
    if (isFetchErrResult(rAsset)) {
      return sendErr(ctx, 500, rAsset.error.message);
    }
    if (isFetchNotFoundResult(rAsset)) {
      return sendErr(ctx, 404, `Asset not found for ${upload.assetURI}`);
    }
    if (!isFetchOkResult(rAsset)) {
      return sendErr(ctx, 500, `Unexpected fetch result for ${upload.assetURI}`);
    }
    // Cache policy:
    //   - public-readable: immutable, year-long, shared CDN OK.
    //   - private: `private, max-age=30`. Refresh within 30s = browser cache
    //     hit (zero server cost). After 30s, browser sends If-None-Match
    //     and we run auth + ACL + return 304 — logout invalidates within
    //     a 30s window. ETag is the content cid so revalidation matches
    //     even across replayed/cached requests.
    ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=30",
        ETag: etag,
        ...corsHeaders,
      },
      body: rAsset.data,
    } satisfies HttpResponseBodyType);
    return Result.Ok(EventoResult.Stop);
  },
};

function sendErr(
  ctx: HandleTriggerCtx<Request, FilesAssetValidated, unknown>,
  status: number,
  message: string
): Result<EventoResultType> {
  // Use BodyType so we can attach credentialed CORS headers — the JSON
  // type's headers field is currently dropped by the send provider.
  // Without ACAO + ACAC matching the request Origin, a credentialed
  // fetch caller (meta.file()) cannot read the error response from JS,
  // which masks 401/403 as opaque network errors.
  const origin = ctx.validated.origin;
  ctx.send.send(ctx, {
    type: "http.Response.Body",
    status,
    body: JSON.stringify({ type: "error", message }),
    headers: {
      "Content-Type": "application/json",
      ...credentialedCors(origin),
    },
  } satisfies HttpResponseBodyType);
  return Result.Ok(EventoResult.Stop);
}
