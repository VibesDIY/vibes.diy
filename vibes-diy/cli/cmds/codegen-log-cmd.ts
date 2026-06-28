import { command, flag, option, optional, positional, string } from "cmd-ts";
import { ValidateTriggerCtx, Result, HandleTriggerCtx, Option, EventoHandler, EventoResultType } from "@adviser/cement";
import { type } from "arktype";
import { resListCodegenChatsItem } from "@vibes.diy/api-types";
import type { ResListCodegenChatsItem, ResGetChatDetails, ResChatResponseTurn } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveHandle } from "../resolve-handle.js";
import { formatErr } from "./format-err.js";
import { resolveVibePositionals } from "../parse-vibe.js";
import {
  extractRawText,
  extractUserPrompts,
  reconstructVerbatim,
  renderJsonl,
  resolveTurnFiles,
  turnBlocks,
} from "./chat-response-render.js";

export const ReqCodegenLog = type({
  type: "'vibes-diy.cli.codegen-log'",
  appSlug: "string",
  ownerHandle: "string",
  "chatId?": "string",
  apiUrl: "string",
  // --response family: dump the model's actual reply for a chat. `response` is
  // implied by any of `raw`/`files`/`jsonl`/`user`. `promptId` selects one turn.
  "response?": "boolean",
  "raw?": "boolean",
  "files?": "boolean",
  "jsonl?": "boolean",
  "user?": "boolean",
  "promptId?": "string",
});
export type ReqCodegenLog = typeof ReqCodegenLog.infer;

export function isReqCodegenLog(obj: unknown): obj is ReqCodegenLog {
  return !(ReqCodegenLog(obj) instanceof type.errors);
}

export const ResCodegenLogResponse = type({
  type: "'vibes-diy.cli.res-codegen-log-response'",
  output: "string",
});
export type ResCodegenLogResponse = typeof ResCodegenLogResponse.infer;

export function isResCodegenLogResponse(obj: unknown): obj is ResCodegenLogResponse {
  return !(ResCodegenLogResponse(obj) instanceof type.errors);
}

export const ResCodegenLogList = type({
  type: "'vibes-diy.cli.res-codegen-log-list'",
  items: resListCodegenChatsItem.array(),
});
export type ResCodegenLogList = typeof ResCodegenLogList.infer;

export function isResCodegenLogList(obj: unknown): obj is ResCodegenLogList {
  return !(ResCodegenLogList(obj) instanceof type.errors);
}

export const ResCodegenLogDetail = type({
  type: "'vibes-diy.cli.res-codegen-log-detail'",
  chatId: "string",
  ownerHandle: "string",
  appSlug: "string",
  prompts: type({
    prompt: "string",
    fsId: "string",
    created: "string",
  }).array(),
});
export type ResCodegenLogDetail = typeof ResCodegenLogDetail.infer;

export function isResCodegenLogDetail(obj: unknown): obj is ResCodegenLogDetail {
  return !(ResCodegenLogDetail(obj) instanceof type.errors);
}

type ResCodegenLog = ResCodegenLogList | ResCodegenLogDetail | ResCodegenLogResponse;

export const codegenLogEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqCodegenLog, ResCodegenLog> = {
  hash: "vibes-diy.cli.codegen-log",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqCodegenLog, ResCodegenLog>) => {
    if (isReqCodegenLog(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqCodegenLog, ResCodegenLog>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);
    const ownerHandle = await resolveHandle(api, args.ownerHandle === "" ? undefined : args.ownerHandle);

    // --response (and its --files/--jsonl/--user variants): dump the model's
    // actual reply for a chat, not just the user prompt getChatDetails returns.
    const wantResponse =
      args.response === true || args.raw === true || args.files === true || args.jsonl === true || args.user === true;
    if (wantResponse) {
      if (ownerHandle === undefined) {
        return Result.Err("Could not resolve handle. Pass --handle or run 'vibes-diy login'.");
      }
      // Fetch the whole chat's turns (don't filter by promptId server-side):
      // we select the turn client-side, and --files needs the sibling turns to
      // seed the SEARCH/REPLACE chain (see resolveTurnFiles).
      const rResp = await api.getChatResponse({
        ownerHandle,
        appSlug: args.appSlug,
        ...(args.chatId !== undefined ? { chatId: args.chatId } : {}),
      });
      if (rResp.isErr()) {
        return Result.Err(formatErr(rResp.Err()));
      }
      const turns = rResp.Ok().turns;
      if (turns.length === 0) {
        return sendMsg(ctx, {
          type: "vibes-diy.cli.res-codegen-log-response",
          output: "(no response found for this chat)",
        } satisfies ResCodegenLogResponse);
      }
      // Default to the newest turn (turns are newest-first); --turn picks another.
      let turn: ResChatResponseTurn | undefined = turns[0];
      if (args.promptId !== undefined) {
        turn = turns.find((t) => t.promptId === args.promptId);
        if (turn === undefined) {
          return Result.Err(`No turn with promptId ${args.promptId} in this chat.`);
        }
      } else if (turns.length > 1) {
        // To stderr, NOT stdout: --jsonl/--files stdout must stay machine-
        // parseable (one JSON object per line / a JSON object), so a human
        // "showing newest turn" banner can't lead the body.
        ectx.output.stderr(
          `Showing newest turn ${turn.promptId} (${turns.length} turns total — use --turn <promptId> to pick another).\n`
        );
      }
      const blocks = turnBlocks(turn);

      let body: string;
      if (args.raw === true) {
        // Byte-faithful: the exact model text before the parser ran. Only
        // present for turns generated after raw capture shipped.
        const raw = extractRawText(blocks);
        body =
          raw ??
          "(no raw capture for this turn — byte-faithful text is only stored for generations after raw capture shipped; try --jsonl or the default block-faithful view)";
      } else if (args.jsonl === true) {
        body = renderJsonl(blocks);
      } else if (args.files === true) {
        const rResolved = await resolveTurnFiles(turns, turn.promptId);
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
          .map((p) =>
            p
              .split("\n")
              .map((l) => `> ${l}`)
              .join("\n")
          )
          .join("\n>\n");
        output = userBlock === "" ? body : `${userBlock}\n\n${body}`;
      }

      return sendMsg(ctx, {
        type: "vibes-diy.cli.res-codegen-log-response",
        output,
      } satisfies ResCodegenLogResponse);
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
          type: "vibes-diy.cli.res-codegen-log-detail",
          chatId: args.chatId,
          ownerHandle: detail.ownerHandle,
          appSlug: detail.appSlug,
          prompts: detail.prompts,
        } satisfies ResCodegenLogDetail);
      }
      default: {
        const items: ResListCodegenChatsItem[] = [];
        let cursor: string | undefined;
        do {
          const rPage = await api.listCodegenChats({
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
          type: "vibes-diy.cli.res-codegen-log-list",
          items,
        } satisfies ResCodegenLogList);
      }
    }
  },
};

export function codegenLogCmd(ctx: CliCtx) {
  return command({
    name: "codegen-log",
    description:
      "Inspect a vibe's codegen build transcript (the builder↔LLM conversation that generated its source). List chats, or show one chat's prompts / reconstructed model output.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "vibe",
        description: "App slug or handle/app-slug",
        type: optional(string),
      }),
      chatId: positional({
        displayName: "chatId",
        description: "Chat ID to show prompt history for (omit to list all codegen chats)",
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
      raw: flag({
        long: "raw",
        description:
          "With --response: byte-faithful raw model text captured upstream of the parser (preserves consumed labels & blank lines; new generations only)",
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
        type: "vibes-diy.cli.codegen-log" as const,
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
