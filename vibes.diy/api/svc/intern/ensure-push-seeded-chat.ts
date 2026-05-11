import { Result, exception2Result } from "@adviser/cement";
import { and, eq } from "drizzle-orm/sql/expressions";
import { isVibeCodeBlock, type VibeFile } from "@vibes.diy/api-types";
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
  /** "created" on first push (new ChatContext + seed section), "existing" on re-push. */
  readonly state: "created" | "existing";
}

/**
 * Idempotent chat-seed for the `vibes-diy push` flow. If a ChatContext
 * already exists for (userId, userSlug, appSlug), return it untouched.
 * Otherwise create one and seed it with a synthetic prompt turn whose
 * assistant block is the pushed file set rendered as code blocks.
 *
 * Why: openChat-by-appSlug rebuilds the LLM-side conversation history by
 * walking ChatSections via reconstructConversationMessages. Without a
 * seed, push-then-edit (or push-then-web-follow-up) hits a context-free
 * LLM and the model regenerates the app from scratch (see #1667 comment
 * thread). Seeding makes the first follow-up turn see the pushed files
 * just like a chat-originated turn would.
 *
 * On re-push, we deliberately skip re-seeding even when the file set has
 * changed — the chat already has its own history beyond the initial
 * seed, and re-seeding would corrupt it. Re-pushes are a publish-only
 * operation; their file state lives in the `apps` table and is what the
 * runtime serves, but the chat history reflects the conversation that
 * produced those files.
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
  if (existing.length > 0) {
    return Result.Ok({ chatId: existing[0].chatId, state: "existing" });
  }

  const seedFiles: SeedFile[] = [];
  for (const f of opts.fileSystem) {
    const seed = toSeedFile(f);
    if (seed) seedFiles.push(seed);
  }
  if (seedFiles.length === 0) {
    return Result.Err("ensurePushSeededChat: no code files to seed from");
  }

  const chatId = vctx.sthis.nextId(12).str;
  const promptId = vctx.sthis.nextId(12).str;
  const blockId = vctx.sthis.nextId(12).str;
  const now = new Date();

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

  return Result.Ok({ chatId, state: "created" });
}
