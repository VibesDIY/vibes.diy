import { run } from "cmd-ts";
import { describe, expect, it } from "vitest";
import { cmd_tsStream } from "../cmd-ts-stream.js";
import type { CliCtx } from "../cli-ctx.js";
import { ReqSetUnpublish, ReqPublish, unpublishCmd, publishCmd, isReqSetUnpublish, isReqPublish } from "./unpublish-cmd.js";

function makeCtx(): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined } } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
  };
}

async function enqueued(build: (ctx: CliCtx) => Parameters<typeof run>[0], argv: string[]): Promise<unknown> {
  const ctx = makeCtx();
  const reader = ctx.cliStream.stream.getReader();
  const firstRead = reader.read();
  await run(build(ctx), argv);
  const first = await firstRead;
  await ctx.cliStream.close();
  expect(first.done).toBe(false);
  return (first.value as { result: unknown }).result;
}

describe("unpublishCmd", () => {
  it("enqueues a set-unpublish request with unpublish:true and parsed vibe", async () => {
    const request = (await enqueued(unpublishCmd, [
      "jchris/hat-smeller",
      "--api-url",
      "https://example.com/api",
    ])) as ReqSetUnpublish;
    expect(isReqSetUnpublish(request)).toBe(true);
    expect(request.unpublish).toBe(true);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
    expect(request.apiUrl).toBe("https://example.com/api");
  });

  it("--vibe overrides positional", async () => {
    const request = (await enqueued(unpublishCmd, ["ignored", "--vibe", "alice/cool-app"])) as ReqSetUnpublish;
    expect(request.appSlug).toBe("cool-app");
    expect(request.ownerHandle).toBe("alice");
  });
});

describe("publishCmd", () => {
  it("enqueues a publish request (promote draft) with parsed vibe, no fsId by default", async () => {
    const request = (await enqueued(publishCmd, ["jchris/hat-smeller"])) as ReqPublish;
    expect(isReqPublish(request)).toBe(true);
    expect(request.appSlug).toBe("hat-smeller");
    expect(request.ownerHandle).toBe("jchris");
    expect(request.fsId).toBeUndefined();
  });

  it("passes --fsId through to publish a specific version", async () => {
    const request = (await enqueued(publishCmd, ["jchris/hat-smeller", "--fsId", "bafyfsid"])) as ReqPublish;
    expect(request.fsId).toBe("bafyfsid");
  });
});
