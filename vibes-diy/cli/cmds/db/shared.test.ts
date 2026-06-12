import { describe, expect, it, vi } from "vitest";
import type { CliCtx } from "../../cli-ctx.js";
import type { VibesDiyApi } from "@vibes.diy/api-impl";
import { openVibeDbApi } from "./shared.js";

// #2343: db data commands must route to the per-vibe AppSessions DO
// (/api/app?vibe=<owner>--<app>, skipShard) so reads/writes/subscriptions share
// the DO the browser uses and participate in live doc-changed fan-out. Before
// this, they rode /api (ChatSessions, random shard) and never synced live.

function stubApiWithDefaultHandle(handle: string) {
  return {
    ensureUserSettings: vi.fn().mockResolvedValue({
      isErr: () => false,
      Ok: () => ({ settings: [{ type: "defaultHandle", ownerHandle: handle }] }),
    }),
    close: vi.fn(() => Promise.resolve()),
  } as unknown as VibesDiyApi;
}

describe("openVibeDbApi – routes db ops to AppSessions (#2343)", () => {
  it("resolves the default handle on a bootstrap connection, then opens /api/app?vibe= with skipShard", async () => {
    const calls: { url: string; opts: unknown }[] = [];
    const api = stubApiWithDefaultHandle("alice");
    const factory = vi.fn((url: string, opts?: unknown) => {
      calls.push({ url, opts });
      return api;
    }) as CliCtx["vibesDiyApiFactory"];
    const ectx = { vibesDiyApiFactory: factory } as unknown as CliCtx;

    const r = await openVibeDbApi(ectx, "https://vibes.diy/api?.stable-entry.=cli", "", "todos");

    expect(r.isErr()).toBe(false);
    expect(r.Ok().ownerHandle).toBe("alice");
    // bootstrap on the raw url (no opts), then the canonical AppSessions route
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ url: "https://vibes.diy/api?.stable-entry.=cli" });
    expect(calls[0].opts).toBeUndefined();
    expect(calls[1].url).toContain("/api/app");
    expect(calls[1].url).toContain(".stable-entry.=cli"); // backend selection preserved
    expect(calls[1].url).toContain("vibe=alice--todos");
    expect(calls[1].opts).toMatchObject({ skipShard: true });
    expect((api as unknown as { close: ReturnType<typeof vi.fn> }).close).toHaveBeenCalled();
  });

  it("skips the bootstrap connection when an explicit handle is supplied", async () => {
    const calls: { url: string; opts: unknown }[] = [];
    const api = stubApiWithDefaultHandle("ignored");
    const factory = vi.fn((url: string, opts?: unknown) => {
      calls.push({ url, opts });
      return api;
    }) as CliCtx["vibesDiyApiFactory"];
    const ectx = { vibesDiyApiFactory: factory } as unknown as CliCtx;

    const r = await openVibeDbApi(ectx, "https://vibes.diy/api?.stable-entry.=cli", "bob", "notes");

    expect(r.Ok().ownerHandle).toBe("bob");
    // only the routed connection — no default-handle lookup needed
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/app");
    expect(calls[0].url).toContain(".stable-entry.=cli"); // backend selection preserved
    expect(calls[0].url).toContain("vibe=bob--notes");
    expect(calls[0].opts).toMatchObject({ skipShard: true });
  });

  it("errors when not logged in (no api factory)", async () => {
    const ectx = { vibesDiyApiFactory: undefined } as unknown as CliCtx;
    const r = await openVibeDbApi(ectx, "https://vibes.diy/api", "", "todos");
    expect(r.isErr()).toBe(true);
  });
});
