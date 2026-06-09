import { command, option, optional, positional, string } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { resListApplicationChatsItem } from "@vibes.diy/api-types";
import type { ResListApplicationChatsItem, ResGetChatDetails } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { formatErr } from "./format-err.js";
import { resolveVibePositionals } from "../parse-vibe.js";

export const ReqChats = type({
  type: "'vibes-diy.cli.chats'",
  appSlug: "string",
  ownerHandle: "string",
  "chatId?": "string",
  apiUrl: "string",
});
export type ReqChats = typeof ReqChats.infer;

export function isReqChats(obj: unknown): obj is ReqChats {
  return !(ReqChats(obj) instanceof type.errors);
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

type ResChats = ResChatsList | ResChatDetail;

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
    },
    handler: ctx.cliStream.enqueue(({ handle, chatId, vibe, appSlug, ...rest }) => {
      const resolved = resolveVibePositionals({ vibe, handle, positionals: [appSlug, chatId] });
      const resolvedChatId = resolved.trailing[0];
      const base = {
        type: "vibes-diy.cli.chats" as const,
        ...rest,
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
      };
      return resolvedChatId === undefined ? base : { ...base, chatId: resolvedChatId };
    }),
  });
}
