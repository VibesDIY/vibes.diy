import { Result, exception2Result } from "@adviser/cement";
import {
  ActiveEntry,
  PromptAndBlockMsgs,
  isActiveEnrichedPrompt,
  isActiveSkills,
  isActiveTheme,
  isActiveTitle,
  isPromptReq,
  parseArrayWarning,
  type SelectedSlotInput,
  type SlotConfig,
} from "@vibes.diy/api-types";
import { ChatMessage, isCodeBegin, isCodeEnd, isCodeLine, isToplevelLine } from "@vibes.diy/call-ai-v2";
import { ensureLogger } from "@fireproof/core-runtime";
import { and, eq } from "drizzle-orm/sql/expressions";
import { makeBaseSystemPrompt, resolveEffectiveModel } from "@vibes.diy/prompts";
import type { VibesApiSQLCtx } from "../types.js";
import { createPromptAssetFetch, promptsPkgBaseUrl } from "./prompt-asset-fetch.js";
import { assembleSlotMessages, renderSlotMessagesAs } from "./slot-assembler.js";
import { loadLatestPromptId, loadVersionTimeline, selectSlotSources } from "./version-timeline.js";

export interface ReconstructOpts {
  readonly keepFullTurnStreamId?: string;
}

/**
 * Reconstruct conversation messages (user + assistant) from stored section blocks.
 * Assistant responses are rebuilt from ToplevelLine and Code block messages.
 *
 * When opts.keepFullTurnStreamId is set, code blocks in older turns (identified
 * by the prompt.req streamId) are compacted to summary lines instead of being
 * emitted verbatim. The turn whose streamId matches keepFullTurnStreamId is
 * kept in full.
 */
export function reconstructConversationMessages(sectionMsgs: PromptAndBlockMsgs[], opts: ReconstructOpts = {}): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const assistantLines: string[] = [];
  let currentStreamId: string | undefined;
  let blockBuffer: { path: string; lineCount: number; firstNonBlank?: string } | null = null;

  function flushAssistant() {
    if (assistantLines.length === 0) return;
    messages.push({
      role: "assistant",
      content: [{ type: "text", text: assistantLines.join("\n") }],
    });
    assistantLines.length = 0;
  }

  for (const msg of sectionMsgs) {
    switch (true) {
      case isPromptReq(msg):
        flushAssistant();
        // Invariant: each stored prompt.req carries only the newest user turn
        // (see handlePromptContext); full history is rebuilt across sections
        // rather than duplicated per request.
        currentStreamId = msg.streamId;
        messages.push(...msg.request.messages.filter((m) => m.role === "user"));
        break;
      case isToplevelLine(msg):
        assistantLines.push(msg.line);
        break;
      case isCodeBegin(msg): {
        const compact = opts.keepFullTurnStreamId !== undefined && currentStreamId !== opts.keepFullTurnStreamId;
        if (compact) {
          blockBuffer = { path: msg.path ?? "App.jsx", lineCount: 0 };
        } else {
          assistantLines.push("```" + msg.lang);
        }
        break;
      }
      case isCodeLine(msg):
        if (blockBuffer) {
          blockBuffer.lineCount++;
          if (!blockBuffer.firstNonBlank && msg.line.trim().length > 0) {
            blockBuffer.firstNonBlank = msg.line.trim();
          }
        } else {
          assistantLines.push(msg.line);
        }
        break;
      case isCodeEnd(msg):
        if (blockBuffer) {
          const isEdit = blockBuffer.firstNonBlank === "<<<<<<< SEARCH";
          if (isEdit) {
            assistantLines.push(`[${blockBuffer.lineCount}-line edit to ${blockBuffer.path}]`);
          } else {
            const lines = msg.stats.lines !== 0 ? msg.stats.lines : blockBuffer.lineCount;
            const bytes = msg.stats.bytes;
            assistantLines.push(`[Created ${blockBuffer.path} — ${lines} lines, ${bytes} bytes]`);
          }
          blockBuffer = null;
        } else {
          assistantLines.push("```");
        }
        break;
    }
  }
  flushAssistant();
  return messages;
}

async function loadActiveSettings(
  vctx: VibesApiSQLCtx,
  chatId: string
): Promise<{ skills?: string[]; theme?: string; title?: string; enrichedPrompt?: string }> {
  const rChat = await exception2Result(() =>
    vctx.sql.db
      .select({ appSlug: vctx.sql.tables.chatContexts.appSlug, ownerHandle: vctx.sql.tables.chatContexts.ownerHandle })
      .from(vctx.sql.tables.chatContexts)
      .where(eq(vctx.sql.tables.chatContexts.chatId, chatId))
      .limit(1)
      .then((r) => r[0])
  );
  if (rChat.isErr() || !rChat.Ok()) return {};
  const { appSlug, ownerHandle } = rChat.Ok();
  const rApp = await exception2Result(() =>
    vctx.sql.db
      .select({ settings: vctx.sql.tables.appSettings.settings })
      .from(vctx.sql.tables.appSettings)
      .where(and(eq(vctx.sql.tables.appSettings.appSlug, appSlug), eq(vctx.sql.tables.appSettings.ownerHandle, ownerHandle)))
      .limit(1)
      .then((r) => r[0])
  );
  if (rApp.isErr() || !rApp.Ok()) return {};
  const entries = (rApp.Ok().settings ?? []) as ActiveEntry[];
  return {
    skills: entries.find(isActiveSkills)?.skills,
    theme: entries.find(isActiveTheme)?.theme,
    title: entries.find(isActiveTitle)?.title,
    enrichedPrompt: entries.find(isActiveEnrichedPrompt)?.enrichedPrompt,
  };
}

export interface AssemblePromptPayloadArgs {
  readonly chatId: string;
  readonly model: string;
  // Next user turn(s) appended to the reconstructed conversation. Callers
  // pass these explicitly instead of writing a prompt.req block first and
  // letting reconstruction pick it up — so the same function serves both
  // the dispatch path (writes after assembly) and the dry-run path (no write).
  // Non-user roles are filtered.
  readonly newUserMessages: readonly ChatMessage[];
  // Optional: the version or draft the user currently has selected in the UI.
  // Drives the SELECTED_DRAFT or SELECTED_VERSION slot.
  readonly selected?: SelectedSlotInput;
  // Optional: per-slot mute configuration.
  readonly slots?: SlotConfig;
  // Optional: the file path to focus on in slot rendering. Defaults to "App.jsx".
  readonly focusPath?: string;
  // Optional: override which role slot messages are delivered as. When absent,
  // falls back to the SLOT_DELIVERY_MODE env var (defaulting to "user").
  readonly slotDeliveryMode?: "user" | "system";
}

export async function assemblePromptPayload(
  vctx: VibesApiSQLCtx,
  args: AssemblePromptPayloadArgs
): Promise<
  Result<{
    model: string;
    messages: ChatMessage[];
  }>
> {
  const { chatId, model, newUserMessages } = args;
  const sections = await vctx.sql.db
    .select()
    .from(vctx.sql.tables.chatSections)
    .where(eq(vctx.sql.tables.chatSections.chatId, chatId))
    .orderBy(vctx.sql.tables.chatSections.created);
  // A single assistant turn can span multiple chatSections rows (blockChunks
  // boundary), so concat every section's parsed messages and reconstruct once —
  // reconstructing per-row would flush mid-turn and fragment the assistant message.
  const allSectionMsgs: PromptAndBlockMsgs[] = [];
  for (const rowSection of sections) {
    const { filtered: sectionMsgs, warning: sectionWarning } = parseArrayWarning(rowSection.blocks, PromptAndBlockMsgs);
    if (sectionWarning.length > 0) {
      ensureLogger(vctx.sthis, "assemblePromptPayload").Warn().Any({ parseErrors: sectionWarning }).Msg("skip");
    }
    allSectionMsgs.push(...sectionMsgs);
  }

  // Load timeline and latest promptId for slot assembly + compaction.
  // Both return Result<T>; on error we propagate the failure.
  const timelineResult = await loadVersionTimeline(vctx, chatId);
  if (timelineResult.isErr()) return Result.Err(timelineResult);

  const latestPromptIdResult = await loadLatestPromptId(vctx, chatId);
  if (latestPromptIdResult.isErr()) return Result.Err(latestPromptIdResult);

  const timeline = timelineResult.Ok();
  const latestPromptId = latestPromptIdResult.Ok();

  // Reconstruct conversation history, compacting older turns when a latest
  // promptId is available (keeps only the most recent turn in full fidelity).
  // SLOTS_COMPACTION=off (or slots.compaction: "off") disables compaction
  // entirely — all turns render verbatim. Kill-switch for rollback / A-B.
  const compactionDisabled = args.slots?.compaction === "off";
  const reconstructed = reconstructConversationMessages(allSectionMsgs, {
    keepFullTurnStreamId: compactionDisabled ? undefined : latestPromptId,
  });
  const newUserOnly = newUserMessages.filter((m) => m.role === "user");

  // Resolve the app's ActiveSkills + ActiveTitle from app_settings. Pre-allocation
  // seeds both on new chats; legacy rows without skills fall back to
  // makeBaseSystemPrompt's getDefaultSkills(), and an unset title drops the
  // title hint line entirely.
  const { skills, theme, title, enrichedPrompt } = await loadActiveSettings(vctx, chatId);
  const isInitial = timeline.length === 0;

  const systemPrompt = await exception2Result(async () => {
    return makeBaseSystemPrompt(await resolveEffectiveModel({ model }, {}), {
      skills,
      theme,
      title,
      enrichedPrompt,
      demoData: false,
      variant: isInitial ? "initial" : "continuation",
      pkgBaseUrl: promptsPkgBaseUrl(vctx.params.pkgRepos.workspace),
      fetch: createPromptAssetFetch({ fetchAsset: vctx.fetchAsset }),
    });
  });
  if (systemPrompt.isErr()) {
    console.error("Failed to create system prompt:", systemPrompt.Err());
    return Result.Err(systemPrompt);
  }
  const hasUserMessage = [...reconstructed, ...newUserOnly].some((m) => m.role === "user");
  if (hasUserMessage === false) {
    return Result.Err(`No user messages found in the prompt`);
  }

  // Build slot messages from the version timeline. The PREVIOUS slot carries
  // the current file state (replacing the old CURRENT FILES system-prompt append),
  // ORIGINAL anchors to the scaffold, and LAST_EDIT provides the preceding diff.
  const slotSources = selectSlotSources(timeline);

  // Resolve a historical version if the caller specified selected:{kind:"version",fsId}.
  let selectedVersion: { readonly vfs: ReadonlyMap<string, string>; readonly turnsAgo: number } | undefined;
  const sel = args.selected;
  if (sel?.kind === "version") {
    const idx = timeline.findIndex((t) => t.fsId === sel.fsId);
    if (idx >= 0) {
      selectedVersion = { vfs: timeline[idx].vfs, turnsAgo: timeline.length - 1 - idx };
    }
  }

  // Resolve a draft map if the caller supplied selected draft files.
  // Only files with string content (code-block, str-asset-block) are included.
  const selectedDraftMap: ReadonlyMap<string, string> | undefined =
    args.selected?.kind === "draft"
      ? new Map(
          args.selected.files.flatMap((f) =>
            f.type === "code-block" || f.type === "str-asset-block" ? [[f.filename, f.content]] : []
          )
        )
      : undefined;

  const slotMessages = assembleSlotMessages({
    original: slotSources.original !== undefined ? { vfs: slotSources.original.vfs, turnsAgo: timeline.length - 1 } : undefined,
    prev2: slotSources.prev2?.vfs,
    previous: slotSources.previous?.vfs,
    selectedVersion,
    selectedDraft: selectedDraftMap,
    focusPath: args.focusPath ?? "App.jsx",
    config: args.slots ?? {},
  });

  // Build final message list: system → conversation history → slot messages → new user.
  const slotDeliveryMode: "user" | "system" =
    args.slotDeliveryMode ?? (vctx.sthis.env.get("SLOT_DELIVERY_MODE") === "system" ? "system" : "user");
  const slotChatMessages = renderSlotMessagesAs(slotMessages, slotDeliveryMode);

  return Result.Ok({
    model,
    messages: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: systemPrompt.Ok().systemPrompt,
          },
        ],
      },
      ...reconstructed,
      ...slotChatMessages,
      ...newUserOnly,
    ],
  });
}
