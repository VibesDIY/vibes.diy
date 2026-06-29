import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqSetUnpublish, unpublishCmd, publishCmd, isReqSetUnpublish } from "./unpublish-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

async function enqueued(build: (ctx: CliCtx) => ReturnType<typeof unpublishCmd>, argv: string[]): Promise<ReqSetUnpublish> {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(build(ctx), argv);
  const first = await firstRead;
  await ctx.cliStream.close();
  expect(first.done).toBe(false);
  return (first.value as { result: ReqSetUnpublish }).result;
}

describe("unpublishCmd / publishCmd", () => {
  it("unpublish enqueues unpublish:true with parsed vibe", async () => {
    const request = await enqueued(unpublishCmd, ["jchris/hat-smeller", "--api-url", "https://example.com/api"]);
    expect(isReqSetUnpublish(request)).toBe(true);
    expect(request.unpublish).toBe(true);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
    expect(request.apiUrl).toBe("https://example.com/api");
  });

  it("publish (restore) enqueues unpublish:false", async () => {
    const request = await enqueued(publishCmd, ["jchris/hat-smeller"]);
    expect(request.unpublish).toBe(false);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
  });

  it("--vibe overrides positional", async () => {
    const request = await enqueued(unpublishCmd, ["ignored", "--vibe", "alice/cool-app"]);
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
  });
});
