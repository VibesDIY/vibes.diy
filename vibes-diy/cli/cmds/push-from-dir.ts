import { readdir, readFile } from "fs/promises";
import { extname, join } from "path";
import { Result, exception2Result, BuildURI, HandleTriggerCtx } from "@adviser/cement";
import { type } from "arktype";
import { resEnsureAppSlug, isResEnsureAppSlugOk, ResEnsureAppSlug } from "@vibes.diy/api-types";
import type { VibeFile } from "@vibes.diy/api-types";
import { sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { lintVibeFiles } from "./lint-vibe.js";

const CODE_EXTENSIONS = new Set(["jsx", "js", "ts", "tsx"]);
const ALLOWED_EXTENSIONS = new Set([...CODE_EXTENSIONS, "css", "html", "json", "md", "txt", "svg"]);

export async function readProjectFiles(dir: string): Promise<VibeFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: VibeFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const lang = extname(entry.name).toLowerCase().slice(1);
    if (ALLOWED_EXTENSIONS.has(lang) === false) continue;

    const content = await readFile(join(dir, entry.name), "utf-8");
    const filename = `/${entry.name}`;

    if (CODE_EXTENSIONS.has(lang)) {
      files.push({ type: "code-block", lang, content, filename });
    } else {
      files.push({ type: "str-asset-block", content, filename });
    }
  }
  return files;
}

export interface PushFromDirOptions {
  dir: string;
  mode: "production" | "dev";
  appSlug: string;
  ownerHandle: string | undefined;
  instantJoin: boolean;
  publicAccess?: boolean;
  apiUrl: string;
  api: {
    ensureAppSlug: (req: {
      mode: "production" | "dev";
      appSlug: string;
      ownerHandle: string | undefined;
      fileSystem: VibeFile[];
    }) => Promise<Result<unknown>>;
    ensureAppSettings: (req: {
      appSlug: string;
      ownerHandle: string;
      request?: { enable: boolean; autoAcceptRole?: "viewer" };
      publicAccess?: { enable: boolean };
    }) => Promise<
      Result<{ settings: { entry: { enableRequest?: { autoAcceptRole?: string }; publicAccess?: { enable?: boolean } } } }>
    >;
  };
  ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, unknown, unknown>;
}

export interface PushFromDirOk {
  result: ResEnsureAppSlug;
  publicUrl: string;
}

export async function pushFromDir(opts: PushFromDirOptions): Promise<Result<PushFromDirOk>> {
  const rFiles = await exception2Result(() => readProjectFiles(opts.dir));
  if (rFiles.isErr()) {
    return Result.Err(`Failed to read files: ${rFiles.Err().message}`);
  }
  const files = rFiles.Ok();
  if (files.length === 0) {
    return Result.Err("No files found in current directory. Expected at least App.jsx.");
  }
  if (!files.some((f) => f.type === "code-block")) {
    return Result.Err("No code files (.jsx, .js, .ts, .tsx) found in current directory. Expected at least App.jsx.");
  }

  const lint = lintVibeFiles(files);
  for (const w of lint.warnings) await sendProgress(opts.ctx, "warn", w);
  if (lint.errors.length > 0) {
    return Result.Err(`Lint failed:\n  - ${lint.errors.join("\n  - ")}`);
  }

  const rResult = await opts.api.ensureAppSlug({
    mode: opts.mode,
    appSlug: opts.appSlug,
    ownerHandle: opts.ownerHandle,
    fileSystem: files,
  });
  if (rResult.isErr()) {
    const pushErr = rResult.Err();
    return Result.Err(`Push failed: ${typeof pushErr === "object" ? JSON.stringify(pushErr) : String(pushErr)}`);
  }

  const result = resEnsureAppSlug(rResult.Ok());
  if (result instanceof type.errors) {
    return Result.Err(`type mismatch: ${result.summary}`);
  }

  if (opts.ownerHandle) {
    const rSettings = await opts.api.ensureAppSettings({
      appSlug: opts.appSlug,
      ownerHandle: opts.ownerHandle,
      request: { enable: true, autoAcceptRole: opts.instantJoin ? "viewer" : undefined },
    });
    if (rSettings.isErr()) {
      const settErr = rSettings.Err();
      await sendProgress(
        opts.ctx,
        "warn",
        `Warning: failed to update app settings: ${typeof settErr === "object" ? JSON.stringify(settErr) : String(settErr)}`
      );
    } else {
      const instantJoin = rSettings.Ok().settings.entry.enableRequest?.autoAcceptRole;
      await sendProgress(opts.ctx, "info", `Requests enabled${instantJoin ? " (instant-join)" : ""}`);
    }

    // ensureAppSettings is one-slice-per-call (see api/svc/public/ensure-app-settings.ts
    // switch on req shape) so publicAccess needs a separate call from the
    // request-grant call above. Both are no-ops when already set, idempotent.
    if (opts.publicAccess) {
      const rPub = await opts.api.ensureAppSettings({
        appSlug: opts.appSlug,
        ownerHandle: opts.ownerHandle,
        publicAccess: { enable: true },
      });
      if (rPub.isErr()) {
        const pubErr = rPub.Err();
        await sendProgress(
          opts.ctx,
          "warn",
          `Warning: failed to enable publicAccess: ${typeof pubErr === "object" ? JSON.stringify(pubErr) : String(pubErr)}`
        );
      } else {
        await sendProgress(opts.ctx, "info", "publicAccess enabled (anonymous reads allowed)");
      }
    }
  }

  let publicUrl = "";
  if (isResEnsureAppSlugOk(result)) {
    publicUrl = BuildURI.from(opts.apiUrl)
      .pathname(`/vibe/${result.ownerHandle}/${result.appSlug}`)
      .cleanParams("@stable-entry@", ".stable-entry.")
      .toString();
    await sendProgress(opts.ctx, "info", `Deployed: ${result.ownerHandle}/${result.appSlug}`);
    await sendProgress(opts.ctx, "info", `URL: ${publicUrl}`);
  }

  return Result.Ok({ result, publicUrl });
}
