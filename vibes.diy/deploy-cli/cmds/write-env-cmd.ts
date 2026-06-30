import { command, option, string, flag, optional, array, multioption } from "cmd-ts";
import { Result, Option, param, envFactory, EventoHandler, EventoResultType, HandleTriggerCtx } from "@adviser/cement";
import { type } from "arktype";
import * as path from "node:path";
import fs from "node:fs/promises";
import { CliCtx } from "../cli-ctx.js";
import { sendMsg, WrapCmdTSMsg } from "../cmd-evento.js";

// In `@fireproof/core-cli` this was `rt.sts.envKeyDefaults.PUBLIC` from
// `@fireproof/core-runtime`. We inline the literal so the rehomed deploy command
// carries ZERO `@fireproof/core-*` dependency (direct or transitive) — the same
// hard gate `@vibes.diy/build-cli` had to satisfy. It is only referenced in the
// no-`--fromEnv` local-dev branch the deploy never hits. See VibesDIY/vibes.diy#2905
// and docs/superpowers/specs/2026-06-30-rehome-writeenv-retire-core-cli-design.md.
const PUBLIC_ENV_KEY = "CLOUD_SESSION_TOKEN_PUBLIC";

export const ReqWriteEnv = type({
  type: "'core-cli.write-env'",
  wranglerToml: "string",
  env: "string",
  doNotOverwrite: "boolean",
  excludeSecrets: "boolean",
  fromEnv: "string[]",
  out: "string | undefined",
  json: "boolean",
});
export type ReqWriteEnv = typeof ReqWriteEnv.infer;

export const ResWriteEnv = type({
  type: "'core-cli.res-write-env'",
  output: "string",
});
export type ResWriteEnv = typeof ResWriteEnv.infer;

export function isResWriteEnv(u: unknown): u is ResWriteEnv {
  return !(ResWriteEnv(u) instanceof type.errors);
}

export async function writeEnvFile(
  envFname: string,
  outFname: string | undefined,
  env: string,
  vals: Record<string, string>,
  doNotOverwrite: boolean,
  json: boolean
): Promise<string> {
  let render: string;
  if (json) {
    render = JSON.stringify(vals, null, 2);
  } else {
    render = Object.entries(vals)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
  }
  if (outFname === "-") {
    process.stdout.write(render + "\n");
    return "-";
  }
  const fname = outFname ?? path.join(path.dirname(envFname), `.dev.vars.${env}`);
  if (
    doNotOverwrite &&
    (await fs
      .stat(fname)
      .then(() => true)
      .catch(() => false))
  ) {
    return fname;
  }
  await fs.writeFile(fname, render);
  return fname;
}

export const writeEnvEvento: EventoHandler<WrapCmdTSMsg<unknown>, ReqWriteEnv, ResWriteEnv> = {
  hash: "core-cli.write-env",
  validate: (ctx) => {
    if (!(ReqWriteEnv(ctx.enRequest) instanceof type.errors)) {
      return Promise.resolve(Result.Ok(Option.Some(ctx.enRequest as ReqWriteEnv)));
    }
    return Promise.resolve(Result.Ok(Option.None()));
  },
  handle: async (ctx: HandleTriggerCtx<WrapCmdTSMsg<unknown>, ReqWriteEnv, ResWriteEnv>): Promise<Result<EventoResultType>> => {
    // `envFactory()` is exactly the cement env the old `SuperThis.env` wrapped,
    // so `.gets()` preserves the upstream REQUIRED / OPTIONAL / literal-default
    // and empty-string-as-missing semantics byte-for-byte.
    const env = envFactory();
    const args = ctx.validated;
    const vals: Record<string, param | string> = {};
    if (args.fromEnv.length === 0) {
      vals[PUBLIC_ENV_KEY] = param.REQUIRED;
      vals["STORAGE_URL"] = env.get("STORAGE_URL") ?? "http://127.0.0.1:9000/testbucket";
      vals["FP_STORAGE_URL"] = param.OPTIONAL;
      if (!args.excludeSecrets) {
        vals["ACCESS_KEY_ID"] = "minioadmin";
        vals["SECRET_ACCESS_KEY"] = "minioadmin";
      }
    } else {
      Array.from(new Set(args.fromEnv))
        .sort()
        .reduce((acc, i) => {
          const [k, v] = i.split("=");
          if (v === undefined) {
            acc[k] = param.REQUIRED;
          } else {
            acc[k] = v;
          }
          return acc;
        }, vals);
    }
    const rVal = env.gets(vals);
    if (rVal.isErr()) {
      return Result.Err(rVal.Err());
    }
    const fname = await writeEnvFile(args.wranglerToml, args.out, args.env, rVal.Ok(), args.doNotOverwrite, args.json);
    const output = ["-", "stdout"].find((i) => args.out?.includes(i))
      ? ""
      : `Wrote: ${fname} keys:  ${JSON.stringify(Object.keys(rVal.Ok()))}`;
    return sendMsg(ctx, {
      type: "core-cli.res-write-env",
      output,
    } satisfies ResWriteEnv);
  },
};

export function writeEnvCmd(ctx: CliCtx) {
  return command({
    name: "cli-write-env",
    description: "write env file",
    version: "1.0.0",
    args: {
      wranglerToml: option({
        long: "wranglerToml",
        type: string,
        defaultValue: () => "./wrangler.toml",
        defaultValueIsSerializable: true,
      }),
      env: option({
        long: "env",
        type: string,
        defaultValue: () => "test",
        defaultValueIsSerializable: true,
      }),
      doNotOverwrite: flag({
        long: "doNotOverwrite",
      }),
      excludeSecrets: flag({
        long: "excludeSecrets",
      }),
      fromEnv: multioption({
        long: "fromEnv",
        type: array(string),
      }),
      out: option({
        long: "out",
        type: optional(string),
      }),
      json: flag({
        long: "json",
      }),
    },
    handler: ctx.cliStream.enqueue((args) => {
      return {
        type: "core-cli.write-env",
        ...args,
      };
    }),
  });
}
