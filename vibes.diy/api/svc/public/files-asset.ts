import {
  EventoHandler,
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  EventoResultType,
  Option,
  EventoResult,
  URI,
} from "@adviser/cement";
import {
  HttpResponseBodyType,
  HttpResponseJsonType,
  isFetchErrResult,
  isFetchNotFoundResult,
  isFetchOkResult,
} from "@vibes.diy/api-types";
import { DashAuthType } from "@fireproof/core-types-protocols-dashboard";
import { and, desc, eq } from "drizzle-orm";
import { VibesApiSQLCtx } from "../types.js";
import { verifyAuth } from "../check-auth.js";
import { checkDocAccess, isPublicReadable, type DocAccessLevel } from "./access-helpers.js";
import { aclAllows, resolveDbAcl } from "./db-acl-resolver.js";

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

interface FilesAssetValidated {
  readonly userSlug: string;
  readonly appSlug: string;
  readonly dbName: string;
  readonly docId: string;
  readonly key: string;
  readonly bearer: string | undefined;
}

const HOSTNAME_RE = /^([a-zA-Z0-9][a-zA-Z0-9-]*?)--([a-zA-Z0-9][a-zA-Z0-9-]+)/;
const PATH_RE = /^\/_files\/([^/]+)\/([^/]+)\/([^/?]+)\/?$/;

function extractBearer(req: Request): string | undefined {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : undefined;
}

// Bearer headers carry no type marker, so probe each registered tokenApi
// type until one verifies. JWT verification is cheap; with two registered
// types (clerk, device-id) the worst case is two signature checks.
async function verifyAnyBearer(vctx: VibesApiSQLCtx, token: string): Promise<string | undefined> {
  for (const type of Object.keys(vctx.tokenApi)) {
    const rAuth = await verifyAuth(vctx, { auth: { type, token } as DashAuthType });
    if (rAuth.isOk() && rAuth.Ok().type === "VerifiedAuthResult") {
      return rAuth.Ok().verifiedAuth.claims.userId;
    }
  }
  return undefined;
}

interface StoredFileMetaShape {
  readonly uploadId?: unknown;
  readonly type?: unknown;
}

function isStoredFileMeta(v: unknown): v is { uploadId: string; type: string } {
  if (!v || typeof v !== "object") return false;
  const m = v as StoredFileMetaShape;
  return typeof m.uploadId === "string" && typeof m.type === "string";
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
          bearer: extractBearer(req),
        })
      )
    );
  },
  handle: async (ctx: HandleTriggerCtx<Request, FilesAssetValidated, unknown>): Promise<Result<EventoResultType>> => {
    const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");
    const { userSlug, appSlug, dbName, docId, key, bearer } = ctx.validated;

    // 1. Resolve user identity (best-effort — anonymous reads are valid for
    //    public-readable apps).
    const userId = bearer ? await verifyAnyBearer(vctx, bearer) : undefined;
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
    const row = await vctx.sql.db
      .select()
      .from(t)
      .where(and(eq(t.userSlug, userSlug), eq(t.appSlug, appSlug), eq(t.dbName, dbName), eq(t.docId, docId)))
      .orderBy(desc(t.seq))
      .limit(1)
      .then((r) => r[0]);
    if (!row || row.deleted === 1) {
      return sendErr(ctx, 404, `Document ${docId} not found`);
    }
    const data = row.data as Record<string, unknown> | null;
    const files = data && typeof data === "object" ? (data._files as Record<string, unknown> | undefined) : undefined;
    const meta = files?.[key];
    if (!isStoredFileMeta(meta)) {
      return sendErr(ctx, 404, `_files.${key} not found on document ${docId}`);
    }

    // 4. Resolve uploadId → assetURI via the audit table.
    const uploadsT = vctx.sql.tables.assetUploads;
    const upload = await vctx.sql.db
      .select({
        assetURI: uploadsT.assetURI,
        userSlug: uploadsT.userSlug,
        appSlug: uploadsT.appSlug,
        mimeType: uploadsT.mimeType,
      })
      .from(uploadsT)
      .where(eq(uploadsT.uploadId, meta.uploadId))
      .limit(1)
      .then((r) => r[0]);
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
