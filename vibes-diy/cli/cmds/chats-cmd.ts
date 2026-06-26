import { command, flag, option, optional, positional, string } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { resListApplicationChatsItem } from "@vibes.diy/api-types";
import type { ResListApplicationChatsItem, ResGetChatDetails, ResChatResponseTurn } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { formatErr } from "./format-err.js";
import { resolveVibePositionals } from "../parse-vibe.js";
import { resolveSectionStream } from "./resolve-section-stream.js";
import { buildSectionStream, extractUserPrompts, reconstructVerbatim, renderJsonl, turnBlocks } from "./chat-response-render.js";

export const ReqChats = type({
  type: "'vibes-diy.cli.chats'",
  appSlug: "string",
  ownerHandle: "string",
  "chatId?": "string",
  apiUrl: "string",
  // --response family: dump the model's actual reply for a chat. `response` is
  // implied by any of `files`/`jsonl`/`user`. `promptId` selects one turn.
  "response?": "boolean",
  "files?": "boolean",
  "jsonl?": "boolean",
  "user?": "boolean",
  "promptId?": "string",
});
export type ReqChats = typeof ReqChats.infer;

export function isReqChats(obj: unknown): obj is ReqChats {
  return !(ReqChats(obj) instanceof type.errors);
}

export const ResChatResponse = type({
  type: "'vibes-diy.cli.res-chat-response'",
  output: "string",
});
export type ResChatResponse = typeof ResChatResponse.infer;

export function isResChatResponse(obj: unknown): obj is ResChatResponse {
  return !(ResChatResponse(obj) instanceof type.errors);
}

export const ResChatsList = type({
  type: "'vibes-diy.cli.res-chats-list'",
  items: resListApplicationChatsItem.array(),
});
export type ResChatsList = typeof ResChatsList.infer;

export function isResChatsList(obj: unknown): obj is ResChatsList {
  return !(ResChatsList(obj) instanceof type.errors);
}

export const ResChatDetail = type({
  type: "'vibes-diy.cli.res-chat-detail'",
  chatId: "string",
  ownerHandle: "string",
  appSlug: "string",
  prompts: type({
    prompt: "string",
    fsId: "string",
    created: "string",
  }).array(),
});
export type ResChatDetail = typeof ResChatDetail.infer;

export function isResChatDetail(obj: unknown): obj is ResChatDetail {
  return !(ResChatDetail(obj) instanceof type.errors);
}

type ResChats = ResChatsList | ResChatDetail | ResChatResponse;

export const chatsEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqChats, ResChats> = {
  hash: "vibes-diy.cli.chats",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqChats, ResChats>) => {
    if (isReqChats(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqChats, ResChats>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);
    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);

    // --response (and its --files/--jsonl/--user variants): dump the model's
    // actual reply for a chat, not just the user prompt getChatDetails returns.
    const wantResponse = args.response === true || args.files === true || args.jsonl === true || args.user === true;
    if (wantResponse) {
      if (ownerHandle === undefined) {
        return Result.Err("Could not resolve handle. Pass --handle or run 'vibes-diy login'.");
      }
      const rResp = await api.getChatResponse({
        ownerHandle,
        appSlug: args.appSlug,
        ...(args.chatId !== undefined ? { chatId: args.chatId } : {}),
        ...(args.promptId !== undefined ? { promptId: args.promptId } : {}),
      });
      if (rResp.isErr()) {
        return Result.Err(formatErr(rResp.Err()));
      }
      const turns = rResp.Ok().turns;
      if (turns.length === 0) {
        return sendMsg(ctx, { type: "vibes-diy.cli.res-chat-response", output: "(no response found for this chat)" } satisfies ResChatResponse);
      }
      // Default to the newest turn (turns are newest-first); --turn picks another.
      let turn: ResChatResponseTurn | undefined = turns[0];
      if (args.promptId !== undefined) {
        turn = turns.find((t) => t.promptId === args.promptId);
        if (turn === undefined) {
          return Result.Err(`No turn with promptId ${args.promptId} in this chat.`);
        }
      } else if (turns.length > 1) {
        await sendProgress(
          ctx,
          "info",
          `Showing newest turn ${turn.promptId} (${turns.length} turns total — use --turn <promptId> to pick another).`
        );
      }
      const blocks = turnBlocks(turn);

      let body: string;
      if (args.jsonl === true) {
        body = renderJsonl(blocks);
      } else if (args.files === true) {
        const rResolved = await resolveSectionStream({ sectionStream: buildSectionStream(turn), streamId: turn.promptId });
        if (rResolved.isErr()) {
          return Result.Err(`Failed to resolve stored stream: ${rResolved.Err().message}`);
        }
        body = JSON.stringify(rResolved.Ok().files, null, 2);
      } else {
        body = reconstructVerbatim(blocks);
      }

      // --user prepends the user message(s) so the full transcript reads top-down.
      let output = body;
      if (args.user === true) {
        const userBlock = extractUserPrompts(blocks)
          .map((p) => p.split("\n").map((l) => `> ${l}`).join("\n"))
          .join("\n>\n");
        output = userBlock === "" ? body : `${userBlock}\n\n${body}`;
      }

      return sendMsg(ctx, { type: "vibes-diy.cli.res-chat-response", output } satisfies ResChatResponse);
    }

    switch (true) {
      case args.chatId !== undefined: {
        if (ownerHandle === undefined) {
          return Result.Err("Could not resolve handle. Pass --handle or run 'vibes-diy login'.");
        }
        const rDetail = await api.getChatDetails({
          ownerHandle,
          appSlug: args.appSlug,
          chatId: args.chatId,
        });
        if (rDetail.isErr()) {
          return Result.Err(formatErr(rDetail.Err()));
        }
        const detail: ResGetChatDetails = rDetail.Ok();
        return sendMsg(ctx, {
          type: "vibes-diy.cli.res-chat-detail",
          chatId: args.chatId,
          ownerHandle: detail.ownerHandle,
          appSlug: detail.appSlug,
          prompts: detail.prompts,
        } satisfies ResChatDetail);
      }
      default: {
        const items: ResListApplicationChatsItem[] = [];
        let cursor: string | undefined;
        do {
          const rPage = await api.listApplicationChats({
            appSlug: args.appSlug,
            ...(ownerHandle !== undefined ? { ownerHandle } : {}),
            limit: 100,
            ...(cursor !== undefined ? { cursor } : {}),
          });
          if (rPage.isErr()) {
            return Result.Err(formatErr(rPage.Err()));
          }
          const page = rPage.Ok();
          items.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor !== undefined);
        return sendMsg(ctx, { type: "vibes-diy.cli.res-chats-list", items } satisfies ResChatsList);
      }
    }
  },
};

export function chatsCmd(ctx: CliCtx) {
  return command({
    name: "chats",
    description: "List chat sessions for a vibe, or show prompts for a specific chat.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug",
        type: optional(string),
      }),
      chatId: positional({
        displayName: "chatId",
        description: "Chat ID to show prompt history for (omit to list all chats)",
        type: optional(string),
      }),
      vibe: option({
        long: "vibe",
        description: "Vibe identifier as handle/app-slug",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      handle: option({
        long: "handle",
        description: "Handle (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      response: flag({
        long: "response",
        short: "r",
        description: "Show the model's reply, block-faithfully reconstructed from stored block events, instead of the user prompt",
      }),
      files: flag({
        long: "files",
        description: "With --response: the resolved path→content map (via the generate/edit resolver)",
      }),
      jsonl: flag({
        long: "jsonl",
        description: "With --response: the raw block events, one JSON object per line",
      }),
      user: flag({
        long: "user",
        description: "With --response: also print the user prompt(s) so the full transcript reads top-down",
      }),
      turn: option({
        long: "turn",
        description: "With --response: select a specific turn by promptId (default: newest)",
        type: optional(string),
      }),
    },
    handler: ctx.cliStream.enqueue(({ handle, chatId, vibe, appSlug, turn, ...rest }) => {
      const resolved = resolveVibePositionals({ vibe, handle, positionals: [appSlug, chatId] });
      const resolvedChatId = resolved.trailing[0];
      const base = {
        type: "vibes-diy.cli.chats" as const,
        ...rest,
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
      };
      const withChat = resolvedChatId === undefined ? base : { ...base, chatId: resolvedChatId };
      // ArkType trips on an explicit `promptId: undefined`; only attach when set.
      return turn === undefined ? withChat : { ...withChat, promptId: turn };
    }),
  });
}
