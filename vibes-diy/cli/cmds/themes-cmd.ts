import { command, option, string } from "cmd-ts";
import {
  ValidateTriggerCtx,
  Result,
  HandleTriggerCtx,
  Option,
  EventoHandler,
  EventoResultType,
  exception2Result,
} from "@adviser/cement";
import { type } from "arktype";
import { getThemeCatalogNames, getThemeText, vibesThemes } from "@vibes.diy/prompts";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

export const ResThemesList = type({
  type: "'use-vibes.cli.res-themes-list'",
  themes: type({
    slug: "string",
    name: "string",
  }).array(),
});
export type ResThemesList = typeof ResThemesList.infer;

export function isResThemesList(obj: unknown): obj is ResThemesList {
  return !(ResThemesList(obj) instanceof type.errors);
}

export const ResThemeContent = type({
  type: "'use-vibes.cli.res-theme-content'",
  slug: "string",
  content: "string",
});
export type ResThemeContent = typeof ResThemeContent.infer;

export function isResThemeContent(obj: unknown): obj is ResThemeContent {
  return !(ResThemeContent(obj) instanceof type.errors);
}

type ResThemes = ResThemesList | ResThemeContent;

export const ReqThemes = type({
  type: "'use-vibes.cli.themes'",
});
export type ReqThemes = typeof ReqThemes.infer;

export function isReqThemes(obj: unknown): obj is ReqThemes {
  return !(ReqThemes(obj) instanceof type.errors);
}

const ThemesRawArgs = type({ slug: "string" });

export const themesEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqThemes, ResThemes> = {
  hash: "use-vibes.cli.themes",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqThemes, ResThemes>) => {
    if (isReqThemes(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqThemes, ResThemes>): Promise<Result<EventoResultType>> => {
    const rRaw = ThemesRawArgs(ctx.request.cmdTs.raw);
    if (rRaw instanceof type.errors) {
      return Result.Err(`invalid args: ${rRaw.summary}`);
    }
    const slug = rRaw.slug;

    switch (true) {
      case slug === "": {
        const themes = vibesThemes.map((t) => ({ slug: t.slug, name: t.name }));
        return sendMsg(ctx, {
          type: "use-vibes.cli.res-themes-list",
          themes,
        } satisfies ResThemesList);
      }
      default: {
        if (getThemeCatalogNames().has(slug) === false) {
          return Result.Err(`Unknown theme: ${slug}`);
        }
        const rText = await exception2Result(() => getThemeText(slug));
        if (rText.isErr()) {
          return Result.Err(`Failed to load theme content: ${rText.Err().message}`);
        }
        return sendMsg(ctx, {
          type: "use-vibes.cli.res-theme-content",
          slug,
          content: rText.Ok(),
        } satisfies ResThemeContent);
      }
    }
  },
};

export function themesCmd(ctx: CliCtx) {
  return command({
    name: "themes",
    description: "List available themes or show a theme's design markdown.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      slug: option({
        long: "slug",
        short: "s",
        description: "Theme slug to show content for (omit to list all)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((_args) => {
      return { type: "use-vibes.cli.themes" } satisfies ReqThemes;
    }),
  });
}
