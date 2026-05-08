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
import {
  HttpResponseBodyType,
  HttpResponseJsonType,
  isFetchErrResult,
  isFetchNotFoundResult,
  isFetchOkResult,
} from "@vibes.diy/api-types";
import { and, desc, eq } from "drizzle-orm";
import { VibesApiSQLCtx } from "../types.js";
import { checkDocAccess, isPublicReadable, type DocAccessLevel } from "./access-helpers.js";
import { aclAllows, resolveDbAcl } from "./db-acl-resolver.js";
import { isFileMeta } from "./files-url-mint.js";
import { ASSET_SESSION_COOKIE_NAME } from "./asset-session.js";

// Handler for `/_files/<dbName>/<docId>/<key>` on the app subdomain
// (`<appSlug>--<userSlug>.<host>`). Auth/ACL gate, doc lookup, AssetUploads
// resolution, vctx.storage.fetch, stream. CID and assetURI never leak to
// the client.
//
// Public-readable apps (`publicAccess.enable && mode === "production"`)
// serve to anonymous viewers. CORS `Access-Control-Allow-Origin: *` is
// applied unconditionally by the send provider, so the URL is portable
// into third-party CMS / WordPress-style embed contexts; the auth/ACL
// gate (cookie + per-db ACL) is what actually controls visibility.
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
}

const HOSTNAME_RE = /^([a-zA-Z0-9][a-zA-Z0-9-]*?)--([a-zA-Z0-9][a-zA-Z0-9-]+)/;
const PATH_RE = /^\/_files\/([^/]+)\/([^/]+)\/([^/?]+)\/?$/;

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
    const hostMatch = HOSTNAME_RE.exec(url.hostname);
    if (!hostMatch) return Promise.resolve(Result.Ok(Option.None()));
    const pathMatch = PATH_RE.exec(url.pathname);
    if (!pathMatch) return Promise.resolve(Result.Ok(Option.None()));
    return Promise.resolve(
      Result.Ok(
        Option.Some({
          appSlug: hostMatch[1].toLowerCase(),
          userSlug: hostMatch[2].toLowerCase(),
          dbName: decodeURIComponent(pathMatch[1]),
          docId: decodeURIComponent(pathMatch[2]),
          key: decodeURIComponent(pathMatch[3]),
          cookie: extractAssetCookie(req),
        })
      )
    );
  },
  handle: async (ctx: HandleTriggerCtx<Request, FilesAssetValidated, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { userSlug, appSlug, dbName, docId, key, cookie } = ctx.validated;

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

    // 5. Stream bytes via the existing storage abstraction. mimeType prefers
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
    ctx.send.send(ctx, {
      type: "http.Response.Body",
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=31536000, immutable",
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
  ctx.send.send(ctx, {
    type: "http.Response.JSON",
    status,
    json: { type: "error", message },
  } satisfies HttpResponseJsonType);
  return Result.Ok(EventoResult.Stop);
}
