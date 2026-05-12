import { command, flag, option, positional, string } from "cmd-ts";
import { EventoHandler, EventoResultType, HandleTriggerCtx, Option, Result, ValidateTriggerCtx } from "@adviser/cement";
import { type } from "arktype";
import type { ResInspectPromptChatSection } from "@vibes.diy/api-types";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, sendProgress, WrapCmdTSMsg } from "../cmd-evento.js";
import { resolveUserSlug } from "../resolve-user-slug.js";
import { formatErr } from "./format-err.js";

export const ResInspect = type({
  type: "'use-vibes.cli.res-inspect'",
  appSlug: "string",
  userSlug: "string",
  chatId: "string",
  // Rendered payload as a string (JSON or transcript) so main.ts can emit
  // it verbatim without knowing the underlying message shape.
  output: "string",
});
export type ResInspect = typeof ResInspect.infer;

export function isResInspect(obj: unknown): obj is ResInspect {
  return !(ResInspect(obj) instanceof type.errors);
}

export const ReqInspect = type({
  type: "'use-vibes.cli.inspect'",
  appSlug: "string",
  prompt: "string",
  userSlug: "string",
  asText: "boolean",
  apiUrl: "string",
});
export type ReqInspect = typeof ReqInspect.infer;

export function isReqInspect(obj: unknown): obj is ReqInspect {
  return !(ReqInspect(obj) instanceof type.errors);
}

export function formatInspectAsText(res: ResInspectPromptChatSection): string {
  const lines: string[] = [];
  lines.push(`# model: ${res.model}`);
  lines.push(`# chatId: ${res.chatId}`);
  lines.push("");
  for (const msg of res.messages) {
    lines.push(`=== ${msg.role.toUpperCase()} ===`);
    const rendered = msg.content.map((part) => (part.type === "text" ? part.text : `[${part.type}]`)).join("");
    lines.push(rendered);
    lines.push("");
  }
  return lines.join("\n");
}

export const inspectEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqInspect, ResInspect> = {
  hash: "use-vibes.cli.inspect",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqInspect, ResInspect>) => {
    if (isReqInspect(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqInspect, ResInspect>): Promise<Result<EventoResultType>> => {
    const ectx = ctx.ctx.getOrThrow<CliCtx>("cliCtx");
    if (ectx.vibesDiyApiFactory === undefined) {
      return Result.Err("Not logged in. Run 'vibes-diy login' first.");
    }
    const args = ctx.validated;
    const api = ectx.vibesDiyApiFactory(args.apiUrl);

    const userSlug = await resolveUserSlug(api, args.userSlug === "" ? undefined : args.userSlug);

    await sendProgress(ctx, "info", "Inspecting prompt assembly...");

    const rChat = await api.openChat({ userSlug, appSlug: args.appSlug, mode: "chat" });
    if (rChat.isErr()) {
      return Result.Err(`Failed to open chat: ${formatErr(rChat.Err())}`);
    }
    const chat = rChat.Ok();

    const rInspect = await chat.inspect({
      messages: [{ role: "user", content: [{ type: "text", text: args.prompt }] }],
    });
    await chat.close();
    if (rInspect.isErr()) {
      return Result.Err(`Inspect failed: ${formatErr(rInspect.Err())}`);
    }
    const res = rInspect.Ok();

    const output = args.asText ? formatInspectAsText(res) : JSON.stringify(res, null, 2);

    return sendMsg(ctx, {
      type: "use-vibes.cli.res-inspect",
      appSlug: chat.appSlug,
      userSlug: chat.userSlug,
      chatId: chat.chatId,
      output,
    } satisfies ResInspect);
  },
};

export function inspectCmd(ctx: CliCtx) {
  return command({
    name: "inspect",
    description: "Dry-run: show the {model, messages} the server would dispatch for a chat continuation. No LLM call, no writes.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      appSlug: positional({
        displayName: "appSlug",
        description: "Slug of the app/chat to inspect",
        type: string,
      }),
      prompt: option({
        long: "prompt",
        short: "p",
        description: "Treat this text as the next user turn for assembly",
        type: string,
      }),
      userSlug: option({
        long: "user-slug",
        description: "User slug owning the app (uses default if omitted)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
      asText: flag({
        long: "text",
        description: "Render as a human-readable transcript instead of JSON",
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      return { type: "use-vibes.cli.inspect", ...args };
    }),
  });
}
