import { Result, exception2Result, uint8array2stream, to_uint8 } from "@adviser/cement";
import { isVibeCodeBlock, type VibeFile } from "@vibes.diy/api-types";
import type { PromptContextSql } from "@vibes.diy/call-ai-v2";
import type { VibesApiSQLCtx } from "../types.js";
import { ensureApps } from "./write-apps.js";
import { seedChatSection } from "./seed-chat-section.js";
import { ensureSlugBinding } from "./ensure-slug-binding.js";

export interface AppendTurnOpts {
  readonly chatId: string;
  readonly userId: string;
  readonly userSlug: string;
  readonly appSlug: string;
  readonly fileSystem: readonly VibeFile[];
  readonly userMessage?: string;
  readonly promptId?: string;
  readonly fsId?: string;
  readonly mode?: "dev" | "production";
  readonly timestamp?: Date;
}

export interface AppendTurnResult {
  readonly promptId: string;
  readonly fsId: string;
}

/**
 * Append one synthetic turn to an existing chat. Single shared implementation
 * for test seeding AND any future production caller that wants to seed a
 * turn without driving through the LLM dispatch loop.
 *
 * Inserts:
 *   1. Apps row (via ensureApps — same production write function used on push/edit).
 *   2. PromptContexts row (chatId → fsId pointer; zero tokens; synthetic ref).
 *   3. ChatSections row (blocks from seedChatSection / buildSeedSectionBlocks).
 *
 * Drift protection: ensureApps is the production write function; if the Apps
 * schema changes, this function breaks at the same compile-time point production
 * does. The PromptContexts insert mirrors the shape used by ensurePushSeededChat —
 * any divergence between the two is a real bug in production seeding.
 */
export async function appendTurnToChat(vctx: VibesApiSQLCtx, opts: AppendTurnOpts): Promise<Result<AppendTurnResult>> {
  const now = opts.timestamp ?? new Date();
  const mode = opts.mode ?? "dev";
  const promptId = opts.promptId ?? vctx.sthis.nextId(12).str;

  // Step 1: Resolve slug binding using the production slug-binding function.
  // The app was already created via ensureAppSlug; this call is idempotent and
  // returns the existing binding for (userId, userSlug, appSlug).
  const syntheticClaims = {
    userId: opts.userId,
    role: "user",
    sub: `synthetic-${opts.userId}`,
    params: {
      email: `${opts.userId}@synthetic.vibes.diy`,
      email_verified: true as const,
      first: "Synthetic",
      last: "User",
      name: "Synthetic User",
      image_url: "",
      public_meta: undefined,
      nick: opts.userSlug,
    },
  };

  const rBinding = await ensureSlugBinding(vctx, {
    claims: syntheticClaims,
    userId: opts.userId,
    userSlug: opts.userSlug,
    appSlug: opts.appSlug,
  });
  if (rBinding.isErr()) return Result.Err(`appendTurnToChat: ensureSlugBinding failed: ${rBinding.Err().message}`);
  const binding = rBinding.Ok();

  // Step 2: Push file content to storage and collect StorageResult[].
  // This mirrors what ensure-app-slug-item.ts does before calling ensureApps.
  const writeOps = opts.fileSystem.flatMap((f) => {
    if (f.type !== "code-block" && f.type !== "str-asset-block" && f.type !== "uint8-asset-block") return [];
    return [{ fsItem: f, data: (f as { content: string | Uint8Array }).content }];
  });

  if (writeOps.length === 0) {
    return Result.Err("appendTurnToChat: no storable files in fileSystem");
  }

  const rStorageResults = await vctx.storage.ensure({}, ...writeOps.map((op) => uint8array2stream(to_uint8(op.data))));
  if (rStorageResults.some((r) => r.isErr())) {
    return Result.Err(
      `appendTurnToChat: storage.ensure failed: ${rStorageResults.map((r) => (r.isErr() ? r.Err().message : "ok")).join(", ")}`
    );
  }

  const fullFileSystem = rStorageResults.map((op, idx) => ({
    vibeFileItem: writeOps[idx].fsItem,
    storage: op.Ok(),
  }));

  // Step 3: Upsert the Apps row using the production ensureApps function.
  // Synthetic auth carries the userId through to checkMaxAppsPerUser.
  const syntheticReq = {
    type: "vibes.diy.req-ensure-app-slug" as const,
    auth: { type: "device-id" as const, token: "synthetic" },
    _auth: {
      type: "VerifiedAuthResult" as const,
      inDashAuth: { type: "device-id" as const, token: "synthetic" },
      verifiedAuth: {
        type: "clerk" as const,
        claims: syntheticClaims,
      },
    },
    mode,
    env: {} as Record<string, string>,
    fileSystem: opts.fileSystem as VibeFile[],
    userSlug: opts.userSlug,
    appSlug: opts.appSlug,
  };

  const rApps = await ensureApps(
    vctx,
    // The req shape satisfies ReqWithVerifiedAuth<ReqEnsureAppSlug>; cast needed
    // because the synthetic auth token bypasses the real DashAuthType validator.
    syntheticReq as Parameters<typeof ensureApps>[1],
    binding,
    fullFileSystem
  );
  if (rApps.isErr()) return Result.Err(`appendTurnToChat: ensureApps failed: ${rApps.Err().message}`);

  const appsResult = rApps.Ok();
  // ensureApps may return an error-shaped ResEnsureAppSlug (max-apps, invalid, etc.)
  if (!("fsId" in appsResult) || typeof appsResult.fsId !== "string") {
    return Result.Err(`appendTurnToChat: ensureApps returned non-ok result: ${JSON.stringify(appsResult)}`);
  }
  const fsId = appsResult.fsId;

  // Step 4: Insert PromptContexts row mirroring ensurePushSeededChat shape.
  const refValue: PromptContextSql = {
    type: "prompt.usage.sql",
    usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
    fsRef: { fsId, mode, appSlug: opts.appSlug, userSlug: opts.userSlug },
  };
  const rPC = await exception2Result(() =>
    vctx.sql.db.insert(vctx.sql.tables.promptContexts).values({
      userId: opts.userId,
      chatId: opts.chatId,
      promptId,
      fsId,
      nethash: vctx.netHash(),
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      ref: refValue,
      created: now.toISOString(),
    })
  );
  if (rPC.isErr()) return Result.Err(`appendTurnToChat: promptContexts insert failed: ${rPC.Err().message}`);

  // Step 5: Insert ChatSections row with synthetic blocks via seedChatSection.
  const seedFiles = opts.fileSystem.flatMap((f) => {
    if (!isVibeCodeBlock(f) || typeof f.content !== "string") return [];
    const dot = f.filename.lastIndexOf(".");
    const lang = dot >= 0 ? f.filename.slice(dot + 1).toLowerCase() : "txt";
    return [{ path: f.filename, lang, content: f.content }];
  });

  const userText = opts.userMessage ?? `synthetic turn @ ${now.toISOString()}`;
  const blockId = vctx.sthis.nextId(12).str;

  const rSeed = await seedChatSection(vctx, {
    chatId: opts.chatId,
    promptId,
    blockId,
    streamId: blockId,
    userText,
    files: seedFiles,
    timestamp: now,
    fsRef: { fsId, mode, appSlug: opts.appSlug, userSlug: opts.userSlug },
  });
  if (rSeed.isErr()) return Result.Err(`appendTurnToChat: seedChatSection failed: ${rSeed.Err()}`);

  return Result.Ok({ promptId, fsId });
}
