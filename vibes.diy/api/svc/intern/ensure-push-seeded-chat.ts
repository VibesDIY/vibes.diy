import { Result, exception2Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm/sql/expressions";
import { isVibeCodeBlock, type VibeFile } from "@vibes.diy/api-types";
import type { PromptContextSql } from "@vibes.diy/call-ai-v2";
import type { VibesApiSQLCtx } from "../types.js";
import { seedChatSection, type SeedFile } from "./seed-chat-section.js";

// Map VibeFile.filename → block-stream lang. The `block.code.begin/line/end`
// messages carry `lang` so the reconstructed assistant turn fences the
// content with the right language hint (```jsx, ```ts, ...). Default to
// "txt" for unknown extensions — the model still sees the code, just
// without the language tag.
function langForFilename(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "txt";
  const ext = filename.slice(dot + 1).toLowerCase();
  if (ext === "tsx" || ext === "jsx") return ext;
  if (ext === "ts" || ext === "js") return ext;
  if (ext === "css" || ext === "html" || ext === "json" || ext === "md") return ext;
  return "txt";
}

function toSeedFile(file: VibeFile): SeedFile | undefined {
  if (!isVibeCodeBlock(file)) return undefined;
  if (typeof file.content !== "string") return undefined;
  return { path: file.filename, lang: langForFilename(file.filename), content: file.content };
}

export interface EnsurePushSeededChatOpts {
  readonly userId: string;
  readonly userSlug: string;
  readonly appSlug: string;
  readonly fsId?: string;
  readonly mode: "dev" | "production";
  readonly fileSystem: readonly VibeFile[];
}

export interface EnsurePushSeededChatResult {
  readonly chatId: string;
  /**
   * - `"created"`: brand new chat — fresh ChatContext, PromptContext, and ChatSection inserted.
   * - `"repaired"`: ChatContext existed from a prior push whose section/context insert failed;
   *   we reused the chatId and inserted the missing rows. Detected via absence of ChatSections
   *   for the chatId.
   * - `"existing"`: chat is fully seeded (or has user-edit history beyond the seed); nothing
   *   inserted.
   */
  readonly state: "created" | "repaired" | "existing";
}

/**
 * Idempotent chat-seed for the `vibes-diy push` flow. If a ChatContext
 * already exists for (userId, userSlug, appSlug) AND a ChatSection is
 * present for that chatId, return untouched — that chat is fully seeded
 * or has accumulated real conversation history beyond the seed, either
 * of which we must not overwrite.
 *
 * If a ChatContext exists but the chatSections table has no row for it,
 * a prior seed attempt failed between the ChatContext insert and the
 * ChatSection insert. Recover by completing the missing inserts under
 * the existing chatId. Without this repair the chat would be stuck in a
 * half-seeded state forever — the caller logs and continues on failure,
 * so a transient DB error during the first push would otherwise leave
 * future pushes hitting the "existing" branch and skipping the seed.
 *
 * Seeded rows (all keyed off the same chatId / promptId):
 *
 * 1. ChatContexts: enables `openChat({mode:"chat"})` → `ensureChatId` to
 *    resolve the (userSlug, appSlug) pair back to a chatId. CLI `edit`
 *    (edit-cmd.ts) and the web continuation (chat.$userSlug.$appSlug.tsx)
 *    both use mode "chat" and this table. (Mode "app"/"img" goes through
 *    applicationChats via ensureApplicationChatId, but those are iframe
 *    sandbox flows, not user-editing.)
 * 2. PromptContexts: links chatId → fsId so `loadPriorFileSystem`
 *    (prompt-chat-section.ts) seeds `resolveCodeBlocksToFileSystem` from
 *    the pushed app. Without this row, the next turn's SEARCH/REPLACE
 *    blocks compose against an empty buffer and persist 0-byte files.
 * 3. ChatSections: carries the synthetic user-prompt + assistant code
 *    blocks that `reconstructConversationMessages` replays into the LLM
 *    history. Inserted LAST — its presence is what we use to detect
 *    that a previous attempt finished, so it must be the final write.
 */
export async function ensurePushSeededChat(
  vctx: VibesApiSQLCtx,
  opts: EnsurePushSeededChatOpts
): Promise<Result<EnsurePushSeededChatResult>> {
  const rExisting = await exception2Result(() =>
    vctx.sql.db
      .select({ chatId: vctx.sql.tables.chatContexts.chatId })
      .from(vctx.sql.tables.chatContexts)
      .where(
        and(
          eq(vctx.sql.tables.chatContexts.userId, opts.userId),
          eq(vctx.sql.tables.chatContexts.userSlug, opts.userSlug),
          eq(vctx.sql.tables.chatContexts.appSlug, opts.appSlug)
        )
      )
      .limit(1)
  );
  if (rExisting.isErr()) return Result.Err(`Failed to look up chatContexts: ${rExisting.Err().message}`);
  const existing = rExisting.Ok();

  let chatId: string;
  let isRepair = false;
  if (existing.length > 0) {
    chatId = existing[0].chatId;
    const rSection = await exception2Result(() =>
      vctx.sql.db
        .select({ chatId: vctx.sql.tables.chatSections.chatId })
        .from(vctx.sql.tables.chatSections)
        .where(eq(vctx.sql.tables.chatSections.chatId, chatId))
        .limit(1)
    );
    if (rSection.isErr()) return Result.Err(`Failed to look up chatSections: ${rSection.Err().message}`);
    if (rSection.Ok().length > 0) {
      return Result.Ok({ chatId, state: "existing" });
    }
    isRepair = true;
  } else {
    chatId = vctx.sthis.nextId(12).str;
  }

  const seedFiles: SeedFile[] = [];
  for (const f of opts.fileSystem) {
    const seed = toSeedFile(f);
    if (seed) seedFiles.push(seed);
  }
  if (seedFiles.length === 0) {
    return Result.Err("ensurePushSeededChat: no code files to seed from");
  }

  const promptId = vctx.sthis.nextId(12).str;
  const blockId = vctx.sthis.nextId(12).str;
  const now = new Date();

  if (!isRepair) {
    const rCtx = await exception2Result(() =>
      vctx.sql.db.insert(vctx.sql.tables.chatContexts).values({
        chatId,
        userId: opts.userId,
        appSlug: opts.appSlug,
        userSlug: opts.userSlug,
        created: now.toISOString(),
      })
    );
    if (rCtx.isErr()) return Result.Err(`Failed to insert chatContext: ${rCtx.Err().message}`);
  }

  if (opts.fsId) {
    const fsRef = {
      appSlug: opts.appSlug,
      userSlug: opts.userSlug,
      mode: opts.mode,
      fsId: opts.fsId,
    };
    const refValue: PromptContextSql = {
      type: "prompt.usage.sql",
      usage: { given: [], calculated: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } },
      fsRef,
    };
    const rPC = await exception2Result(() =>
      vctx.sql.db.insert(vctx.sql.tables.promptContexts).values({
        userId: opts.userId,
        chatId,
        promptId,
        fsId: opts.fsId,
        nethash: vctx.netHash(),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        ref: refValue,
        created: now.toISOString(),
      })
    );
    if (rPC.isErr()) return Result.Err(`Failed to insert promptContext: ${rPC.Err().message}`);
  }

  const userText = `Initial push from \`vibes-diy push\` (${seedFiles.length} file${seedFiles.length === 1 ? "" : "s"}).`;
  const rSeed = await seedChatSection(vctx, {
    chatId,
    promptId,
    blockId,
    streamId: blockId,
    userText,
    files: seedFiles,
    timestamp: now,
    ...(opts.fsId
      ? {
          fsRef: {
            appSlug: opts.appSlug,
            userSlug: opts.userSlug,
            mode: opts.mode,
            fsId: opts.fsId,
          },
        }
      : {}),
  });
  if (rSeed.isErr()) return Result.Err(rSeed);

  return Result.Ok({ chatId, state: isRepair ? "repaired" : "created" });
}
