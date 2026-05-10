import { describe, it, expect, vi } from "vitest";
import { Result } from "@adviser/cement";
import type { VibesDiyApi } from "./index.js";
import { FireflyApiAdapter } from "./firefly-api-adapter.js";

function fakeVibesDiyApi(overrides: Partial<Record<string, unknown>> = {}): VibesDiyApi {
  return {
    ensureUserSettings: vi.fn(async () =>
      Result.Ok({
        type: "vibes.diy.res-ensure-user-settings",
        userId: "user-1",
        settings: [{ type: "defaultUserSlug", userSlug: "alice" }],
        updated: "now",
        created: "now",
      })
    ),
    onDocChanged: vi.fn(() => () => {}),
    ...overrides,
  } as unknown as VibesDiyApi;
}

describe("FireflyApiAdapter", () => {
  it("exposes svc.vibeApp.appSlug from constructor", () => {
    const adapter = new FireflyApiAdapter(fakeVibesDiyApi(), "my-app");
    expect(adapter.svc.vibeApp.appSlug).toBe("my-app");
  });

  it("resolves userSlug from ensureUserSettings.defaultUserSlug on first request", async () => {
    const api = fakeVibesDiyApi();
    const adapter = new FireflyApiAdapter(api, "my-app");
    const slug = await adapter.resolveUserSlug();
    expect(slug).toBe("alice");
    expect(api.ensureUserSettings).toHaveBeenCalledTimes(1);
    // Second call uses the cache
    await adapter.resolveUserSlug();
    expect(api.ensureUserSettings).toHaveBeenCalledTimes(1);
  });

  it("uses opts.userSlug override and skips ensureUserSettings", async () => {
    const api = fakeVibesDiyApi();
    const adapter = new FireflyApiAdapter(api, "my-app", { userSlug: "bob" });
    expect(await adapter.resolveUserSlug()).toBe("bob");
    expect(api.ensureUserSettings).not.toHaveBeenCalled();
  });

  it("throws when ensureUserSettings has no defaultUserSlug entry", async () => {
    const api = fakeVibesDiyApi({
      ensureUserSettings: vi.fn(async () =>
        Result.Ok({
          type: "vibes.diy.res-ensure-user-settings",
          userId: "user-1",
          settings: [],
          updated: "now",
          created: "now",
        })
      ),
    });
    const adapter = new FireflyApiAdapter(api, "my-app");
    await expect(adapter.resolveUserSlug()).rejects.toThrow(/defaultUserSlug/);
  });
});
