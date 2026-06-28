import { command, option, optional, positional, string } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { resListApplicationChatsItem } from "@vibes.diy/api-types";
import type { ResListApplicationChatsItem, ResGetApplicationChat } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { formatErr } from "./format-err.js";
import { resolveVibePositionals } from "../parse-vibe.js";
import { renderAppChatBlocks } from "./chat-response-render.js";

export const ReqAppChats = type({
  type: "'vibes-diy.cli.app-chats'",
  appSlug: "string",
  ownerHandle: "string",
  "chatId?": "string",
  apiUrl: "string",
});
export type ReqAppChats = typeof ReqAppChats.infer;

export function isReqAppChats(obj: unknown): obj is ReqAppChats {
  return !(ReqAppChats(obj) instanceof type.errors);
}

export const ResAppChatsList = type({
  type: "'vibes-diy.cli.res-app-chats-list'",
  items: resListApplicationChatsItem.array(),
});
export type ResAppChatsList = typeof ResAppChatsList.infer;

export function isResAppChatsList(obj: unknown): obj is ResAppChatsList {
  return !(ResAppChatsList(obj) instanceof type.errors);
}

export const ResAppChatsDetail = type({
  type: "'vibes-diy.cli.res-app-chats-detail'",
  chatId: "string",
  "ownerHandle?": "string",
  "appSlug?": "string",
  output: "string",
});
export type ResAppChatsDetail = typeof ResAppChatsDetail.infer;

export function isResAppChatsDetail(obj: unknown): obj is ResAppChatsDetail {
  return !(ResAppChatsDetail(obj) instanceof type.errors);
}

type ResAppChats = ResAppChatsList | ResAppChatsDetail;

export const appChatsEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqAppChats, ResAppChats> = {
  hash: "vibes-diy.cli.app-chats",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqAppChats, ResAppChats>) => {
    if (isReqAppChats(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqAppChats, ResAppChats>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);
    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);

    switch (true) {
      case args.chatId !== undefined: {
        // Deep-read: fetch the runtime chat's blocks from ApplicationChats.
        const rDetail = await api.getApplicationChat({
          chatId: args.chatId,
          ...(args.appSlug !== "" ? { appSlug: args.appSlug } : {}),
          ...(ownerHandle !== undefined ? { ownerHandle } : {}),
        });
        if (rDetail.isErr()) {
          return Result.Err(formatErr(rDetail.Err()));
        }
        const detail: ResGetApplicationChat = rDetail.Ok();
        // Render blocks as readable text using the app-chat renderer (supports
        // image placeholders in addition to toplevel/code blocks).
        const output = renderAppChatBlocks(detail.blocks);
        return sendMsg(ctx, {
          type: "vibes-diy.cli.res-app-chats-detail",
          chatId: args.chatId,
          ...(detail.ownerHandle !== undefined ? { ownerHandle: detail.ownerHandle } : {}),
          ...(detail.appSlug !== undefined ? { appSlug: detail.appSlug } : {}),
          output,
        } satisfies ResAppChatsDetail);
      }
      default: {
        // List: enumerate runtime in-app chats from ApplicationChats.
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
        return sendMsg(ctx, {
          type: "vibes-diy.cli.res-app-chats-list",
          items,
        } satisfies ResAppChatsList);
      }
    }
  },
};

export function appChatsCmd(ctx: CliCtx) {
  return command({
    name: "app-chats",
    description:
      "List or read the runtime in-app chats stored by a deployed vibe (the app's own chat/image messages, NOT the codegen build transcript).",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug",
        type: optional(string),
      }),
      chatId: positional({
        displayName: "chatId",
        description: "Chat ID to read (omit to list all runtime chats)",
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
        type: "vibes-diy.cli.app-chats" as const,
        ...rest,
        appSlug: resolved.appSlug,
        ownerHandle: resolved.handle,
      };
      return resolvedChatId === undefined ? base : { ...base, chatId: resolvedChatId };
    }),
  });
}
