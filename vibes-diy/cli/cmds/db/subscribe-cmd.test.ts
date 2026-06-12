import { AppContext, BuildURI } from "@adviser/cement";
import { describe, expect, it, vi } from "vitest";
import { cmd_tsStream } from "../../cmd-ts-stream.js";
import type { CliCtx } from "../../cli-ctx.js";
import type { VibesDiyApi } from "@vibes.diy/api-impl";
import { dbSubscribeEvento } from "./subscribe-cmd.js";
import type { ReqDbSubscribe } from "./subscribe-cmd.js";

function makeCtx(factoryOverride?: CliCtx["vibesDiyApiFactory"]): CliCtx {
  const cliStream = cmd_tsStream();
  return {
    sthis: { env: { get: () => undefined }, nextId: () => ({ str: "test-id" }) } as unknown as CliCtx["sthis"],
    cliStream,
    output: { stdout: () => undefined, stderr: () => undefined },
    exitCode: 0,
    vibesDiyApiFactory: factoryOverride,
  };
}

describe("dbSubscribeEvento – canonical route", () => {
  it("calls vibesDiyApiFactory with /api/app?vibe=<handle>--<appSlug> and skipShard:true after resolving handle", async () => {
    const factoryCalls: { url: string; opts: unknown }[] = [];

    // Stub API: resolveUserSlug calls ensureUserSettings; subscribeDocs must exist;
    // enableGrantReactivity calls subscribeViewerGrants + onViewerGrantsChanged
    const stubApi = {
      ensureUserSettings: vi.fn().mockResolvedValue({
        isErr: () => false,
        Ok: () => ({
          settings: [{ type: "defaultHandle", ownerHandle: "alice" }],
        }),
      }),
      close: vi.fn(() => Promise.resolve()),
      subscribeViewerGrants: vi.fn().mockResolvedValue(undefined),
      onViewerGrantsChanged: vi.fn(),
      subscribeDocs: vi.fn().mockResolvedValue({
        isErr: () => true,
        Err: () => "test-abort",
      }),
    } as unknown as VibesDiyApi;

    const factory = vi.fn((url: string, opts?: unknown) => {
      factoryCalls.push({ url, opts });
      return stubApi;
    }) as CliCtx["vibesDiyApiFactory"];

    const ctx = makeCtx(factory);
    const appCtx = new AppContext().set("cliCtx", ctx);

    const validated: ReqDbSubscribe = {
      type: "vibes-diy.cli.db.subscribe",
      apiUrl: "https://vibes.diy/api?.stable-entry.=cli",
      appSlug: "todos",
      ownerHandle: "",
      dbName: "default",
    };

    // We expect the handler to return an error from subscribeDocs (which is fine —
    // we only care that the factory was called with the right URL before that).
    await dbSubscribeEvento.handle({
      ctx: appCtx,
      validated,
      send: { send: vi.fn(), done: vi.fn() },
      enRequest: validated,
    } as unknown as Parameters<(typeof dbSubscribeEvento)["handle"]>[0]);

    // Factory must have been called at least twice: once for bootstrap, once for routed
    expect(factory).toHaveBeenCalledTimes(2);

    // Second call carries the canonical route + skipShard
    const [routedUrl, routedOpts] = (factory as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(routedUrl).toContain("/api/app");
    expect(routedUrl).toContain("vibe=alice--todos");
    expect(routedOpts).toMatchObject({ skipShard: true });
  });

  it("builds canonical URL preserving stable-entry routing", () => {
    const apiUrl = "https://vibes.diy/api?.stable-entry.=cli";
    const ownerHandle = "alice";
    const appSlug = "todos";
    // No cleanParams: the stable-entry backend selector must survive the rewrite
    // (the CLI has no cookie fallback). See #2343.
    const routedUrl = BuildURI.from(apiUrl).pathname("/api/app").setParam("vibe", `${ownerHandle}--${appSlug}`).toString();
    expect(routedUrl).toContain("/api/app");
    expect(routedUrl).toContain(".stable-entry.=cli");
    expect(routedUrl).toContain("vibe=alice--todos");
  });
});
