import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface, VibesDiyError } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";
import { ResVibeWhoAmI } from "@vibes.diy/vibe-types";
import type { DbAcl } from "@vibes.diy/api-types";

// Task 7 host-side bridge handler `vibeWhoAmI`. Dependencies are injected
// (vibeDiyApi) so the handler is testable without stubbing globals or mocking
// modules — see agents/rules-bag.md "Never use mocking".

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

function setupSandbox(opts: { whoAmIResult: Result<ResVibeWhoAmI, VibesDiyError> }): {
  sandbox: vibesDiySrvSandbox;
  captured: CapturedMsg[];
  iframe: Window;
  whoAmICalls: { count: number };
} {
  const captured: CapturedMsg[] = [];
  const iframe = {
    postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
  } as unknown as Window;

  const whoAmICalls = { count: 0 };
  const fakeApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    whoAmI: async () => {
      whoAmICalls.count++;
      return opts.whoAmIResult;
    },
  };

  const sandbox = new vibesDiySrvSandbox({
    vibeDiyApi: fakeApi as VibesDiyApiIface,
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
  });
  return { sandbox, captured, iframe, whoAmICalls };
}

describe("vibeWhoAmI host handler", () => {
  it("happy path — calls vibeDiyApi.whoAmI and posts vibe.res.whoAmI with viewer + access", async () => {
    const { sandbox, captured, iframe, whoAmICalls } = setupSandbox({
      whoAmIResult: Result.Ok({
        type: "vibe.res.whoAmI" as const,
        tid: "t1",
        viewer: { userSlug: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
        access: "owner",
      } satisfies ResVibeWhoAmI),
    });

    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.whoAmI", tid: "t1", appSlug: "myapp", userSlug: "alice" },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(whoAmICalls.count).toBe(1);
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.whoAmI");
    expect(msg?.data).toMatchObject({
      tid: "t1",
      type: "vibe.res.whoAmI",
      viewer: { userSlug: "alice", displayName: "Alice", avatarUrl: "https://api.test/u/alice/avatar" },
      access: "owner",
    });
  });

  it("passes dbAcls through when present", async () => {
    const dbAcls: Record<string, DbAcl> = { "notes-db": { write: ["members"] } };
    const { sandbox, captured, iframe } = setupSandbox({
      whoAmIResult: Result.Ok({
        type: "vibe.res.whoAmI" as const,
        tid: "t2",
        viewer: { userSlug: "bob", displayName: "Bob", avatarUrl: "https://api.test/u/bob/avatar" },
        access: "viewer",
        dbAcls,
      } satisfies ResVibeWhoAmI),
    });

    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.whoAmI", tid: "t2", appSlug: "notes", userSlug: "alice" },
        "https://notes--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.whoAmI");
    expect(msg?.data).toMatchObject({
      tid: "t2",
      type: "vibe.res.whoAmI",
      access: "viewer",
      dbAcls,
    });
  });

  it("error path — when vibeDiyApi.whoAmI fails, posts fallback with viewer: null and access: 'none'", async () => {
    const { sandbox, captured, iframe, whoAmICalls } = setupSandbox({
      whoAmIResult: Result.Err<ResVibeWhoAmI, VibesDiyError>({
        type: "vibes.diy.res-error",
        name: "VibesDiyError",
        message: "unauthorized",
      } as VibesDiyError),
    });

    sandbox.handleMessage(
      fakeMessageEvent(
        { type: "vibe.req.whoAmI", tid: "t3", appSlug: "myapp", userSlug: "alice" },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(whoAmICalls.count).toBe(1);
    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibe.res.whoAmI");
    expect(msg?.data).toMatchObject({
      tid: "t3",
      type: "vibe.res.whoAmI",
      viewer: null,
      access: "none",
    });
  });
});
