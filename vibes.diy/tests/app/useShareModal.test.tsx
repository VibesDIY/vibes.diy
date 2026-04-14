import { act, renderHook, waitFor } from "@testing-library/react";
import { Result } from "@adviser/cement";
import { describe, expect, it } from "vitest";

import { useShareModal } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";
import type { ShareModalApi } from "~/vibes.diy/app/components/ResultPreview/useShareModal.js";

type EnsureResult = Awaited<ReturnType<ShareModalApi["ensureAppSettings"]>>;
type EnsureOk = EnsureResult extends Result<infer Ok, unknown> ? Ok : never;

type SetModeResult = Awaited<ReturnType<ShareModalApi["setSetModeFs"]>>;
type SetModeOk = SetModeResult extends Result<infer Ok, unknown> ? Ok : never;

function makeEnsureRes(autoAcceptViewRequest: boolean): EnsureOk {
  const now = new Date().toISOString();

  return {
    type: "vibes.diy.res-ensure-app-settings",
    userId: "test-user",
    appSlug: "test-app",
    ledger: "test-ledger",
    userSlug: "test-user",
    tenant: "test-tenant",
    settings: {
      entries: [],
      entry: {
        settings: {
          env: [],
        },
        enableRequest: {
          type: "app.request",
          enable: true,
          autoAcceptViewRequest,
        },
      },
    },
    updated: now,
    created: now,
  };
}

function makeSetModeRes({
  fsId,
  appSlug,
  userSlug,
  mode,
}: {
  fsId: string;
  appSlug: string;
  userSlug: string;
  mode: "production";
}): SetModeOk {
  return {
    type: "vibes.diy.res-set-mode-fs",
    fsId,
    appSlug,
    userSlug,
    mode,
  };
}

describe("useShareModal", () => {
  it("loads settings on open and seeds autoJoinEnabled", async () => {
    const ensureCalls: unknown[] = [];

    const vibeDiyApi: ShareModalApi = {
      ensureAppSettings: async (req) => {
        ensureCalls.push(req);
        return Result.Ok(makeEnsureRes(true));
      },
      setSetModeFs: async () => {
        return Result.Ok(makeSetModeRes({ fsId: "fs", appSlug: "a", userSlug: "u", mode: "production" }));
      },
    };

    const { result } = renderHook(() => useShareModal({ userSlug: "u", appSlug: "a", fsId: "fs", vibeDiyApi }));

    act(() => result.current.open());

    await waitFor(() => expect(ensureCalls.length).toBe(1));
    await waitFor(() => expect(result.current.autoJoinEnabled).toBe(true));
  });

  it("handlePublish calls setSetModeFs then ensureAppSettings and sets publishedUrl", async () => {
    const ensureCalls: unknown[] = [];
    const setModeCalls: unknown[] = [];

    const vibeDiyApi: ShareModalApi = {
      ensureAppSettings: async (req) => {
        ensureCalls.push(req);
        return Result.Ok(makeEnsureRes(false));
      },
      setSetModeFs: async (req) => {
        setModeCalls.push(req);
        return Result.Ok(makeSetModeRes({ fsId: req.fsId, appSlug: req.appSlug, userSlug: req.userSlug, mode: "production" }));
      },
    };

    const { result } = renderHook(() => useShareModal({ userSlug: "u", appSlug: "a", fsId: "fs-1", vibeDiyApi }));

    await act(async () => {
      await result.current.handlePublish();
    });

    expect(setModeCalls.length).toBe(1);
    expect(ensureCalls.length).toBe(1);
    expect(result.current.publishedUrl).toContain("/vibe/u/a/");
  });

  it("handleToggleAutoJoin calls ensureAppSettings with toggled autoAcceptViewRequest", async () => {
    const ensureCalls: unknown[] = [];

    const vibeDiyApi: ShareModalApi = {
      ensureAppSettings: async (req) => {
        ensureCalls.push(req);
        return Result.Ok(makeEnsureRes(true));
      },
      setSetModeFs: async () => {
        return Result.Ok(makeSetModeRes({ fsId: "fs", appSlug: "a", userSlug: "u", mode: "production" }));
      },
    };

    const { result } = renderHook(() => useShareModal({ userSlug: "u", appSlug: "a", fsId: "fs", vibeDiyApi }));

    await act(async () => {
      await result.current.handleToggleAutoJoin();
    });

    expect(ensureCalls.length).toBe(1);
    expect(result.current.autoJoinEnabled).toBe(true);
  });

  it("handleCopyUrl sets urlCopied when clipboard is available", async () => {
    const vibeDiyApi: ShareModalApi = {
      ensureAppSettings: async () => Result.Ok(makeEnsureRes(false)),
      setSetModeFs: async () => Result.Ok(makeSetModeRes({ fsId: "fs", appSlug: "a", userSlug: "u", mode: "production" })),
    };

    const originalClipboard = navigator.clipboard;

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          // no-op
        },
      },
      configurable: true,
    });

    const { result } = renderHook(() => useShareModal({ userSlug: "u", appSlug: "a", fsId: "fs", vibeDiyApi }));

    await act(async () => {
      await result.current.handlePublish();
    });

    await waitFor(() => expect(result.current.publishedUrl).toBeDefined());

    await act(async () => {
      await result.current.handleCopyUrl();
    });

    await waitFor(() => expect(result.current.urlCopied).toBe(true));

    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
  });
});
