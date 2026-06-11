import { beforeAll, describe, expect, it } from "vitest";
import { vibesDiySrvSandbox } from "@vibes.diy/vibe-srv-sandbox";
import { VibesDiyApiIface, VibesDiyError, ResPutDoc } from "@vibes.diy/api-types";
import { Result } from "@adviser/cement";

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

function setupSandbox(opts: { putDocResult: Result<ResPutDoc, VibesDiyError> }): {
  sandbox: vibesDiySrvSandbox;
  captured: CapturedMsg[];
  iframe: Window;
  putDocCalls: { count: number };
  errorLogs: unknown[];
} {
  const captured: CapturedMsg[] = [];
  const iframe = {
    postMessage: (data: unknown, origin: string) => captured.push({ data, origin }),
  } as unknown as Window;

  const putDocCalls = { count: 0 };
  const fakeApi: Partial<VibesDiyApiIface> = {
    onDocChanged: () => () => {
      /* noop */
    },
    putDoc: async () => {
      putDocCalls.count++;
      return opts.putDocResult;
    },
  };

  const errorLogs: unknown[] = [];
  const sandbox = new vibesDiySrvSandbox({
    chatApi: fakeApi as VibesDiyApiIface,
    vibeApi: fakeApi as VibesDiyApiIface,
    errorLogger: (message) => {
      errorLogs.push(message);
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

  return { sandbox, captured, iframe, putDocCalls, errorLogs };
}

describe("vibePutDoc host handler", () => {
  it("error path — invokes errorLogger and posts res-put-doc error", async () => {
    const { sandbox, captured, iframe, putDocCalls, errorLogs } = setupSandbox({
      putDocResult: Result.Err<ResPutDoc, VibesDiyError>({
        type: "vibes.diy.res-error",
        name: "VibesDiyError",
        message: "db write failed",
      } as VibesDiyError),
    });

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "vibes.diy.req-put-doc",
          tid: "t1",
          appSlug: "myapp",
          ownerHandle: "alice",
          dbName: "notes",
          doc: { title: "hello" },
        },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(putDocCalls.count).toBe(1);
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0]).toBe("Failed to save your changes. Please try again.");

    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-put-doc");
    expect(msg?.data).toMatchObject({
      tid: "t1",
      type: "vibes.diy.res-put-doc",
      status: "error",
      message: "db write failed",
    });
  });

  it("maps access-denied style errors to read-only toast copy", async () => {
    const { sandbox, captured, iframe, errorLogs } = setupSandbox({
      putDocResult: Result.Err<ResPutDoc, VibesDiyError>({
        type: "vibes.diy.res-error",
        name: "VibesDiyError",
        message: "Access denied",
      } as VibesDiyError),
    });

    sandbox.handleMessage(
      fakeMessageEvent(
        {
          type: "vibes.diy.req-put-doc",
          tid: "t2",
          appSlug: "myapp",
          ownerHandle: "alice",
          dbName: "notes",
          doc: { title: "hello" },
        },
        "https://myapp--alice.example.com",
        iframe
      )
    );
    await new Promise((r) => setTimeout(r, 50));

    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0]).toBe("You have read-only access to this app.");

    const msg = captured.find((c) => (c.data as { type?: string }).type === "vibes.diy.res-put-doc");
    expect(msg?.data).toMatchObject({
      tid: "t2",
      type: "vibes.diy.res-put-doc",
      status: "error",
      message: "Access denied",
    });
  });
});
