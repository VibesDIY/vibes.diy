import {
  EventoHandler,
  Result,
  Option,
  EventoResultType,
  HandleTriggerCtx,
  EventoResult,
  uint8array2stream,
  to_uint8,
  exception2Result,
} from "@adviser/cement";
import {
  EvtNewFsId,
  isResEnsureAppSlugError,
  isResEnsureAppSlugOk,
  isVibeCodeBlock,
  MsgBase,
  ReqEnsureAppSlug,
  ReqWithVerifiedAuth,
  ResEnsureAppSlug,
  ResEnsureAppSlugInvalid,
  ResProgress,
  StorageProgressInfo,
  VibeFile,
  VibesDiyError,
  W3CWebSocketEvent,
} from "@vibes.diy/api-types";
import { and, eq, notInArray, sql } from "drizzle-orm";
import type { AccessDescriptor } from "@vibes.diy/api-types";
import { type } from "arktype";
import { unwrapMsgBase as unwrapMsgBase } from "../unwrap-msg-base.js";
import { VibesApiSQLCtx } from "../types.js";
import { checkAuth as checkAuth } from "../check-auth.js";
import { ensureSlugBinding } from "../intern/ensure-slug-binding.js";
import { ensureApps } from "../intern/write-apps.js";
import { ensureAppMetadata } from "../intern/ensure-app-metadata.js";
import { ensurePushSeededChat } from "../intern/ensure-push-seeded-chat.js";
import { calcEntryPointUrl } from "../entry-point-utils.js";

const JS_PROTO_NAMES = new Set([
  "toString",
  "valueOf",
  "constructor",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString",
  "__proto__",
  "__defineGetter__",
  "__defineSetter__",
  "__lookupGetter__",
  "__lookupSetter__",
]);

// Build a preAllocate-friendly prompt from pushed code. Picks the first
// code-block (typically App.jsx), takes the first 50 lines, and labels
// it with the filename so the LLM has enough context to summarize the app
// for title / skills / icon-description.
function derivePromptFromFileSystem(fileSystem: readonly VibeFile[]): string | undefined {
  const codeBlock = fileSystem.find(isVibeCodeBlock);
  if (!codeBlock) return undefined;
  const headLines = codeBlock.content.split("\n").slice(0, 50).join("\n");
  return `Generate metadata for this app. Source file: ${codeBlock.filename}\n\n${headLines}`;
}

export interface EnsureAppSlugItemOptions {
  readonly onProgress?: (info: StorageProgressInfo) => void;
}

// ReqWithVerifiedAuth<ReqEnsureAppSlug>
export async function ensureAppSlugItem(
  vctx: VibesApiSQLCtx,
  req: ReqWithVerifiedAuth<ReqEnsureAppSlug>,
  opts?: EnsureAppSlugItemOptions
): Promise<Result<ResEnsureAppSlug>> {
  // Reject if no code files provided — an app needs at least one .jsx/.js/.ts/.tsx
  const hasCodeFile = req.fileSystem.some((f) => f.type === "code-block");
  if (!hasCodeFile) {
    return Result.Ok({
      type: "vibes.diy.res-error",
      error: {
        message: "No code files (.jsx, .js, .ts, .tsx) in fileSystem. An app requires at least one code file.",
        code: "app-slug-invalid",
      },
    } satisfies ResEnsureAppSlugInvalid);
  }

  const rAppSlugBinding = await ensureSlugBinding(vctx, {
    claims: req._auth.verifiedAuth.claims,
    userId: req._auth.verifiedAuth.claims.userId,
    appSlug: req.appSlug,
    ownerHandle: req.ownerHandle,
  });
  if (rAppSlugBinding.isErr()) {
    return Result.Err(rAppSlugBinding);
  }
  const writeAppSlugsOp: {
    fsItem: VibeFile;
    assetOp: {
      data: string | Uint8Array;
    };
  }[] = [];
  for (const fsItem of req.fileSystem) {
    // console.log(`ensureAppSlugItem fsItem:`, fsItem);
    switch (fsItem.type) {
      case "code-block":
      case "str-asset-block":
      case "uint8-asset-block":
        {
          writeAppSlugsOp.push({
            fsItem,
            assetOp: { data: fsItem.content },
          });
        }
        break;
      case "uint8-asset-ref":
      case "code-ref":
      case "str-asset-ref":
      default:
        // needs to rewind content from ref
        return Result.Err(`unsupported file system item type: ${fsItem.type}`);
    }
  }
  const rStorageResults = await vctx.storage.ensure(
    { onProgress: opts?.onProgress },
    ...writeAppSlugsOp.map((op) => uint8array2stream(to_uint8(op.assetOp.data)))
  );
  if (rStorageResults.some((r) => r.isErr())) {
    return Result.Err(
      `failed to store one or more assets: ${rStorageResults.map((r) => (r.isErr() ? r.Err().message : "ok")).join(", ")}`
    );
  }
  const fullFileSystem = rStorageResults.map((op, idx) => ({
    vibeFileItem: writeAppSlugsOp[idx].fsItem,
    storage: op.Ok(),
  }));

  const rEnsure = await ensureApps(
    vctx,
    { env: req.env ?? {}, mode: req.mode, userId: req._auth.verifiedAuth.claims.userId },
    rAppSlugBinding.Ok(),
    fullFileSystem
  );
  if (rEnsure.isErr()) {
    return Result.Err(rEnsure);
  }
  if (isResEnsureAppSlugError(rEnsure.Ok())) {
    return Result.Ok(rEnsure.Ok());
  }
  const ensured = rEnsure.Ok();
  if (!isResEnsureAppSlugOk(ensured)) {
    return Result.Err(`Expected ensureApps to return ResEnsureAppSlugOk on success, got ${JSON.stringify(ensured)}`);
  }

  // Upsert AccessFunctionBindings if access.js was pushed
  const accessJsEntry = fullFileSystem.find(
    (e) => e.vibeFileItem.filename === "/access.js" || e.vibeFileItem.filename.endsWith("/access.js")
  );

  const tAfb = vctx.sql.tables.accessFunctionBindings;

  if (accessJsEntry) {
    const cid = accessJsEntry.storage.cid;
    if (!cid) {
      console.error(`ensureAppSlugItem: access.js has no CID for ${ensured.ownerHandle}/${ensured.appSlug}`);
    } else {
      try {
        // Extract named export function names via regex from in-memory content
        const item = accessJsEntry.vibeFileItem;
        const accessJsSource: string | undefined =
          item.type === "code-block" || item.type === "str-asset-block" ? (item.content as string) : undefined;

        const exportNames: string[] = [];
        if (accessJsSource) {
          const fnPattern = /export\s+function\s+(\w+)/g;
          let match: RegExpExecArray | null;
          while ((match = fnPattern.exec(accessJsSource)) !== null) {
            const name = match[1];
            if (name && !JS_PROTO_NAMES.has(name) && name !== "default") {
              exportNames.push(name);
            }
          }
        }

        // Snapshot existing CIDs before upsert to detect changes for backfill
        const existingBindings = await vctx.sql.db
          .select({ dbName: tAfb.dbName, accessFnCid: tAfb.accessFnCid })
          .from(tAfb)
          .where(and(eq(tAfb.userSlug, ensured.ownerHandle), eq(tAfb.appSlug, ensured.appSlug)));
        const oldCids = new Map(existingBindings.map((b) => [b.dbName, b.accessFnCid]));

        if (exportNames.length > 0) {
          // Upsert one row per export
          for (const dbName of exportNames) {
            await vctx.sql.db
              .insert(tAfb)
              .values({
                userSlug: ensured.ownerHandle,
                appSlug: ensured.appSlug,
                dbName,
                accessFnCid: cid,
                accessFnAssetUri: accessJsEntry.storage.getURL,
                updated: new Date().toISOString(),
              })
              .onConflictDoUpdate({
                target: [tAfb.userSlug, tAfb.appSlug, tAfb.dbName],
                set: {
                  accessFnCid: cid,
                  accessFnAssetUri: accessJsEntry.storage.getURL,
                  updated: new Date().toISOString(),
                },
              });
          }

          // Delete stale rows (exports removed from access.js)
          await vctx.sql.db
            .delete(tAfb)
            .where(
              and(eq(tAfb.userSlug, ensured.ownerHandle), eq(tAfb.appSlug, ensured.appSlug), notInArray(tAfb.dbName, exportNames))
            );

          // Backfill AccessFnOutputs for dbNames where CID changed or is new (#2101)
          const invokeAccessFn = vctx.invokeAccessFn;
          if (invokeAccessFn) {
            const changedDbNames = exportNames.filter((name) => oldCids.get(name) !== cid);
            if (changedDbNames.length > 0) {
              // Fetch source once — same CID for all exports from this access.js.
              // Prefer in-memory content (already available), fall back to storage.
              let backfillSource: string | undefined = accessJsSource;
              if (!backfillSource && accessJsEntry.storage.getURL) {
                const rFetch = await vctx.storage.fetch(accessJsEntry.storage.getURL);
                if (rFetch.type === "fetch.ok") {
                  const reader = rFetch.data.getReader();
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
                  backfillSource = new TextDecoder().decode(merged);
                }
              }

              if (backfillSource) {
                const tDocs = vctx.sql.tables.appDocuments;
                const tOutputs = vctx.sql.tables.accessFnOutputs;

                for (const dbName of changedDbNames) {
                  const t0 = Date.now();
                  let docsTotal = 0;
                  let docsUpserted = 0;
                  let docsForbiddenSkipped = 0;
                  let invokeErrors = 0;
                  let upsertErrors = 0;

                  const allRows = await vctx.sql.db
                    .select({ docId: tDocs.docId, data: tDocs.data, deleted: tDocs.deleted })
                    .from(tDocs)
                    .where(
                      and(eq(tDocs.ownerHandle, ensured.ownerHandle), eq(tDocs.appSlug, ensured.appSlug), eq(tDocs.dbName, dbName))
                    )
                    .orderBy(sql`${tDocs.docId}, ${tDocs.seq}`);

                  const latest = new Map<string, (typeof allRows)[0]>();
                  for (const row of allRows) {
                    latest.set(row.docId, row);
                  }

                  for (const [docId, row] of latest) {
                    if (row.deleted === 1) continue;
                    docsTotal++;

                    const rInvoke = await exception2Result(() =>
                      invokeAccessFn({
                        cid,
                        doc: row.data,
                        oldDoc: null,
                        user: null,
                        source: backfillSource,
                        grantState: { members: {}, roleGrants: {}, userGrants: {} },
                      })
                    );

                    if (rInvoke.isErr()) {
                      invokeErrors++;
                      console.warn(
                        `backfill: access fn threw for ${ensured.ownerHandle}/${ensured.appSlug}/${dbName}/${docId}:`,
                        rInvoke.Err()
                      );
                      continue;
                    }

                    const invokeResult = rInvoke.Ok();
                    if ("forbidden" in invokeResult) {
                      docsForbiddenSkipped++;
                      continue;
                    }

                    const accessResult = invokeResult as AccessDescriptor;
                    const outputHasGrants =
                      (accessResult.members && Object.keys(accessResult.members).length > 0) ||
                      (accessResult.grant?.users && Object.keys(accessResult.grant.users).length > 0) ||
                      (accessResult.grant?.roles && Object.keys(accessResult.grant.roles).length > 0) ||
                      (accessResult.grant?.public && accessResult.grant.public.length > 0)
                        ? 1
                        : 0;

                    const rUpsert = await exception2Result(() =>
                      vctx.sql.db
                        .insert(tOutputs)
                        .values({
                          userSlug: ensured.ownerHandle,
                          appSlug: ensured.appSlug,
                          dbName,
                          docId,
                          fnCid: cid,
                          output: JSON.stringify(accessResult),
                          hasGrants: outputHasGrants,
                        })
                        .onConflictDoUpdate({
                          target: [tOutputs.userSlug, tOutputs.appSlug, tOutputs.dbName, tOutputs.docId],
                          set: {
                            fnCid: cid,
                            output: JSON.stringify(accessResult),
                            hasGrants: outputHasGrants,
                          },
                        })
                    );
                    if (rUpsert.isErr()) {
                      upsertErrors++;
                      console.warn(
                        `backfill: output upsert failed for ${ensured.ownerHandle}/${ensured.appSlug}/${dbName}/${docId}:`,
                        rUpsert.Err()
                      );
                    } else {
                      docsUpserted++;
                    }
                  }

                  console.info(
                    `backfill: ${ensured.ownerHandle}/${ensured.appSlug}/${dbName} cid=${cid.slice(0, 8)}` +
                      ` total=${docsTotal} upserted=${docsUpserted} forbidden=${docsForbiddenSkipped}` +
                      ` invokeErr=${invokeErrors} upsertErr=${upsertErrors} elapsed=${Date.now() - t0}ms`
                  );
                }
              }
            }
          }
        } else {
          // No valid exports → delete all bindings
          await vctx.sql.db.delete(tAfb).where(and(eq(tAfb.userSlug, ensured.ownerHandle), eq(tAfb.appSlug, ensured.appSlug)));
        }
      } catch (err: unknown) {
        console.warn(`ensureAppSlugItem: failed to process access.js for ${ensured.ownerHandle}/${ensured.appSlug}:`, err);
      }
    }
  } else {
    // No access.js → delete all bindings for this app
    try {
      await vctx.sql.db.delete(tAfb).where(and(eq(tAfb.userSlug, ensured.ownerHandle), eq(tAfb.appSlug, ensured.appSlug)));
    } catch (err: unknown) {
      console.warn(
        `ensureAppSlugItem: failed to clean up AccessFunctionBindings for ${ensured.ownerHandle}/${ensured.appSlug}:`,
        err
      );
    }
  }

  // let wrapperUrl: string;
  // if (req.mode === "production") {
  //   wrapperUrl = `${vctx.params.wrapperBaseUrl}/${res.Ok().ownerHandle}/${res.Ok().appSlug}/${res.Ok().fsId}`;
  // } else {
  //   wrapperUrl = `${vctx.params.wrapperBaseUrl}/${res.Ok().ownerHandle}/${res.Ok().appSlug}/${res.Ok().fsId}`;
  // }
  const entryPointUrl = calcEntryPointUrl({
    ...vctx.params.vibes.svc,
    bindings: {
      ownerHandle: ensured.ownerHandle,
      appSlug: ensured.appSlug,
      fsId: ensured.fsId,
    },
  });
  if (ensured.fsId) {
    // console.log(`Posting evt-new-fs-id for fsId ${ensured.fsId}, entryPointUrl: ${entryPointUrl}`);
    await vctx.postQueue({
      payload: {
        type: "vibes.diy.evt-new-fs-id",
        ownerHandle: ensured.ownerHandle,
        appSlug: ensured.appSlug,
        fsId: ensured.fsId,
        vibeUrl: entryPointUrl,
        sessionToken: "offline",
        mode: req.mode,
      },
      tid: "queue-event",
      src: "ensureAppSlugItem",
      dst: "vibes-service",
      ttl: 1,
    } satisfies MsgBase<EvtNewFsId>);
  }

  // First-push metadata invariant: derive a prompt from the pushed code
  // and run preAllocate so cli-pushed apps get the same active.title /
  // active.skills / active.icon-description / icon-gen as chat-created
  // apps. Idempotent — re-pushes skip the LLM call when active.title
  // already exists.
  const metadataPrompt = derivePromptFromFileSystem(req.fileSystem);
  if (metadataPrompt) {
    const rMetadata = await ensureAppMetadata(vctx, {
      userId: req._auth.verifiedAuth.claims.userId,
      ownerHandle: ensured.ownerHandle,
      appSlug: ensured.appSlug,
      prompt: metadataPrompt,
      src: "ensureAppSlugItem",
    });
    if (rMetadata.isErr()) {
      console.warn(`ensureAppSlugItem: ensureAppMetadata failed for ${ensured.ownerHandle}/${ensured.appSlug}:`, rMetadata.Err());
    }
  }

  // First-push chat invariant: create a ChatContext + seed a ChatSection
  // carrying the pushed files as a synthetic assistant turn, so that any
  // follow-up call (CLI `edit`, web continuation) opens the chat with
  // file state already in the LLM-side conversation history. Without this,
  // openChat-by-appSlug creates a fresh empty chat and the next prompt
  // hits a context-free LLM (issue #1667). Idempotent — re-pushes find
  // the existing chat and skip seeding.
  const rSeed = await ensurePushSeededChat(vctx, {
    userId: req._auth.verifiedAuth.claims.userId,
    ownerHandle: ensured.ownerHandle,
    appSlug: ensured.appSlug,
    fsId: ensured.fsId,
    mode: req.mode,
    fileSystem: req.fileSystem,
  });
  if (rSeed.isErr()) {
    console.warn(`ensureAppSlugItem: ensurePushSeededChat failed for ${ensured.ownerHandle}/${ensured.appSlug}:`, rSeed.Err());
  }
  return Result.Ok({
    type: "vibes.diy.res-ensure-app-slug",
    appSlug: ensured.appSlug,
    ownerHandle: ensured.ownerHandle,
    // userId: req._auth.verifiedAuth.claims.userId,
    // promptId: req.promptId,
    // chatId: req.chatId,
    mode: req.mode,
    fsId: ensured.fsId,
    env: req.env ?? {},
    fileSystem: ensured.fileSystem,
    // wrapperUrl,
    entryPointUrl,
  });
}

export const ensureAppSlugItemEvento: EventoHandler<
  W3CWebSocketEvent,
  MsgBase<ReqEnsureAppSlug>,
  ResEnsureAppSlug | VibesDiyError
> = {
  hash: "ensure-appSlug-item",
  validate: unwrapMsgBase(async (msg: MsgBase) => {
    // async (ctx): Promise<Result<Option<ReqEnsureAppSlug>>> => {
    const ret = ReqEnsureAppSlug(msg.payload);
    // console.log("validate ensureAppSlugItem", payload, ret);
    if (ret instanceof type.errors) {
      return Result.Ok(Option.None());
    }
    return Result.Ok(
      Option.Some({
        ...msg,
        payload: ret,
      })
    );
  }),
  handle: checkAuth(
    async (
      ctx: HandleTriggerCtx<W3CWebSocketEvent, MsgBase<ReqWithVerifiedAuth<ReqEnsureAppSlug>>, ResEnsureAppSlug | VibesDiyError>
    ): Promise<Result<EventoResultType>> => {
      const req = ctx.validated.payload;
      const vctx = ctx.ctx.getOrThrow<VibesApiSQLCtx>("vibesApiCtx");

      // Emit a progress envelope back on the same connection per real
      // R2 part-complete/asset-stored signal. The client doesn't match this
      // to a `request()` waiter (no isResXxx hit), but receiving it resets
      // the idle timeout — keeping multi-MB pushes alive without a fixed
      // wall-clock bump.
      function emitProgress(info: StorageProgressInfo): void {
        const progress: ResProgress = {
          type: "vibes.diy.res-progress",
          stage: info.stage,
          ...(info.bytes === undefined ? {} : { bytes: info.bytes }),
          ...(info.partNumber === undefined ? {} : { partNumber: info.partNumber }),
        };
        // Fire-and-forget: send returns a promise but we don't want to slow
        // the upload by awaiting it (and the caller is the storage layer).
        ctx.send.send(ctx, progress).catch((e: unknown) => {
          console.error("ensureAppSlugItem progress emit failed:", e);
        });
      }

      const rAppSlugBinding = await ensureAppSlugItem(vctx, req, { onProgress: emitProgress });
      if (rAppSlugBinding.isErr()) {
        return Result.Err(rAppSlugBinding);
      }

      // const res = rAppSlugBinding.Ok();
      // if (isResEnsureAppSlugOk(res)) {
      // console.log("ensureAppSlugItem success", req.appSlug, '===', res.appSlug, req.ownerHandle, '===', res.ownerHandle);
      // }

      await ctx.send.send(ctx, rAppSlugBinding.Ok());
      return Result.Ok(EventoResult.Continue);
    }
  ),
};
