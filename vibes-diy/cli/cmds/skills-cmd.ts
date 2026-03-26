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
import { getLlmCatalog, getLlmCatalogNames, getSkillText } from "@vibes.diy/prompts";
import { CliCtx, cmdTsDefaultArgs } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

export const ResSkillsList = type({
  type: "'use-vibes.cli.res-skills-list'",
  skills: type({
    name: "string",
    description: "string",
  }).array(),
});
export type ResSkillsList = typeof ResSkillsList.infer;

export function isResSkillsList(obj: unknown): obj is ResSkillsList {
  return !(ResSkillsList(obj) instanceof type.errors);
}

export const ResSkillContent = type({
  type: "'use-vibes.cli.res-skill-content'",
  name: "string",
  content: "string",
});
export type ResSkillContent = typeof ResSkillContent.infer;

export function isResSkillContent(obj: unknown): obj is ResSkillContent {
  return !(ResSkillContent(obj) instanceof type.errors);
}

type ResSkills = ResSkillsList | ResSkillContent;

export const ReqSkills = type({
  type: "'use-vibes.cli.skills'",
});
export type ReqSkills = typeof ReqSkills.infer;

export function isReqSkills(obj: unknown): obj is ReqSkills {
  return !(ReqSkills(obj) instanceof type.errors);
}

const SkillsRawArgs = type({ name: "string" });

export const skillsEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqSkills, ResSkills> = {
  hash: "use-vibes.cli.skills",
  validate: (ctx: ValidateTriggerCtx<WrapCmdTSMsg<unknown>, ReqSkills, ResSkills>) => {
    if (isReqSkills(ctx.enRequest)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqSkills, ResSkills>): Promise<Result<EventoResultType>> => {
    const rRaw = SkillsRawArgs(ctx.request.cmdTs.raw);
    if (rRaw instanceof type.errors) {
      return Result.Err(`invalid args: ${rRaw.summary}`);
    }
    const name = rRaw.name;

    switch (true) {
      case name === "": {
        const rCatalog = await exception2Result(() => getLlmCatalog());
        if (rCatalog.isErr()) {
          return Result.Err(`Failed to load skills catalog: ${rCatalog.Err().message}`);
        }
        const skills = rCatalog.Ok().map((s) => ({ name: s.name, description: s.description }));
        return sendMsg(ctx, {
          type: "use-vibes.cli.res-skills-list",
          skills,
        } satisfies ResSkillsList);
      }
      default: {
        const rNames = await exception2Result(() => getLlmCatalogNames());
        if (rNames.isErr()) {
          return Result.Err(`Failed to load skill catalog: ${rNames.Err().message}`);
        }
        if (rNames.Ok().has(name) === false) {
          return Result.Err(`Unknown skill: ${name}`);
        }
        const rText = await exception2Result(() => getSkillText(name));
        if (rText.isErr()) {
          return Result.Err(`Failed to load skill content: ${rText.Err().message}`);
        }
        return sendMsg(ctx, {
          type: "use-vibes.cli.res-skill-content",
          name,
          content: rText.Ok(),
        } satisfies ResSkillContent);
      }
    }
  },
};

export function skillsCmd(ctx: CliCtx) {
  return command({
    name: "skills",
    description: "List available skills or show a skill's content.",
    args: {
      ...cmdTsDefaultArgs(ctx),
      name: option({
        long: "name",
        short: "n",
        description: "Skill name to show content for (omit to list all)",
        type: string,
        defaultValue: () => "",
        defaultValueIsSerializable: true,
      }),
    },
    handler: ctx.cliStream.enqueue((_args) => {
      return { type: "use-vibes.cli.skills" } satisfies ReqSkills;
    }),
  });
}
