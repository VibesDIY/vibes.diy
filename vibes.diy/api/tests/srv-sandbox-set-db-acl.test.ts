import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface, VibesDiyError } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";
import type { ResEnsureAppSettings, ReqEnsureAppSettings, Req } from "@vibes.diy/api-types";
import type { DbAcl } from "@vibes.diy/vibe-types";

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

function setupSandbox() {
  const captured: CapturedMsg[] = [];
  const iframe = {
    postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
  } as unknown as Window;

  const ensureAppSettingsCalls: Array<Req<ReqEnsureAppSettings>> = [];
  const fakeApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    ensureAppSettings: async (req) => {
      ensureAppSettingsCalls.push(req);
      return Result.Ok({} as ResEnsureAppSettings);
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

  return { sandbox, captured, iframe, ensureAppSettingsCalls };
}

describe("vibeSetDbAcl host handler", () => {
  it("happy path — calls vibeDiyApi.ensureAppSettings with dbAcl and posts res-set-db-acl ok", async () => {
    const { sandbox, captured, iframe, ensureAppSettingsCalls } = setupSandbox();
    const acl: DbAcl = { write: ["editors"], delete: ["editors"] };

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "vibes.diy.req-set-db-acl",
          tid: "t1",
          appSlug: "myapp",
          userSlug: "alice",
          dbName: "announcements",
          acl,
        },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(ensureAppSettingsCalls).toHaveLength(1);
    expect(ensureAppSettingsCalls[0]).toMatchObject({
      appSlug: "myapp",
      userSlug: "alice",
      dbAcl: { dbName: "announcements", acl },
    });

    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-set-db-acl");
    expect(msg?.data).toMatchObject({
      tid: "t1",
      type: "vibes.diy.res-set-db-acl",
      status: "ok",
    });
  });

  it("error path — when ensureAppSettings fails, posts res-set-db-acl with status error", async () => {
    const captured: CapturedMsg[] = [];
    const iframe = {
      postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
    } as unknown as Window;

    const fakeApi: Partial<VibesDiyApiIface> = {
      onDocChanged: () => () => {
        /* noop */
      },
      ensureAppSettings: async () =>
        Result.Err<ResEnsureAppSettings, VibesDiyError>({
          type: "vibes.diy.res-error",
          name: "VibesDiyError",
          message: "forbidden",
        } as VibesDiyError),
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

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "vibes.diy.req-set-db-acl",
          tid: "t2",
          appSlug: "myapp",
          userSlug: "alice",
          dbName: "announcements",
          acl: { write: ["editors"] },
        },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-set-db-acl");
    expect(msg?.data).toMatchObject({
      tid: "t2",
      type: "vibes.diy.res-set-db-acl",
      status: "error",
    });
  });

  it("ignores messages with wrong type", async () => {
    const { sandbox, captured, iframe, ensureAppSettingsCalls } = setupSandbox();

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "something-else",
          tid: "t3",
          appSlug: "a",
          userSlug: "b",
          dbName: "c",
          acl: {},
        },
        "https://a--b.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(ensureAppSettingsCalls).toHaveLength(0);
    expect(captured.filter((c) => (c.data as { type?: string }).type === "vibes.diy.res-set-db-acl")).toHaveLength(0);
  });
});
