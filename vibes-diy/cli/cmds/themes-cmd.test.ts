import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import type { WrapCmdTSMsg } from "../cmd-evento.js";
import { themesCmd, isReqThemes } from "./themes-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

async function runThemes(args: string[]): Promise<WrapCmdTSMsg<unknown>> {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(themesCmd(ctx), args);
  const first = await firstRead;
  await ctx.cliStream.close();
  expect(first.done).toBe(false);
  return first.value as WrapCmdTSMsg<unknown>;
}

describe("themesCmd", () => {
  it("enqueues a request that passes isReqThemes", async () => {
    const wmsg = await runThemes([]);
    expect(isReqThemes(wmsg.result)).toBe(true);
  });

  it("defaults to text output format", async () => {
    const wmsg = await runThemes([]);
    expect(wmsg.cmdTs.outputFormat).toBe("text");
  });

  it("selects json output format with --json", async () => {
    const wmsg = await runThemes(["--json"]);
    expect(wmsg.cmdTs.outputFormat).toBe("json");
  });

  it("selects json output format with -j", async () => {
    const wmsg = await runThemes(["-j"]);
    expect(wmsg.cmdTs.outputFormat).toBe("json");
  });
});
