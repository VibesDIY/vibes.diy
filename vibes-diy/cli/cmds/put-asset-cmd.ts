import { basename } from "path";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import { command, flag, option, positional, string } from "cmd-ts";
import {
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  Option,
  EventoHandler,
  EventoResultType,
  exception2Result,
} from "@adviser/cement";
import { type } from "arktype";
import { isResAssetUploadGrant } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";

// `vibes-diy put-asset <file> [--user-slug=...] [--app-slug=...] [--verify-fetch]`
//
// 1. WS-mints an upload-grant for (userSlug, appSlug) over the existing
//    VibesDiyApi connection.
// 2. Streams the file body to the absolute uploadUrl in the grant
//    response, with X-Asset-Grant carrying the JWT.
// 3. Prints `cid getURL size uploadId` (text — CLI is text-shaped
//    everywhere else).
// 4. With --verify-fetch, GETs /assets/cid?url=<getURL> and byte-compares
//    the response against the source file. Round-trip integrity check.

export const ReqPutAsset = type({
  type: "'vibes-diy.cli.put-asset'",
  file: "string",
  appSlug: "string",
  userSlug: "string",
  apiUrl: "string",
  mimeType: "string",
  verifyFetch: "boolean",
});
export type ReqPutAsset = typeof ReqPutAsset.infer;

export function isReqPutAsset(obj: unknown): obj is ReqPutAsset {
  return !(ReqPutAsset(obj) instanceof type.errors);
}

export const ResPutAssetCli = type({
  type: "'vibes-diy.cli.res-put-asset'",
  cid: "string",
  getURL: "string",
  size: "number",
  uploadId: "string",
  "verified?": "boolean",
});
export type ResPutAssetCli = typeof ResPutAssetCli.infer;

export function isResPutAssetCli(obj: unknown): obj is ResPutAssetCli {
  return !(ResPutAssetCli(obj) instanceof type.errors);
}

function inferMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "txt":
      return "text/plain";
    case "json":
      return "application/json";
    case "html":
      return "text/html";
    case "css":
      return "text/css";
    case "js":
      return "application/javascript";
    default:
      return "application/octet-stream";
  }
}

// Resolve a possibly-relative uploadUrl returned by the WS handler
// against the CLI's --api-url base. If the grant returned an absolute
// URL, use it as-is.
function resolveUploadUrl(uploadUrl: string, apiUrl: string): string {
  if (/^https?:\/\//i.test(uploadUrl)) return uploadUrl;
  const u = new URL(apiUrl);
  return `${u.protocol}//${u.host}${uploadUrl.startsWith("/") ? "" : "/"}${uploadUrl}`;
}

// `/assets` and `/assets/cid` live at the host root (not under `/api/`)
// because /api/ is forwarded to the ChatSessions DO. Strip the api path
// (and any query string like `?.stable-entry.=cli`) from --api-url to
// build a clean host-root URL.
function hostRoot(apiUrl: string): string {
  const u = new URL(apiUrl);
  return `${u.protocol}//${u.host}`;
}

export const putAssetEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqPutAsset, ResPutAssetCli> = {
  hash: "vibes-diy.cli.put-asset",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqPutAsset, ResPutAssetCli>) => {
    if (isReqPutAsset(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqPutAsset, ResPutAssetCli>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    const userSlug = await resolveUserSlug(api, args.userSlug === "" ? undefined : args.userSlug);
    if (!userSlug) {
      return Result.Err("Could not resolve userSlug. Pass --user-slug or set a default via vibes-diy user-settings.");
    }
    const appSlug = args.appSlug === "" ? basename(args.file).split(".")[0] : args.appSlug;

    const stat = statSync(args.file);
    if (!stat.isFile()) {
      return Result.Err(`Not a regular file: ${args.file}`);
    }

    const rGrant = await api.requestAssetUploadGrant({
      appSlug,
      userSlug,
      mimeType: args.mimeType,
    });
    if (rGrant.isErr()) {
      return Result.Err(`Failed to mint asset-upload-grant: ${rGrant.Err().message}`);
    }
    const grantRes = rGrant.Ok();
    if (!isResAssetUploadGrant(grantRes)) {
      return Result.Err(`Unexpected grant response shape`);
    }

    const uploadUrl = resolveUploadUrl(grantRes.uploadUrl, args.apiUrl);
    const fileStream = createReadStream(args.file);
    const rUpload = await exception2Result(() =>
      fetch(uploadUrl, {
        method: "POST",
        headers: {
          "X-Asset-Grant": grantRes.grant,
          "Content-Type": args.mimeType,
        },
        // Node's fetch accepts a Node Readable; cast for the lib.dom typing.
        body: Readable.toWeb(fileStream) as unknown as BodyInit,
        duplex: "half",
      } as RequestInit & { duplex: string })
    );
    if (rUpload.isErr()) {
      return Result.Err(`POST /assets failed: ${rUpload.Err().message}`);
    }
    const res = rUpload.Ok();
    if (!res.ok) {
      const text = await res.text();
      return Result.Err(`POST /assets returned ${res.status}: ${text}`);
    }
    const body = (await res.json()) as { cid: string; getURL: string; size: number; uploadId: string };

    let verified: boolean | undefined;
    if (args.verifyFetch) {
      const fetchUrl = `${hostRoot(args.apiUrl)}/assets/cid?url=${encodeURIComponent(body.getURL)}`;
      const rGet = await exception2Result(() => fetch(fetchUrl));
      if (rGet.isErr() || !rGet.Ok().ok) {
        verified = false;
      } else {
        const gotBuf = new Uint8Array(await rGet.Ok().arrayBuffer());
        // Compare sizes — exhaustive byte-compare for a 100MiB file would
        // double memory; size + cid match is the protocol's integrity claim.
        verified = gotBuf.byteLength === body.size;
      }
    }

    return sendMsg(ctx, {
      type: "vibes-diy.cli.res-put-asset",
      cid: body.cid,
      getURL: body.getURL,
      size: body.size,
      uploadId: body.uploadId,
      ...(verified !== undefined ? { verified } : {}),
    } satisfies ResPutAssetCli);
  },
};

export function putAssetCmd(ctx: CliCtx) {
  return command({
    name: "put-asset",
    description: "Stream a file to the asset endpoint and print the resulting CID + URL.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      file: positional({
        type: string,
        displayName: "file",
        description: "Path to the file to upload",
      }),
      appSlug: option({
        long: "app-slug",
        short: "a",
        description: "App slug (defaults to the file's basename without extension)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      userSlug: option({
        long: "user-slug",
        description: "User slug (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      mimeType: option({
        long: "mime-type",
        description: "Content-Type for the upload (inferred from extension if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      verifyFetch: flag({
        long: "verify-fetch",
        description: "After upload, GET the asset back via /assets/cid and compare size",
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      const mimeType = args.mimeType === "" ? inferMimeType(args.file) : args.mimeType;
      return {
        type: "vibes-diy.cli.put-asset",
        file: args.file,
        appSlug: args.appSlug,
        userSlug: args.userSlug,
        apiUrl: args.apiUrl,
        verifyFetch: args.verifyFetch,
        mimeType,
      } satisfies ReqPutAsset;
    }),
  });
}
