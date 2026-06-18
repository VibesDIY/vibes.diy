import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";

// Host-side bridge handler `vibeUpdateAvatarCid` (#1968). Dependencies are
// injected (chatApi + the optional confirmAvatarUpdate gate) so the handler is
// testable without stubbing globals or mocking modules — see
// agents/rules-bag.md "Never use mocking".

beforeAll(() => {
  if (typeof globalThis.window === "undefined") {
    (globalThis as unknown as Record<string, unknown>).window = globalThis;
  }
});

interface CapturedMsg {
  readonly data: unknown;
  readonly origin: string;
}

function fakeMessageEvent(data: unknown, origin: string, source: Window): MessageEvent {
  return { data, origin, source } as unknown as MessageEvent;
}

function setupSandbox(opts: { confirmAvatarUpdate?: (req: { cid: string; previewUrl?: string }) => Promise<boolean> }): {
  sandbox: vibesDiySrvSandbox;
  captured: CapturedMsg[];
  iframe: Window;
  ensureCalls: { settings: unknown[] }[];
  confirmCalls: { cid: string; previewUrl?: string }[];
} {
  const captured: CapturedMsg[] = [];
  const iframe = {
    postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
  } as unknown as Window;

  const ensureCalls: { settings: unknown[] }[] = [];
  const confirmCalls: { cid: string; previewUrl?: string }[] = [];

  const fakeApi = {
    onDocChanged: () => () => {
      /* noop */
    },
    ensureUserSettings: async (req: { settings: unknown[] }) => {
      ensureCalls.push(req);
      return Result.Ok({
        type: "vibes.diy.res-ensure-user-settings",
        userId: "u1",
        settings: req.settings,
        updated: new Date().toISOString(),
        created: new Date().toISOString(),
      });
    },
  } as unknown as Partial<VibesDiyApiIface>;

  const sandbox = new vibesDiySrvSandbox({
    chatApi: fakeApi as VibesDiyApiIface,
    vibeApi: fakeApi as VibesDiyApiIface,
    errorLogger: () => {
      /* noop */
    },
    eventListeners: {
      addEventListener: () => {
        /* noop */
      },
      removeEventListener: () => {
        /* noop */
      },
    },
    ...(opts.confirmAvatarUpdate
      ? {
          confirmAvatarUpdate: ((decide) => (req: { cid: string; previewUrl?: string }) => {
            confirmCalls.push(req);
            return decide(req);
          })(opts.confirmAvatarUpdate),
        }
      : {}),
  });
  return { sandbox, captured, iframe, ensureCalls, confirmCalls };
}

function postUpdate(sandbox: vibesDiySrvSandbox, iframe: Window, extra?: Record<string, unknown>): void {
  sandbox.handleMessage(
    fakeMessageEvent(
      { type: "vibe.req.updateAvatarCid", tid: "t1", appSlug: "myapp", ownerHandle: "alice", cid: "bafycid1", ...extra },
      "https://myapp--alice.example.com",
      iframe
    )
  );
}

describe("vibeUpdateAvatarCid host handler", () => {
  it("writes and responds ok when the confirm gate approves", async () => {
    const { sandbox, captured, iframe, ensureCalls, confirmCalls } = setupSandbox({
      confirmAvatarUpdate: async () => true,
    });

    postUpdate(sandbox, iframe, { previewUrl: "https://assets.example/bafycid1" });
    await new Promise((r) => setTimeout(r, 50));

    expect(confirmCalls).toEqual([{ cid: "bafycid1", previewUrl: "https://assets.example/bafycid1" }]);
    expect(ensureCalls).toHaveLength(1);
    expect(ensureCalls[0].settings).toEqual([{ type: "profile", avatarCid: "bafycid1" }]);
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.updateAvatarCid");
    expect(msg?.data).toMatchObject({ tid: "t1", status: "ok" });
  });

  it("skips the write and responds cancelled when the confirm gate declines", async () => {
    const { sandbox, captured, iframe, ensureCalls, confirmCalls } = setupSandbox({
      confirmAvatarUpdate: async () => false,
    });

    postUpdate(sandbox, iframe);
    await new Promise((r) => setTimeout(r, 50));

    expect(confirmCalls).toHaveLength(1);
    expect(ensureCalls).toHaveLength(0);
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.updateAvatarCid");
    expect(msg?.data).toMatchObject({ tid: "t1", status: "cancelled" });
  });

  it("writes directly when no confirm gate is wired (server/test paths)", async () => {
    const { sandbox, captured, iframe, ensureCalls } = setupSandbox({});

    postUpdate(sandbox, iframe);
    await new Promise((r) => setTimeout(r, 50));

    expect(ensureCalls).toHaveLength(1);
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.updateAvatarCid");
    expect(msg?.data).toMatchObject({ tid: "t1", status: "ok" });
  });
});
