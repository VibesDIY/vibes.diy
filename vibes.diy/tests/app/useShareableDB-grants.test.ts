import { describe, expect, it, vi } from "vitest";
import { Result } from "@adviser/cement";
import { mergeSharingGrants, saveSharingGrant } from "~/vibes.diy/app/hooks/useShareableDB.js";

describe("mergeSharingGrants", () => {
  it("replaces matching db grants and keeps unrelated grants", () => {
    const merged = mergeSharingGrants(
      {
        type: "sharing",
        grants: [
          { grant: "allow", appSlug: "app-a", userSlug: "user-a", dbName: "main" },
          { grant: "deny", appSlug: "app-b", userSlug: "user-b", dbName: "*" },
        ],
      },
      { grant: "allow", appSlug: "app-a", userSlug: "user-a", dbName: "main" }
    );

    expect(merged).toEqual([
      { grant: "deny", appSlug: "app-b", userSlug: "user-b", dbName: "*" },
      { grant: "allow", appSlug: "app-a", userSlug: "user-a", dbName: "main" },
    ]);
  });

  it("replaces wildcard grant for same app/user when adding specific db grant", () => {
    const merged = mergeSharingGrants(
      {
        type: "sharing",
        grants: [
          { grant: "allow", appSlug: "app-a", userSlug: "user-a", dbName: "*" },
          { grant: "deny", appSlug: "app-c", userSlug: "user-c", dbName: "logs" },
        ],
      },
      { grant: "allow", appSlug: "app-a", userSlug: "user-a", dbName: "main" }
    );

    expect(merged).toEqual([
      { grant: "deny", appSlug: "app-c", userSlug: "user-c", dbName: "logs" },
      { grant: "allow", appSlug: "app-a", userSlug: "user-a", dbName: "main" },
    ]);
  });

  it("returns just the new grant when existing sharing is undefined", () => {
    const merged = mergeSharingGrants(undefined, { grant: "allow", appSlug: "app-a", userSlug: "user-a", dbName: "main" });

    expect(merged).toEqual([{ grant: "allow", appSlug: "app-a", userSlug: "user-a", dbName: "main" }]);
  });
});

describe("saveSharingGrant", () => {
  it("surfaces save errors", async () => {
    const ensureUserSettings = vi.fn().mockResolvedValue(Result.Err(new Error("save failed")));
    const onError = vi.fn();
    const onSaved = vi.fn();

    await saveSharingGrant({
      vibeDiyApi: { ensureUserSettings } as never,
      grant: { grant: "allow", appSlug: "my-app", userSlug: "my-user", dbName: "main" },
      existingSharing: undefined,
      onError,
      onSaved,
    });

    expect(ensureUserSettings).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("Failed to save sharing settings"));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("calls onSaved with sharing setting on success", async () => {
    const sharingResult = {
      type: "sharing" as const,
      grants: [{ grant: "allow" as const, appSlug: "my-app", userSlug: "my-user", dbName: "main" }],
    };
    const ensureUserSettings = vi.fn().mockResolvedValue(
      Result.Ok({
        settings: [sharingResult],
      })
    );
    const onError = vi.fn();
    const onSaved = vi.fn();

    await saveSharingGrant({
      vibeDiyApi: { ensureUserSettings } as never,
      grant: { grant: "allow", appSlug: "my-app", userSlug: "my-user", dbName: "main" },
      existingSharing: undefined,
      onError,
      onSaved,
    });

    expect(onSaved).toHaveBeenCalledWith(sharingResult);
    expect(onError).not.toHaveBeenCalled();
  });
});
