import { describe, expect, it, vi } from "vitest";
import { Result } from "@adviser/cement";
import { VibesDiySrvSandbox, verifyRegistrationOrigin } from "../../vibe/srv-sandbox/srv-sandbox.ts";

describe("verifyRegistrationOrigin", () => {
  it("accepts matching origin and trusted hostname base", () => {
    expect(
      verifyRegistrationOrigin({
        origin: "https://my-app--my-user.localhost.vibesdiy.net",
        appSlug: "my-app",
        userSlug: "my-user",
        hostnameBase: "localhost.vibesdiy.net",
      })
    ).toBe(true);
  });

  it("rejects mismatched appSlug", () => {
    expect(
      verifyRegistrationOrigin({
        origin: "https://other-app--my-user.localhost.vibesdiy.net",
        appSlug: "my-app",
        userSlug: "my-user",
        hostnameBase: "localhost.vibesdiy.net",
      })
    ).toBe(false);
  });

  it("rejects untrusted hostname base even when prefix matches", () => {
    expect(
      verifyRegistrationOrigin({
        origin: "https://my-app--my-user.evil.com",
        appSlug: "my-app",
        userSlug: "my-user",
        hostnameBase: "localhost.vibesdiy.net",
      })
    ).toBe(false);
  });

  it("rejects malformed origin", () => {
    expect(
      verifyRegistrationOrigin({
        origin: "not a url",
        appSlug: "my-app",
        userSlug: "my-user",
        hostnameBase: "localhost.vibesdiy.net",
      })
    ).toBe(false);
  });
});

describe("VibesDiySrvSandbox registration wiring", () => {
  const makeSandbox = () => {
    const errorLogger = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const dashApi = {
      ensureUser: vi.fn().mockResolvedValue(Result.Ok({})),
      ensureCloudToken: vi.fn().mockResolvedValue(
        Result.Ok({
          cloudToken: "token",
          appId: "app-id",
          tenant: "tenant",
          ledger: "ledger",
          expiresInSec: 60,
          expiresDate: new Date().toISOString(),
          claims: {},
        })
      ),
    } as unknown as ReturnType<typeof import("@fireproof/core-protocols-dashboard").clerkDashApi>;
    const vibeDiyApi = {
      openChat: vi.fn(),
    } as unknown as import("@vibes.diy/api-types").VibesDiyApiIface;

    const sandbox = VibesDiySrvSandbox({
      dashApi,
      vibeDiyApi,
      errorLogger,
      eventListeners: {
        addEventListener: addEventListener as typeof window.addEventListener,
        removeEventListener: removeEventListener as typeof window.removeEventListener,
      },
      hostnameBase: "localhost.vibesdiy.net",
    });

    return { sandbox, errorLogger };
  };

  const registrationData = {
    tid: "t-1",
    type: "vibe.req.register.fpdb" as const,
    dbName: "main",
    appSlug: "my-app",
    userSlug: "my-user",
    fsId: "zabc12345",
  };

  it("rejects mismatched origin and logs warning", async () => {
    const { sandbox, errorLogger } = makeSandbox();
    const event = {
      data: registrationData,
      origin: "https://other-app--my-user.localhost.vibesdiy.net",
      source: { postMessage: vi.fn() },
    } as unknown as MessageEvent;

    await sandbox.evento.trigger({
      request: event,
      send: {
        send: vi.fn().mockResolvedValue(Result.Ok(undefined)),
      },
    });

    expect(errorLogger).toHaveBeenCalledWith(expect.stringContaining("Origin mismatch in vibe.register.fpdb"));
    const key = `${registrationData.userSlug}-${registrationData.appSlug}-${registrationData.dbName}`;
    expect(sandbox.shareableDBs.get(key)).toBeUndefined();
  });

  it("accepts matching origin and stores registration", async () => {
    const { sandbox, errorLogger } = makeSandbox();
    const send = vi.fn().mockResolvedValue(Result.Ok(undefined));
    const event = {
      data: registrationData,
      origin: "https://my-app--my-user.localhost.vibesdiy.net",
      source: { postMessage: vi.fn() },
    } as unknown as MessageEvent;

    await sandbox.evento.trigger({
      request: event,
      send: { send },
    });

    const key = `${registrationData.userSlug}-${registrationData.appSlug}-${registrationData.dbName}`;
    expect(send).toHaveBeenCalled();
    expect(sandbox.shareableDBs.get(key)).toBeDefined();
    expect(errorLogger).not.toHaveBeenCalledWith(expect.stringContaining("Origin mismatch in vibe.register.fpdb"));
  });
});
